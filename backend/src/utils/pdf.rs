// Required system packages for OCR: poppler-utils (pdftoppm), tesseract-ocr (tesseract)

use std::io::Write as _;
use std::time::Duration;
use tracing::{info, warn};

/// Hard ceiling on a single pdf-extract run. Malformed PDFs can send
/// pdf-extract into an infinite loop, which would otherwise wedge a
/// multi-hour scrape on one document.
const PDF_EXTRACT_TIMEOUT: Duration = Duration::from_secs(120);
/// Rasterising a large PDF at 300 dpi can legitimately take minutes.
const PDFTOPPM_TIMEOUT: Duration = Duration::from_secs(300);
/// Per-page tesseract ceiling; normal pages OCR in a few seconds.
const TESSERACT_TIMEOUT: Duration = Duration::from_secs(60);

/// Like `Command::output()`, but kills the child and returns `Ok(None)` if it
/// hasn't exited within `timeout`. Pipes are drained on reader threads so a
/// chatty child can't deadlock against a full pipe buffer.
fn output_with_timeout(
    mut cmd: std::process::Command,
    timeout: Duration,
) -> std::io::Result<Option<std::process::Output>> {
    use std::io::Read as _;
    use std::process::Stdio;
    use std::time::Instant;

    cmd.stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    let mut child = cmd.spawn()?;

    let mut stdout_pipe = child.stdout.take().expect("stdout piped");
    let mut stderr_pipe = child.stderr.take().expect("stderr piped");
    let stdout_reader = std::thread::spawn(move || {
        let mut buf = Vec::new();
        let _ = stdout_pipe.read_to_end(&mut buf);
        buf
    });
    let stderr_reader = std::thread::spawn(move || {
        let mut buf = Vec::new();
        let _ = stderr_pipe.read_to_end(&mut buf);
        buf
    });

    let deadline = Instant::now() + timeout;
    let status = loop {
        match child.try_wait()? {
            Some(status) => break status,
            None if Instant::now() >= deadline => {
                let _ = child.kill();
                let _ = child.wait();
                let _ = stdout_reader.join();
                let _ = stderr_reader.join();
                return Ok(None);
            }
            None => std::thread::sleep(Duration::from_millis(100)),
        }
    };

    Ok(Some(std::process::Output {
        status,
        stdout: stdout_reader.join().unwrap_or_default(),
        stderr: stderr_reader.join().unwrap_or_default(),
    }))
}

/// Download a PDF from a URL using the supplied client and return raw bytes.
pub async fn download_pdf(client: &reqwest::Client, url: &str) -> anyhow::Result<Vec<u8>> {
    let bytes = client
        .get(url)
        .send()
        .await?
        .error_for_status()?
        .bytes()
        .await?;

    Ok(bytes.to_vec())
}

/// Extract all text from a PDF given as raw bytes.
///
/// `pdf-extract` panics on certain PDFs (e.g. files that use a `DeviceN`
/// colour space).  We catch those panics here and return `Err` so that
/// callers (i.e. `extract_text_safe`) fall through to the OCR pipeline
/// instead of crashing the whole scraper run.
pub fn extract_text_from_bytes(bytes: &[u8]) -> anyhow::Result<String> {
    // pdf-extract can also loop forever on malformed PDFs, so run it on a
    // watchdog thread and give up after PDF_EXTRACT_TIMEOUT. A timed-out
    // thread is leaked (Rust can't kill it), which is the lesser evil versus
    // wedging the whole scrape.
    let owned = bytes.to_vec();
    let (tx, rx) = std::sync::mpsc::channel();
    std::thread::spawn(move || {
        let result = std::panic::catch_unwind(|| pdf_extract::extract_text_from_mem(&owned));
        let _ = tx.send(result);
    });

    match rx.recv_timeout(PDF_EXTRACT_TIMEOUT) {
        Ok(Ok(Ok(text))) => Ok(text),
        Ok(Ok(Err(e))) => Err(anyhow::anyhow!("PDF extraction failed: {e}")),
        Ok(Err(_panic_payload)) => {
            warn!("pdf-extract panicked (likely unsupported colour space) — falling back to OCR");
            Err(anyhow::anyhow!(
                "pdf-extract panicked on this PDF (unsupported colour space)"
            ))
        }
        Err(_) => {
            warn!(
                "pdf-extract exceeded {}s (malformed PDF?) — abandoning it and falling back to OCR",
                PDF_EXTRACT_TIMEOUT.as_secs()
            );
            Err(anyhow::anyhow!("pdf-extract timed out"))
        }
    }
}

