use tracing::{debug, error, info, warn};

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
        warn!("[Email] Resend {status} for {to}: {body}");
    }
    Ok(())
}
