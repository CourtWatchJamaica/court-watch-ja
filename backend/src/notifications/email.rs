use tracing::{debug, error, info};

pub enum EmailSender {
    Auth,    // auth@{RESEND_DOMAIN}    — "CourtWatch JA Authentication"
    Alerts,  // alerts@{RESEND_DOMAIN}  — "CourtWatch JA Alerts"
    Support, // support@{RESEND_DOMAIN} — "CourtWatch JA Support"
}

impl EmailSender {
    fn local_part(&self) -> &'static str {
        match self {
            EmailSender::Auth => "auth",
            EmailSender::Alerts => "alerts",
            EmailSender::Support => "support",
        }
    }

    fn display_name(&self) -> &'static str {
        match self {
            EmailSender::Auth => "CourtWatch JA Authentication",
            EmailSender::Alerts => "CourtWatch JA Alerts",
            EmailSender::Support => "CourtWatch JA Support",
        }
    }

    fn from_address(&self) -> String {
        let raw = std::env::var("RESEND_DOMAIN").unwrap_or_default();
        // Strip any inline comment (e.g., "courtwatchjamaica.com  # note")
        let domain = raw.split('#').next().unwrap_or("").trim().to_owned();

        if domain.is_empty() {
            error!("[Email] RESEND_DOMAIN is not set or empty — falling back to resend.dev (dev only)");
            let addr = format!("{}@resend.dev", self.local_part());
            return format!("{} <{addr}>", self.display_name());
        }

        info!("[Email] Resend domain: {domain}");
        let addr = format!("{}@{domain}", self.local_part());
        format!("{} <{addr}>", self.display_name())
    }
}

// ── Branded layout ────────────────────────────────────────────────────────────
//
// Every outbound email is rendered through `render` so they all share the
// app's dark glass look (frontend globals.css: `.glass-backdrop`,
// `.glass-panel`, `.dark-glass-section`, `.glass-btn-green`).
//
// Email clients have no backdrop-filter, so the frosted effect is imitated:
// coloured glows painted on the page background, a translucent white card
// with a hairline light border on top of them, and a gradient button.  Every
// translucent/gradient style is paired with a solid `bgcolor` fallback for
// clients that drop it (older Outlook).  Layout is tables + inline styles.

const BG: &str = "#080810";
const CARD: &str = "#0e0e1a";
const PANEL: &str = "#141422";
/// Translucent fills and hairlines (the "glass").
const GLASS: &str = "rgba(255,255,255,0.055)";
const GLASS_INNER: &str = "rgba(255,255,255,0.06)";
const GLASS_LINE: &str = "rgba(255,255,255,0.12)";
/// Green and gold light behind the card, as on the site's `.glass-backdrop`.
const GLOWS: &str = "radial-gradient(60% 45% at 8% 0%, rgba(0,155,58,0.38), transparent 70%), \
radial-gradient(50% 38% at 100% 22%, rgba(240,192,64,0.18), transparent 70%), \
radial-gradient(65% 50% at 72% 100%, rgba(0,155,58,0.30), transparent 70%)";
const GREEN: &str = "#00c44a";
const GOLD: &str = "#f0c040";
const TEXT: &str = "#ededf8";
const MUTED: &str = "#9a9aae";
/// Solid fallback for the gradient button.
const BTN: &str = "#00ab42";
const FONT: &str = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

/// Colour of the bar on the details panel and of the heading.
#[derive(Clone, Copy)]
pub enum Accent {
    Green,
    Gold,
}