/// OCR a PDF using pdftoppm + tesseract.
///
/// Steps:
///   1. Write bytes to a temp file.
///   2. Run `pdftoppm -png -r 300 <pdf> <prefix>` to rasterise each page.
///   3. Run `tesseract <image> stdout` on each PNG and collect output.
///
/// Returns `Some(text)` if at least one page produced output, `None` on any
/// unrecoverable failure (missing binaries, empty result, etc.).
pub fn extract_text_ocr(pdf_bytes: &[u8]) -> Option<String> {
    use std::process::Command;

    // Write PDF to a named temp file — tempfile crate keeps the FD open so we
    // need a path.  Use std::env::temp_dir for portability.
    let tmp_dir = std::env::temp_dir().join(format!(
        "courtwatch_ocr_{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.subsec_nanos())
            .unwrap_or(0)
    ));

    if let Err(e) = std::fs::create_dir_all(&tmp_dir) {
        warn!("OCR: failed to create temp dir: {e}");
        return None;
    }

    // Ensure cleanup on exit from this function.
    struct TmpGuard(std::path::PathBuf);
    impl Drop for TmpGuard {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }
    let _guard = TmpGuard(tmp_dir.clone());

    let pdf_path = tmp_dir.join("input.pdf");
    let img_prefix = tmp_dir.join("page");

    {
        let mut f = match std::fs::File::create(&pdf_path) {
            Ok(f) => f,
            Err(e) => {
                warn!("OCR: could not write temp PDF: {e}");
                return None;
            }
        };
        if let Err(e) = f.write_all(pdf_bytes) {
            warn!("OCR: could not write PDF bytes: {e}");
            return None;
        }
    }

    // --- Step 1: rasterise with pdftoppm ----------------------------------------
    let mut pdftoppm_cmd = Command::new("pdftoppm");
    pdftoppm_cmd.args([
        "-png",
        "-r",
        "300",
        pdf_path.to_str().unwrap_or(""),
        img_prefix.to_str().unwrap_or(""),
    ]);

    match output_with_timeout(pdftoppm_cmd, PDFTOPPM_TIMEOUT) {
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            warn!("OCR: pdftoppm not found (install poppler-utils). Skipping OCR.");
            return None;
        }
        Err(e) => {
            warn!("OCR: pdftoppm failed: {e}");
            return None;
        }
        Ok(None) => {
            warn!(
                "OCR: pdftoppm killed after {}s timeout. Skipping OCR.",
                PDFTOPPM_TIMEOUT.as_secs()
            );
            return None;
        }
        Ok(Some(out)) if !out.status.success() => {
            warn!(
                "OCR: pdftoppm exited with {}: {}",
                out.status,
                String::from_utf8_lossy(&out.stderr)
            );
            return None;
        }
        Ok(Some(_)) => {}
    }

    // --- Step 2: collect page images --------------------------------------------
    let mut page_images: Vec<std::path::PathBuf> = match std::fs::read_dir(&tmp_dir) {
        Ok(rd) => rd
            .filter_map(|e| e.ok())
            .map(|e| e.path())
            .filter(|p| p.extension().and_then(|x| x.to_str()) == Some("png"))
            .collect(),
        Err(e) => {
            warn!("OCR: could not read temp dir: {e}");
            return None;
        }
    };
    page_images.sort();

    if page_images.is_empty() {
        warn!("OCR: pdftoppm produced no PNG files");
        return None;
    }

    info!("OCR: running tesseract on {} page(s)", page_images.len());

    // --- Step 3: OCR each page with tesseract -----------------------------------
    let mut full_text = String::new();
    for img in &page_images {
        let mut tess_cmd = Command::new("tesseract");
        tess_cmd.args([img.to_str().unwrap_or(""), "stdout"]);

        match output_with_timeout(tess_cmd, TESSERACT_TIMEOUT) {
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
                warn!("OCR: tesseract not found (install tesseract-ocr). Skipping OCR.");
                return None;
            }
            Err(e) => {
                warn!("OCR: tesseract failed on {:?}: {e}", img.file_name());
                continue;
            }
            Ok(None) => {
                warn!(
                    "OCR: tesseract killed after {}s timeout on {:?}; skipping page",
                    TESSERACT_TIMEOUT.as_secs(),
                    img.file_name()
                );
                continue;
            }
            Ok(Some(out)) if !out.status.success() => {
                warn!(
                    "OCR: tesseract non-zero exit on {:?}: {}",
                    img.file_name(),
                    String::from_utf8_lossy(&out.stderr)
                );
                continue;
            }
            Ok(Some(out)) => {
                let page_text = String::from_utf8_lossy(&out.stdout)
                    .chars()
                    .filter(|&c| c == '\n' || c == '\r' || c == '\t' || !c.is_control())
                    .collect::<String>();
                full_text.push_str(&page_text);
                full_text.push('\n');
            }
        }
    }

    if full_text.trim().is_empty() {
        warn!("OCR: tesseract returned no text");
        None
    } else {
        Some(full_text)
    }
}

