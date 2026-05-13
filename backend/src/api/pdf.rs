use axum::{
    body::Body,
    extract::{Path, State},
    http::{header, StatusCode},
    response::Response,
};
use chrono::Local;
use printpdf::{
    BuiltinFont, Color, IndirectFontRef, Line, LineCapStyle, LineDashPattern, Mm, PdfDocument,
    PdfDocumentReference, PdfLayerIndex, PdfLayerReference, PdfPageIndex, Point, Rgb,
};

use crate::{db::queries, AppState};

const PAGE_W: f64 = 210.0;
const PAGE_H: f64 = 297.0;
const MARGIN: f64 = 20.0;

const GREEN: (f64, f64, f64) = (0.0, 0.608, 0.227);
const GOLD: (f64, f64, f64) = (0.996, 0.820, 0.0);
const DARK: (f64, f64, f64) = (0.08, 0.08, 0.10);
const TEXT: (f64, f64, f64) = (0.15, 0.15, 0.20);
const MUTED: (f64, f64, f64) = (0.50, 0.50, 0.55);

fn rgb(r: f64, g: f64, b: f64) -> Color {
    Color::Rgb(Rgb::new(r, g, b, None))
}

fn wrap_text(text: &str, chars_per_line: usize) -> Vec<String> {
    let mut lines = Vec::new();
    let mut current = String::new();
    for word in text.split_whitespace() {
        if current.is_empty() {
            current.push_str(word);
        } else if current.len() + 1 + word.len() <= chars_per_line {
            current.push(' ');
            current.push_str(word);
        } else {
            lines.push(std::mem::take(&mut current));
            current.push_str(word);
        }
    }
    if !current.is_empty() {
        lines.push(current);
    }
    lines
}

// ── Builder ───────────────────────────────────────────────────────────────────

struct PdfBuilder {
    doc: PdfDocumentReference,
    bold: IndirectFontRef,
    regular: IndirectFontRef,
    page: PdfPageIndex,
    layer: PdfLayerIndex,
    y: f64,
}

impl PdfBuilder {
    fn new(title: &str) -> Self {
        let (doc, page, layer) =
            PdfDocument::new(title, Mm(PAGE_W), Mm(PAGE_H), "Content");
        let bold = doc.add_builtin_font(BuiltinFont::HelveticaBold).unwrap();
        let regular = doc.add_builtin_font(BuiltinFont::Helvetica).unwrap();
        let mut b = PdfBuilder { doc, bold, regular, page, layer, y: PAGE_H - MARGIN };
        b.draw_header();
        b
    }

    fn current_layer(&self) -> PdfLayerReference {
        self.doc.get_page(self.page).get_layer(self.layer)
    }

    fn draw_header(&mut self) {
        let lyr = self.current_layer();

        // Dark background bar
        Self::filled_rect(&lyr, 0.0, PAGE_H - 36.0, PAGE_W, 36.0, rgb(DARK.0, DARK.1, DARK.2));

        // Gold stripe at bottom of header
        Self::filled_rect(&lyr, 0.0, PAGE_H - 36.0, PAGE_W, 2.0, rgb(GOLD.0, GOLD.1, GOLD.2));

        // "COURTWATCH JA" title
        lyr.set_fill_color(rgb(GOLD.0, GOLD.1, GOLD.2));
        lyr.use_text("COURTWATCH JA", 22.0, Mm(MARGIN), Mm(PAGE_H - 16.0), &self.bold);

        // Subtitle
        lyr.set_fill_color(rgb(0.60, 0.60, 0.65));
        lyr.use_text(
            "Jamaica's Court Intelligence Platform",
            8.0,
            Mm(MARGIN),
            Mm(PAGE_H - 25.0),
            &self.regular,
        );

        // Generation date
        let date_str = format!("Generated {}", Local::now().format("%d %b %Y"));
        lyr.set_fill_color(rgb(MUTED.0, MUTED.1, MUTED.2));
        lyr.use_text(&date_str, 7.0, Mm(PAGE_W - MARGIN - 42.0), Mm(PAGE_H - 25.0), &self.regular);

        // Green divider below header
        Self::hline(&lyr, MARGIN, PAGE_W - MARGIN, PAGE_H - 40.0, 0.5, rgb(GREEN.0, GREEN.1, GREEN.2));

        self.y = PAGE_H - 48.0;
    }

    fn add_page(&mut self) {
        let (page, layer) = self.doc.add_page(Mm(PAGE_W), Mm(PAGE_H), "Content");
        self.page = page;
        self.layer = layer;
        self.y = PAGE_H - MARGIN;
        let lyr = self.current_layer();
        lyr.set_fill_color(rgb(GOLD.0, GOLD.1, GOLD.2));
        lyr.use_text("COURTWATCH JA", 9.0, Mm(MARGIN), Mm(PAGE_H - MARGIN), &self.bold);
        self.y = PAGE_H - MARGIN - 9.0;
    }

