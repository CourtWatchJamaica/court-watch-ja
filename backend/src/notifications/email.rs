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

pub async fn send_welcome_email(
    client: &reqwest::Client,
    api_key: &str,
    to: &str,
    display_name: Option<&str>,
) -> anyhow::Result<()> {
    let name = display_name.unwrap_or("there");
    let app_url = std::env::var("APP_URL")
        .unwrap_or_else(|_| "https://courtwatchjamaica.com".into());
    let app_url = app_url.trim_end_matches('/');

    let html = format!(
        r#"<p>Hi {name},</p>
<p>Welcome to <strong>CourtWatch JA</strong> — Jamaica's most comprehensive court tracker.</p>
<p>You can now:</p>
<ul>
  <li>Search Supreme Court and Court of Appeal judgments</li>
  <li>Browse upcoming court sittings and cause lists</li>
  <li>Track cases and receive email alerts when they're updated</li>
</ul>
<p><a href="{app_url}">Go to your dashboard →</a></p>
<p>If you have any questions, reply to this email or contact us at <a href="mailto:courtwatchjamaica@protonmail.com">courtwatchjamaica@protonmail.com</a>.</p>
<p>— The CourtWatch JA team</p>"#
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