/// Runs `extract_text_from_bytes` (falling back to `extract_text_ocr`) on
/// Tokio's blocking-thread pool. Both do synchronous subprocess/CPU work —
/// pdf-extract's watchdog thread, pdftoppm, tesseract — that would otherwise
/// stall an async worker thread for minutes on a scanned or malformed PDF,
/// starving every other in-flight request sharing that thread.
pub async fn extract_text_or_ocr(bytes: &[u8]) -> Option<String> {
    let bytes = bytes.to_vec();
    tokio::task::spawn_blocking(move || {
        extract_text_from_bytes(&bytes)
            .ok()
            .filter(|t| !t.trim().is_empty())
            .or_else(|| extract_text_ocr(&bytes))
    })
    .await
    .unwrap_or(None)
}

/// Returns true when `text` appears to contain `case_number`.
///
/// Three passes, from most to least strict:
///   1. Exact case-insensitive substring (works for searchable PDFs).
///   2. Normalised match (strip non-alphanumeric, lowercase) — catches OCR
///      spacing artefacts, e.g. "SU 2020 CV 04215" matching "SU2020CV04215".
///   3. Prefix-stripped match — SC PDFs sometimes write "2020 CV 04215"
///      without the "SU" court prefix that the DB stores; strip leading
///      alphabetic chars from the normalised case number and check again.
pub fn pdf_contains_case_number(text: &str, case_number: &str) -> bool {
    if case_number.is_empty() {
        return false;
    }
    let lower_text = text.to_lowercase();
    let lower_case = case_number.to_lowercase();

    // Pass 1: exact case-insensitive
    if lower_text.contains(&lower_case) {
        return true;
    }

    let norm_text: String = lower_text.chars().filter(|c| c.is_alphanumeric()).collect();
    let norm_case: String = lower_case.chars().filter(|c| c.is_alphanumeric()).collect();

    if norm_case.is_empty() {
        return false;
    }

    // Pass 2: full normalised match (handles OCR spaces)
    if norm_text.contains(&norm_case) {
        return true;
    }

    // Pass 3: strip leading court-prefix letters from the case number
    // (e.g. "SU2020CV04215" → also check "2020CV04215").
    // Require at least 6 chars to avoid short-number false positives.
    let stripped = norm_case.trim_start_matches(|c: char| c.is_alphabetic());
    !stripped.is_empty()
        && stripped != norm_case.as_str()
        && stripped.len() >= 6
        && norm_text.contains(stripped)
}