    fn ensure_space(&mut self, needed: f64) {
        if self.y - needed < MARGIN + 14.0 {
            self.add_page();
        }
    }

    // ── Drawing helpers ───────────────────────────────────────────────────────

    fn filled_rect(lyr: &PdfLayerReference, x: f64, y: f64, w: f64, h: f64, color: Color) {
        lyr.set_fill_color(color);
        let rect = Line {
            points: vec![
                (Point::new(Mm(x), Mm(y)), false),
                (Point::new(Mm(x + w), Mm(y)), false),
                (Point::new(Mm(x + w), Mm(y + h)), false),
                (Point::new(Mm(x), Mm(y + h)), false),
            ],
            is_closed: true,
            has_fill: true,
            has_stroke: false,
            is_clipping_path: false,
        };
        lyr.add_shape(rect);
    }

    fn hline(lyr: &PdfLayerReference, x1: f64, x2: f64, y: f64, thickness: f64, color: Color) {
        lyr.set_outline_color(color);
        lyr.set_outline_thickness(thickness);
        lyr.set_line_cap_style(LineCapStyle::Butt);
        lyr.set_line_dash_pattern(LineDashPattern::default());
        let line = Line {
            points: vec![
                (Point::new(Mm(x1), Mm(y)), false),
                (Point::new(Mm(x2), Mm(y)), false),
            ],
            is_closed: false,
            has_fill: false,
            has_stroke: true,
            is_clipping_path: false,
        };
        lyr.add_shape(line);
    }

    // ── Content helpers ───────────────────────────────────────────────────────

    pub fn section_label(&mut self, label: &str) {
        self.ensure_space(12.0);
        let lyr = self.current_layer();
        lyr.set_fill_color(rgb(GREEN.0, GREEN.1, GREEN.2));
        lyr.use_text(label, 7.5, Mm(MARGIN), Mm(self.y), &self.bold);
        self.y -= 3.5;
        Self::hline(&lyr, MARGIN, MARGIN + 32.0, self.y, 0.3, rgb(GREEN.0, GREEN.1, GREEN.2));
        self.y -= 5.0;
    }

    pub fn big_title(&mut self, text: &str) {
        for line in wrap_text(text, 60) {
            self.ensure_space(10.0);
            let lyr = self.current_layer();
            lyr.set_fill_color(rgb(TEXT.0, TEXT.1, TEXT.2));
            lyr.use_text(&line, 14.0, Mm(MARGIN), Mm(self.y), &self.bold);
            self.y -= 8.0;
        }
        self.y -= 2.0;
    }

    pub fn mono_tag(&mut self, text: &str) {
        self.ensure_space(7.0);
        let lyr = self.current_layer();
        lyr.set_fill_color(rgb(GOLD.0 * 0.7, GOLD.1 * 0.7, 0.0));
        lyr.use_text(text, 8.0, Mm(MARGIN), Mm(self.y), &self.regular);
        self.y -= 6.0;
    }

    pub fn kv_row(&mut self, key: &str, value: &str) {
        self.ensure_space(6.0);
        let lyr = self.current_layer();
        lyr.set_fill_color(rgb(MUTED.0, MUTED.1, MUTED.2));
        lyr.use_text(key, 7.5, Mm(MARGIN), Mm(self.y), &self.bold);
        lyr.set_fill_color(rgb(TEXT.0, TEXT.1, TEXT.2));
        lyr.use_text(value, 7.5, Mm(MARGIN + 28.0), Mm(self.y), &self.regular);
        self.y -= 5.5;
    }

    pub fn spacer(&mut self, mm: f64) {
        self.y -= mm;
    }

    pub fn body_text(&mut self, text: &str) {
        const MAX_LINES: usize = 40;
        let lines = wrap_text(text, 85);
        let total = lines.len();
        for line in lines.iter().take(MAX_LINES) {
            self.ensure_space(5.5);
            let lyr = self.current_layer();
            lyr.set_fill_color(rgb(TEXT.0, TEXT.1, TEXT.2));
            lyr.use_text(line, 9.0, Mm(MARGIN), Mm(self.y), &self.regular);
            self.y -= 5.5;
        }
        if total > MAX_LINES {
            self.ensure_space(5.5);
            let lyr = self.current_layer();
            lyr.set_fill_color(rgb(MUTED.0, MUTED.1, MUTED.2));
            lyr.use_text(
                "[Summary truncated — see full judgment PDF]",
                8.0,
                Mm(MARGIN),
                Mm(self.y),
                &self.regular,
            );
            self.y -= 5.5;
        }
    }

