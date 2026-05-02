// Required system packages for OCR: poppler-utils (pdftoppm), tesseract-ocr (tesseract)

use std::io::Write as _;
use tracing::{info, warn};

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
pub fn extract_text_from_bytes(bytes: &[u8]) -> anyhow::Result<String> {
    pdf_extract::extract_text_from_mem(bytes)
        .map_err(|e| anyhow::anyhow!("PDF extraction failed: {e}"))
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
    let pdftoppm = Command::new("pdftoppm")
        .args([
            "-png",
            "-r",
            "300",
            pdf_path.to_str().unwrap_or(""),
            img_prefix.to_str().unwrap_or(""),
        ])
        .output();

    match pdftoppm {
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            warn!("OCR: pdftoppm not found (install poppler-utils). Skipping OCR.");
            return None;
        }
        Err(e) => {
            warn!("OCR: pdftoppm failed: {e}");
            return None;
        }
        Ok(out) if !out.status.success() => {
            warn!(
                "OCR: pdftoppm exited with {}: {}",
                out.status,
                String::from_utf8_lossy(&out.stderr)
            );
            return None;
        }
        Ok(_) => {}
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
        let tess = Command::new("tesseract")
            .args([img.to_str().unwrap_or(""), "stdout"])
            .output();

        match tess {
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
                warn!("OCR: tesseract not found (install tesseract-ocr). Skipping OCR.");
                return None;
            }
            Err(e) => {
                warn!("OCR: tesseract failed on {:?}: {e}", img.file_name());
                continue;
            }
            Ok(out) if !out.status.success() => {
                warn!(
                    "OCR: tesseract non-zero exit on {:?}: {}",
                    img.file_name(),
                    String::from_utf8_lossy(&out.stderr)
                );
                continue;
            }
            Ok(out) => {
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