/// Escape text for use inside HTML (element content or a quoted attribute).
pub fn esc(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

pub fn app_url() -> String {
    std::env::var("APP_URL")
        .unwrap_or_else(|_| "https://courtwatchjamaica.com".into())
        .trim_end_matches('/')
        .to_owned()
}

/// One body paragraph.  `html` is trusted markup — escape dynamic text with
/// [`esc`] before passing it in.
pub fn p(html: &str) -> String {
    format!(
        r#"<p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:{TEXT};">{html}</p>"#
    )
}

/// Render a complete branded email document.
///
/// * `heading` and the `details` labels/values are plain text (escaped here).
/// * `body_html` is trusted markup, normally built from [`p`].
/// * `cta` is `(button text, url)`.
/// * `footnote` is plain text shown small under the button.
pub fn render(
    heading: &str,
    accent: Accent,
    body_html: &str,
    details: &[(&str, String)],
    cta: Option<(&str, &str)>,
    footnote: Option<&str>,
) -> String {
    render_with_image(heading, accent, None, body_html, details, cta, footnote)
}

/// [`render`] with an optional banner image above the heading.  `image_url`
/// must already be validated as a public https URL (see
/// `api::promos::clean_image_url`); it is escaped again here.
pub fn render_with_image(
    heading: &str,
    accent: Accent,
    image_url: Option<&str>,
    body_html: &str,
    details: &[(&str, String)],
    cta: Option<(&str, &str)>,
    footnote: Option<&str>,
) -> String {
    let image_html = image_url
        .map(|u| {
            format!(
                r#"<img src="{}" alt="" width="502" style="display:block;width:100%;max-width:100%;height:auto;border:0;border-radius:18px;margin:0 0 20px;">"#,
                esc(u)
            )
        })
        .unwrap_or_default();
    let accent_color = match accent {
        Accent::Green => GREEN,
        Accent::Gold => GOLD,
    };
    let heading = esc(heading);

    let details_html = if details.is_empty() {
        String::new()
    } else {
        let rows: String = details
            .iter()
            .map(|(k, v)| {
                format!(
                    r#"<tr><td style="padding:3px 16px 3px 0;font-size:12px;color:{MUTED};white-space:nowrap;vertical-align:top;">{}</td><td style="padding:3px 0;font-size:14px;color:{TEXT};font-weight:600;">{}</td></tr>"#,
                    esc(k),
                    esc(v)
                )
            })
            .collect();
        format!(
            r#"<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 22px;"><tr><td bgcolor="{PANEL}" style="background:{GLASS_INNER};border:1px solid {GLASS_LINE};border-left:3px solid {accent_color};border-radius:16px;padding:14px 18px;box-shadow:inset 0 1px 0 rgba(255,255,255,0.08);"><table role="presentation" cellpadding="0" cellspacing="0">{rows}</table></td></tr></table>"#
        )
    };

    let cta_html = match cta {
        Some((text, url)) => {
            let (text, url) = (esc(text), esc(url));
            format!(
                r#"<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 20px;"><tr><td bgcolor="{BTN}" style="background:{BTN};background-image:linear-gradient(180deg,#00c44a,#009b3a);border:1px solid rgba(255,255,255,0.3);border-radius:999px;box-shadow:inset 0 1px 0 rgba(255,255,255,0.4),0 8px 24px rgba(0,155,58,0.3);"><a href="{url}" style="display:inline-block;padding:12px 26px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;text-shadow:0 1px 1px rgba(0,40,15,0.25);">{text}</a></td></tr></table>
<p style="margin:0 0 6px;font-size:12px;line-height:1.5;color:{MUTED};">Button not working? Copy this link:<br><a href="{url}" style="color:{MUTED};word-break:break-all;">{url}</a></p>"#
            )
        }
        None => String::new(),
    };

    let footnote_html = footnote
        .map(|f| {
            format!(
                r#"<p style="margin:14px 0 0;font-size:12px;line-height:1.5;color:{MUTED};">{}</p>"#,
                esc(f)
            )
        })
        .unwrap_or_default();

    let site = esc(&app_url());

    format!(
        r#"<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>{heading}</title>
</head>
<body bgcolor="{BG}" style="margin:0;padding:0;background:{BG};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="{BG}" style="background:{BG};">
<tr><td align="center" bgcolor="{BG}" style="padding:36px 12px;background-color:{BG};background-image:{GLOWS};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;font-family:{FONT};">
<tr><td align="center" style="padding:0 0 18px;">
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td bgcolor="{PANEL}" style="background:rgba(20,20,34,0.62);border:1px solid {GLASS_LINE};border-radius:999px;padding:9px 20px;box-shadow:inset 0 1px 0 rgba(255,255,255,0.12);">
<span style="font-size:15px;font-weight:800;color:{GREEN};letter-spacing:.2px;">CourtWatch JA</span>
<span style="font-size:9px;font-weight:700;color:{GOLD};letter-spacing:1.3px;padding-left:10px;">TRACK DI CASE DEM</span>
</td></tr></table>
</td></tr>
<tr><td bgcolor="{CARD}" style="background:{GLASS};border:1px solid {GLASS_LINE};border-radius:28px;padding:30px 28px 26px;box-shadow:inset 0 1px 0 rgba(255,255,255,0.12),0 20px 60px rgba(0,0,0,0.35);">
{image_html}
<p style="margin:0 0 14px;font-size:20px;line-height:1.3;font-weight:700;color:{accent_color};">{heading}</p>
{body_html}
{details_html}
{cta_html}
{footnote_html}
</td></tr>
<tr><td style="padding:18px 8px 0;font-size:11px;line-height:1.6;color:{MUTED};text-align:center;">
CourtWatch JA &middot; <a href="{site}" style="color:{MUTED};">courtwatchjamaica.com</a><br>
Manage email alerts in <a href="{site}/settings/notifications" style="color:{MUTED};">notification settings</a>.
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>"#
    )
}

pub async fn send_welcome_email(
    client: &reqwest::Client,
    api_key: &str,
    to: &str,
    display_name: Option<&str>,
) -> anyhow::Result<()> {
    let name = esc(display_name.unwrap_or("there"));
    let app_url = app_url();

    let body = [
        p(&format!("Hi {name},")),
        p("Your account is ready. Here's what you can do with CourtWatch JA:"),
        format!(
            r#"<ul style="margin:0 0 16px;padding-left:20px;font-size:14px;line-height:1.8;color:{TEXT};">
<li>Search Supreme Court &amp; Court of Appeal judgments</li>
<li>Browse upcoming court lists across all divisions</li>
<li>Track cases and get notified when they're listed</li>
<li>View Parish Court lists and analytics</li>
</ul>"#
        ),
    ]
    .concat();

    let html = render(
        "Welcome to CourtWatch JA!",
        Accent::Green,
        &body,
        &[],
        Some(("Go to your dashboard", &app_url)),
        Some("Questions? Reply to this email or write to courtwatchjamaica@protonmail.com."),
    );

    send_email(
        client,
        api_key,
        EmailSender::Auth,
        to,
        "Welcome to CourtWatch JA!",
        &html,
    )
    .await
}

pub async fn send_email(
    client: &reqwest::Client,
    api_key: &str,
    sender: EmailSender,
    to: &str,
    subject: &str,
    html: &str,
) -> anyhow::Result<()> {
    let from = sender.from_address();

    let payload = serde_json::json!({
        "from": from,
        "to": [to],
        "subject": subject,
        "html": html,
    });

    let body_str = serde_json::to_string(&payload)?;
    debug!("[Email] Resend request body: {body_str}");

    let res = client
        .post("https://api.resend.com/emails")
        .header("Authorization", format!("Bearer {api_key}"))
        .header("Content-Type", "application/json")
        .body(body_str)
        .send()
        .await?;

    if res.status().is_success() {
        info!("[Email] sent '{subject}' to {to} from {from}");
    } else {
        let status = res.status();
        let body = res.text().await.unwrap_or_default();
        error!("[Email] Resend rejected '{subject}' to {to} — HTTP {status}: {body}");
        anyhow::bail!("Resend API error {status}: {body}");
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn render_escapes_dynamic_text_and_keeps_layout() {
        let html = render(
            "Case <b>X</b> listed",
            Accent::Gold,
            &p("Body"),
            &[("Case", "A & B <script>".to_string())],
            Some(("View", "https://example.com/docket/A B?x=\"1\"")),
            Some("Note <i>"),
        );
        assert!(html.starts_with("<!DOCTYPE html>"));
        assert!(html.contains("CourtWatch JA"));
        assert!(html.contains("Case &lt;b&gt;X&lt;/b&gt; listed"));
        assert!(html.contains("A &amp; B &lt;script&gt;"));
        assert!(!html.contains("<script>"));
        assert!(html.contains("x=&quot;1&quot;"));
        assert!(html.contains("Note &lt;i&gt;"));
        assert!(html.contains(GOLD));
    }

    /// Writes sample emails to $EMAIL_PREVIEW_DIR for a visual check:
    ///   EMAIL_PREVIEW_DIR=/tmp/emails cargo test email_previews -- --ignored
    #[test]
    #[ignore]
    fn email_previews() {
        let dir = std::env::var("EMAIL_PREVIEW_DIR").expect("EMAIL_PREVIEW_DIR not set");
        std::fs::create_dir_all(&dir).unwrap();
        let details = vec![
            ("Case", "COA2024MT00004".to_string()),
            ("Event", "MOTION/APPLICATION".to_string()),
            ("Court", "Court of Appeal".to_string()),
            ("Date", "Wednesday, 11 November 2026".to_string()),
        ];
        let url = "https://courtwatchjamaica.com/docket/COA2024MT00004";
        let samples = [
            (
                "reminder-tomorrow",
                render("Hearing Tomorrow", Accent::Gold, &p("Your tracked case is scheduled for tomorrow."), &details, Some(("View Case", url)), None),
            ),
            (
                "reminder-today",
                render("Hearing Today", Accent::Green, &p("Your tracked case is scheduled for today."), &details, Some(("View Case", url)), None),
            ),
            (
                "verify-email",
                render(
                    "Verify your email address",
                    Accent::Green,
                    &p("Thanks for signing up for CourtWatch JA. Click the button below to verify your email and start tracking Jamaican court cases."),
                    &[],
                    Some(("Verify Email", "https://courtwatchjamaica.com/verify-email?token=00000000-0000-0000-0000-000000000000")),
                    Some("This link expires in 24 hours. If you didn't create an account, you can ignore this email."),
                ),
            ),
        ];
        let samples = samples.into_iter().chain([(
            "announcement-with-image",
            render_with_image(
                "New: Parish Court lists",
                Accent::Green,
                std::env::var("EMAIL_PREVIEW_IMAGE").ok().as_deref(),
                &p("Weekly Parish Court lists are now searchable on CourtWatch JA, with status tracking for each case."),
                &[],
                Some(("Visit CourtWatch JA", "https://courtwatchjamaica.com")),
                Some("You're receiving this because you registered at courtwatchjamaica.com."),
            ),
        )]);
        for (name, html) in samples {
            std::fs::write(format!("{dir}/{name}.html"), html).unwrap();
        }
    }

    /// Sends ONE real sample email through Resend, using backend/.env:
    ///   TEST_EMAIL_TO=you@example.com cargo test send_sample_email -- --ignored --nocapture
    #[tokio::test]
    #[ignore]
    async fn send_sample_email() {
        dotenvy::dotenv().ok();
        let to = std::env::var("TEST_EMAIL_TO").expect("TEST_EMAIL_TO not set");
        let key = std::env::var("RESEND_API_KEY").expect("RESEND_API_KEY not set");
        let url = format!("{}/docket/COA2024MT00004", app_url());
        let html = render(
            "Hearing Tomorrow",
            Accent::Gold,
            &p("Your tracked case is scheduled for tomorrow. (This is a design test, not a real alert.)"),
            &[
                ("Case", "COA2024MT00004".to_string()),
                ("Event", "MOTION/APPLICATION".to_string()),
                ("Court", "Court of Appeal".to_string()),
                ("Date", "Wednesday, 11 November 2026".to_string()),
            ],
            Some(("View Case", &url)),
            None,
        );
        send_email(
            &reqwest::Client::new(),
            &key,
            EmailSender::Alerts,
            &to,
            "CourtWatch JA: design test — Hearing Tomorrow",
            &html,
        )
        .await
        .expect("send");
    }

    #[test]
    fn render_with_image_adds_escaped_banner() {
        let html = render_with_image(
            "Hi",
            Accent::Green,
            Some("https://cdn.example.com/b.png?a=1&b=2"),
            &p("Body"),
            &[],
            None,
            None,
        );
        assert!(html.contains(r#"<img src="https://cdn.example.com/b.png?a=1&amp;b=2""#));
        assert!(!render("Hi", Accent::Green, &p("Body"), &[], None, None).contains("<img"));
    }

    #[test]
    fn render_omits_empty_sections() {
        let html = render("Hi", Accent::Green, &p("Body"), &[], None, None);
        assert!(!html.contains("Button not working"));
        assert!(!html.contains("border-left:3px"));
    }

    /// Clients that drop rgba()/gradients must still get a dark page.
    #[test]
    fn render_has_solid_fallbacks_for_glass() {
        let html = render("Hi", Accent::Green, &p("Body"), &[("K", "V".into())], Some(("Go", "https://x")), None);
        assert!(html.contains(&format!(r#"bgcolor="{BG}""#)));
        assert!(html.contains(&format!(r#"bgcolor="{CARD}""#)));
        assert!(html.contains(&format!(r#"bgcolor="{PANEL}""#)));
    }
}