    pub fn footer_rule(&mut self) {
        self.ensure_space(14.0);
        let footer_y = MARGIN + 8.0;
        let lyr = self.current_layer();
        Self::hline(&lyr, MARGIN, PAGE_W - MARGIN, footer_y + 4.0, 0.3, rgb(0.75, 0.75, 0.75));
        lyr.set_fill_color(rgb(MUTED.0, MUTED.1, MUTED.2));
        lyr.use_text(
            "CourtWatch JA \u{2014} courtwatchja.com  |  This is a summary document. Not legal advice.",
            7.0,
            Mm(MARGIN),
            Mm(footer_y),
            &self.regular,
        );
    }

    pub fn finish(self) -> Vec<u8> {
        self.doc.save_to_bytes().unwrap_or_default()
    }
}

// ── Handlers ─────────────────────────────────────────────────────────────────

pub async fn judgment_pdf(
    State(state): State<AppState>,
    Path(id): Path<i32>,
) -> Result<Response<Body>, StatusCode> {
    let judgment = queries::get_judgment_by_id(&state.db, id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    let display_title = judgment
        .title
        .clone()
        .unwrap_or_else(|| judgment.case_number.clone());

    let mut pdf = PdfBuilder::new(&display_title);
    pdf.section_label("JUDGMENT SUMMARY");
    pdf.big_title(&display_title);
    if judgment.title.is_some() {
        pdf.mono_tag(&judgment.case_number);
    }
    pdf.spacer(3.0);
    if let Some(v) = &judgment.court {
        pdf.kv_row("Court", v);
    }
    if let Some(v) = &judgment.judge_name {
        pdf.kv_row("Judge", v);
    }
    if let Some(v) = &judgment.date {
        pdf.kv_row("Date", &v.format("%d %B %Y").to_string());
    }
    if let Some(v) = &judgment.summary_text {
        pdf.spacer(5.0);
        pdf.section_label("SUMMARY");
        pdf.body_text(v);
    }
    pdf.footer_rule();

    let bytes = pdf.finish();
    let safe = judgment
        .case_number
        .replace(|c: char| !c.is_alphanumeric() && c != '-', "_");
    let filename = format!("CourtWatch-JA-{safe}.pdf");

    Ok(pdf_response(bytes, &filename))
}

pub async fn sitting_pdf(
    State(state): State<AppState>,
    Path(id): Path<i32>,
) -> Result<Response<Body>, StatusCode> {
    let sitting = queries::get_court_sitting_by_id(&state.db, id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    let display_title = sitting
        .title
        .clone()
        .or_else(|| sitting.case_number.clone())
        .unwrap_or_else(|| format!("Court Sitting #{id}"));

    let mut pdf = PdfBuilder::new(&display_title);
    pdf.section_label("COURT LIST / SITTING");
    pdf.big_title(&display_title);
    if sitting.title.is_some() {
        if let Some(cn) = &sitting.case_number {
            pdf.mono_tag(cn);
        }
    }
    pdf.spacer(3.0);
    if let Some(v) = &sitting.court_division {
        pdf.kv_row("Division", v);
    }
    if let Some(v) = &sitting.event_type {
        pdf.kv_row("Event Type", v);
    }
    if let Some(v) = &sitting.judge_name {
        pdf.kv_row("Judge", v);
    }
    if let Some(v) = &sitting.event_date {
        pdf.kv_row("Date", &v.format("%d %B %Y").to_string());
    }
    if let Some(v) = &sitting.event_time {
        pdf.kv_row("Time", &v.format("%I:%M %p").to_string());
    }
    if let Some(v) = &sitting.lawyers {
        pdf.spacer(3.0);
        pdf.section_label("COUNSEL");
        pdf.body_text(v);
    }
    pdf.footer_rule();

    let bytes = pdf.finish();
    let slug = sitting
        .case_number
        .as_deref()
        .unwrap_or("sitting")
        .replace(|c: char| !c.is_alphanumeric() && c != '-', "_");
    let filename = format!("CourtWatch-JA-{slug}.pdf");

    Ok(pdf_response(bytes, &filename))
}

fn pdf_response(bytes: Vec<u8>, filename: &str) -> Response<Body> {
    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "application/pdf")
        .header(
            header::CONTENT_DISPOSITION,
            format!("attachment; filename=\"{filename}\""),
        )
        .header(header::CACHE_CONTROL, "public, max-age=3600")
        .body(Body::from(bytes))
        .unwrap()
}
