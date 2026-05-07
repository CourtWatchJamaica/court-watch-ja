const http = require("http");

const PORT = 3001;

// ── JWT-shaped mock token (decodable by getRoleFromToken in Navbar.tsx) ────────

const MOCK_PAYLOAD = Buffer.from(
  JSON.stringify({ role: "super_admin", id: 1, email: "admin@courtwatchja.com", exp: 9999999999 }),
)
  .toString("base64")
  .replace(/=/g, "")
  .replace(/\+/g, "-")
  .replace(/\//g, "_");

const MOCK_JWT = `eyJhbGciOiJIUzI1NiJ9.${MOCK_PAYLOAD}.mock_signature`;

// ── Fake data ───────────────────────────────────────────────────────────────────

const fakeJudgments = [
  {
    id: 1,
    case_number: "2024/HCV/00123",
    title: "Smith v Attorney General",
    judge_name: "Hon. Justice McDonald-Bishop",
    court: "Supreme Court",
    date: "2024-01-15",
    pdf_url: null,
    local_pdf_path: null,
    summary_text:
      "Constitutional challenge regarding fundamental rights under Chapter III of the Jamaican Constitution. The claimant alleged that sections of the Evidence Act violated the right to a fair hearing. The court upheld the challenge in part, ordering a re-hearing.",
    created_at: "2024-01-16T00:00:00Z",
    updated_at: "2024-01-16T00:00:00Z",
  },
  {
    id: 2,
    case_number: "2024/HCV/00456",
    title: "Brown v Commissioner of Police",
    judge_name: "Hon. Justice Sykes",
    court: "Court of Appeal",
    date: "2024-02-20",
    pdf_url: null,
    local_pdf_path: null,
    summary_text:
      "Appeal against conviction in the Resident Magistrate Court for unlawful possession of firearm. The Court of Appeal found that the search was conducted without reasonable cause and excluded the evidence, allowing the appeal.",
    created_at: "2024-02-21T00:00:00Z",
    updated_at: "2024-02-21T00:00:00Z",
  },
  {
    id: 3,
    case_number: "2025/PCAP/00078",
    title: "Clarke v National Housing Trust",
    judge_name: "Hon. Justice Brown",
    court: "Parish Court",
    date: "2025-03-10",
    pdf_url: null,
    local_pdf_path: null,
    summary_text:
      "Claimant sought judicial review of the National Housing Trust's decision to deny mortgage application. Parish Court found procedural irregularity and remitted the matter for reconsideration.",
    created_at: "2025-03-11T00:00:00Z",
    updated_at: "2025-03-11T00:00:00Z",
  },
  {
    id: 4,
    case_number: "2025/HCV/01204",
    title: "Pinnacle Investments Ltd v Caribbean Finance Group",
    judge_name: "Hon. Justice P. Williams",
    court: "Supreme Court",
    date: "2025-06-18",
    pdf_url: null,
    local_pdf_path: null,
    summary_text:
      "Commercial dispute arising from a breach of a loan syndication agreement. The court granted summary judgment for the claimant, awarding damages of JMD 145 million plus interest.",
    created_at: "2025-06-19T00:00:00Z",
    updated_at: "2025-06-19T00:00:00Z",
  },
  {
    id: 5,
    case_number: "2025/HCV/01890",
    title: "Digicel Jamaica Limited v Flow Jamaica Limited",
    judge_name: "Hon. Justice S. Jackson-Haisley",
    court: "Supreme Court",
    date: "2025-09-04",
    pdf_url: null,
    local_pdf_path: null,
    summary_text:
      "Injunction application in relation to alleged interference with telecommunications infrastructure. The court granted an interim injunction pending a full trial of the matter.",
    created_at: "2025-09-05T00:00:00Z",
    updated_at: "2025-09-05T00:00:00Z",
  },
  {
    id: 6,
    case_number: "2026/HCV/00311",
    title: "Thompson v National Land Agency",
    judge_name: "Hon. Justice G. Brown",
    court: "Supreme Court",
    date: "2026-01-22",
    pdf_url: null,
    local_pdf_path: null,
    summary_text:
      "Dispute over registration of title to agricultural land in St. Elizabeth. The court found in favour of the claimant, directing the National Land Agency to register the transfer.",
    created_at: "2026-01-23T00:00:00Z",
    updated_at: "2026-01-23T00:00:00Z",
  },
  {
    id: 7,
    case_number: "2025/CCAP/00034",
    title: "Roberts v National Commercial Bank",
    judge_name: "Hon. Justice Sykes",
    court: "Court of Appeal",
    date: "2025-11-12",
    pdf_url: null,
    local_pdf_path: null,
    summary_text:
      "Appeal regarding disputed mortgage enforcement proceedings. The Court of Appeal granted a stay pending full hearing.",
    created_at: "2025-11-13T00:00:00Z",
    updated_at: "2025-11-13T00:00:00Z",
  },
  {
    id: 8,
    case_number: "2026/PCAP/00011",
    title: "Williams v Kingston & St. Andrew Corporation",
    judge_name: "Hon. Justice Brown",
    court: "Parish Court",
    date: "2026-02-05",
    pdf_url: null,
    local_pdf_path: null,
    summary_text:
      "Nuisance claim regarding an unlicensed structure built adjacent to claimant's property. Parish Court ordered removal within 60 days.",
    created_at: "2026-02-06T00:00:00Z",
    updated_at: "2026-02-06T00:00:00Z",
  },
  {
    id: 9,
    case_number: "2026/CCAP/00128",
    title: "Jamwest Resort Limited v Mango Beach Holdings",
    judge_name: "Hon. Justice D. Batts",
    court: "Court of Appeal",
    date: "2026-04-28",
    pdf_url: null,
    local_pdf_path: null,
    summary_text:
      "Appeal from the Supreme Court concerning the validity of a commercial lease agreement in the tourism sector. The Court of Appeal dismissed the appeal and upheld the finding that the lease was validly terminated for non-payment of rent.",
    created_at: "2026-04-29T00:00:00Z",
    updated_at: "2026-04-29T00:00:00Z",
  },
  {
    id: 11,
    case_number: "2026/CCAP/00145",
    title: "National Insurance Fund v ISSA Trust Co Ltd",
    judge_name: "Hon. Justice Sykes",
    court: "Court of Appeal",
    date: "2026-05-02",
    pdf_url: null,
    local_pdf_path: null,
    summary_text:
      "Appeal arising from a dispute over pension benefit entitlements. The Court of Appeal allowed the appeal in part and remitted the quantum issue to the Supreme Court for fresh determination on the evidence.",
    created_at: "2026-05-03T00:00:00Z",
    updated_at: "2026-05-03T00:00:00Z",
  },
  {
    id: 12,
    case_number: "2026/HCV/00528",
    title: "Carib Cement Co Ltd v Portland Parish Council",
    judge_name: "Hon. Justice McDonald-Bishop",
    court: "Supreme Court",
    date: "2026-05-04",
    pdf_url: null,
    local_pdf_path: null,
    summary_text:
      "Judicial review of the Parish Council's decision to deny a quarrying permit. The court quashed the decision and directed a fresh hearing with proper notice to affected parties.",
    created_at: "2026-05-05T00:00:00Z",
    updated_at: "2026-05-05T00:00:00Z",
  },
];

const fakeJudges = [
  {
    id: 1,
    name: "Hon. Justice McDonald-Bishop",
    court: "Supreme Court",
    total_cases: 12,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
  {
    id: 2,
    name: "Hon. Justice Sykes",
    court: "Court of Appeal",
    total_cases: 8,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
  {
    id: 3,
    name: "Hon. Justice P. Williams",
    court: "Supreme Court",
    total_cases: 7,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
  {
    id: 4,
    name: "Hon. Justice S. Jackson-Haisley",
    court: "Supreme Court",
    total_cases: 10,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
  {
    id: 5,
    name: "Hon. Justice G. Brown",
    court: "Supreme Court",
    total_cases: 5,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
  {
    id: 6,
    name: "Hon. Justice D. Batts",
    court: "Court of Appeal",
    total_cases: 9,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
  {
    id: 7,
    name: "Hon. Justice Brown",
    court: "Parish Court",
    total_cases: 6,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
];

let fakeCourtSittings = [
  {
    id: 1,
    case_number: "SU2022CD00537",
    title: "Morrison & Anor v National People's Cooperative Bank of Jamaica Limited & Ors",
    judge_name: "Hon. Justice S. Jackson-Haisley",
    court_division: "Commercial Division",
    event_type: "Trial (part heard)",
    event_date: "2026-04-27",
    event_time: "10:00:00",
    lawyers:
      "Chambers of Simister Law: Jerome D. Spencer; PeterMc & Associates; Nunes Schoefield DeLeon & Company: Sayeed Bernard",
    pdf_source_url: null,
    created_at: "2026-04-20T00:00:00Z",
  },
  {
    id: 2,
    case_number: "SU2023CD00362",
    title: "Kingston Properties Limited v Kingston Furniture Limited",
    judge_name: "Hon. Justice D. Batts",
    court_division: "Commercial Division",
    event_type: "Committal proceedings",
    event_date: "2026-04-29",
    event_time: "14:00:00",
    lawyers: "Ramsay & Partners",
    pdf_source_url: null,
    created_at: "2026-04-20T00:00:00Z",
  },
  {
    id: 3,
    case_number: "SU2024CV01203",
    title: "Pinnacle Investments Ltd v Caribbean Finance Group",
    judge_name: "Hon. Justice P. Williams",
    court_division: "Civil Division",
    event_type: "Case management conference",
    event_date: "2026-04-30",
    event_time: "09:30:00",
    lawyers: "Hart Muirhead Fatta; Myers Fletcher & Gordon",
    pdf_source_url: null,
    created_at: "2026-04-20T00:00:00Z",
  },
  {
    id: 4,
    case_number: "SU2023HCV01987",
    title: "Marcia Thompson v National Land Agency",
    judge_name: "Hon. Justice G. Brown",
    court_division: "Civil Division",
    event_type: "Hearing",
    event_date: "2026-05-02",
    event_time: "10:00:00",
    lawyers: "DunnCox; Nunes Schoefield DeLeon & Company",
    pdf_source_url: null,
    created_at: "2026-04-20T00:00:00Z",
  },
  {
    id: 5,
    case_number: "SU2022CD00134",
    title: "Digicel Jamaica Limited v Flow Jamaica Limited",
    judge_name: "Hon. Justice S. Jackson-Haisley",
    court_division: "Commercial Division",
    event_type: "Trial",
    event_date: "2026-05-04",
    event_time: "10:00:00",
    lawyers: "Chambers of Simister Law; Livingston Alexander & Levy",
    pdf_source_url: null,
    created_at: "2026-04-20T00:00:00Z",
  },
  {
    id: 10,
    case_number: "SU2026CD00190",
    title: "Jamaican Producers Group Ltd v Caribbean Producers (Jamaica) Ltd",
    judge_name: "Hon. Justice S. Jackson-Haisley",
    court_division: "Commercial Division",
    event_type: "Case management conference",
    event_date: "2026-05-05",
    event_time: "09:00:00",
    lawyers: "Hart Muirhead Fatta; Myers Fletcher & Gordon",
    pdf_source_url: null,
    created_at: "2026-04-28T00:00:00Z",
  },
  {
    id: 11,
    case_number: "SU2026HCV00501",
    title: "National Water Commission v Kingston Properties Ltd",
    judge_name: "Hon. Justice G. Brown",
    court_division: "Civil Division",
    event_type: "Mention",
    event_date: "2026-05-05",
    event_time: "11:00:00",
    lawyers: "DunnCox; Rattray Patterson Rattray",
    pdf_source_url: null,
    created_at: "2026-04-28T00:00:00Z",
  },
  {
    id: 6,
    case_number: "SU2025CA00088",
    title: "Roberts v National Commercial Bank",
    judge_name: "Hon. Justice Sykes",
    court_division: "Court of Appeal",
    event_type: "Appeal hearing",
    event_date: "2026-05-06",
    event_time: "09:00:00",
    lawyers: "Rattray Patterson Rattray; DunnCox",
    pdf_source_url: null,
    created_at: "2026-04-20T00:00:00Z",
  },
  {
    id: 7,
    case_number: "SU2025CV00912",
    title: "Harmony Holdings Ltd v Pan Caribbean Financial Services",
    judge_name: "Hon. Justice P. Williams",
    court_division: "Commercial Division",
    event_type: "Pre-trial review",
    event_date: "2026-05-08",
    event_time: "10:30:00",
    lawyers: "Myers Fletcher & Gordon; Nunes Schoefield DeLeon & Company",
    pdf_source_url: null,
    created_at: "2026-04-22T00:00:00Z",
  },
  {
    id: 8,
    case_number: "PC2026/00045",
    title: "Campbell v Marley Industries Ltd",
    judge_name: "Hon. Justice Brown",
    court_division: "Parish Court",
    event_type: "Hearing",
    event_date: "2026-05-09",
    event_time: "09:00:00",
    lawyers: "Campbell & Associates",
    pdf_source_url: null,
    created_at: "2026-04-22T00:00:00Z",
  },
  {
    id: 9,
    case_number: "PC2026/00067",
    title: "Thomas v Attorney General (Parish Court)",
    judge_name: "Hon. Justice Brown",
    court_division: "Parish Court",
    event_type: "Mention",
    event_date: "2026-05-12",
    event_time: "10:30:00",
    lawyers: "Legal Aid Council",
    pdf_source_url: null,
    created_at: "2026-04-23T00:00:00Z",
  },
  {
    id: 12,
    case_number: "SU2025CA00193",
    title: "ISSA Trust Co Ltd v National Insurance Fund",
    judge_name: "Hon. Justice Sykes",
    court_division: "Court of Appeal",
    event_type: "Judgment delivery",
    event_date: "2026-05-14",
    event_time: "10:00:00",
    lawyers: "Nunes Schoefield DeLeon & Company; Rattray Patterson Rattray",
    pdf_source_url: null,
    created_at: "2026-04-29T00:00:00Z",
  },
  {
    id: 13,
    case_number: "SU2025CA00201",
    title: "Carib Cement Company v Construction Workers Union",
    judge_name: "Hon. Justice D. Batts",
    court_division: "Court of Appeal",
    event_type: "Hearing",
    event_date: "2026-05-19",
    event_time: "09:30:00",
    lawyers: "Chambers of Simister Law; Myers Fletcher & Gordon",
    pdf_source_url: null,
    created_at: "2026-04-30T00:00:00Z",
  },
];

// ── Parish Court Case categorisation (mirrors frontend logic) ─────────────────

const PC_VIOLENT = ["murder","manslaughter","assault","wounding","robbery","rape","sexual","grievous","gun","firearm","shooting","stabbing","arson"];
const PC_PROPERTY = ["larceny","theft","burglary","housebreaking","fraud","forgery","obtaining","malicious","damage","possession of sto"];
const PC_DRUGS = ["ganja","cannabis","cocaine","drug","possession of prohib","traffick","dangerous drug"];

function categoriseOffence(offence) {
  if (!offence) return "Other";
  const o = offence.toLowerCase();
  if (PC_VIOLENT.some((k) => o.includes(k))) return "Violent";
  if (PC_DRUGS.some((k) => o.includes(k))) return "Drugs";
  if (PC_PROPERTY.some((k) => o.includes(k))) return "Property";
  return "Other";
}

// ── Parish Court Cases ────────────────────────────────────────────────────────

const fakeParishCases = [
  { id: 1, parish: "Kingston", accused_name: "Brown, Devon", offence: "Unlawful wounding", status: "M", week_of: "2026-05-05", pdf_source_url: null, created_at: "2026-05-05T00:00:00Z" },
  { id: 2, parish: "Kingston", accused_name: "Smith, Marcia", offence: "Larceny from the person", status: "H", week_of: "2026-05-05", pdf_source_url: null, created_at: "2026-05-05T00:00:00Z" },
  { id: 3, parish: "Kingston", accused_name: "Williams, Andre", offence: "Possession of ganja", status: "P", week_of: "2026-05-05", pdf_source_url: null, created_at: "2026-05-05T00:00:00Z" },
  { id: 4, parish: "St. Andrew", accused_name: "Campbell, Rohan", offence: "Robbery with aggravation", status: "T", week_of: "2026-05-05", pdf_source_url: null, created_at: "2026-05-05T00:00:00Z" },
  { id: 5, parish: "St. Andrew", accused_name: "Gordon, Keisha", offence: "Obtaining by fraud", status: "A", week_of: "2026-04-28", pdf_source_url: null, created_at: "2026-04-28T00:00:00Z" },
  { id: 6, parish: "St. James", accused_name: "Reid, Fitzroy", offence: "Possession of firearm", status: "M", week_of: "2026-05-05", pdf_source_url: null, created_at: "2026-05-05T00:00:00Z" },
  { id: 7, parish: "St. James", accused_name: "Thomas, Calvin", offence: "Dangerous drug trafficking", status: "H", week_of: "2026-05-05", pdf_source_url: null, created_at: "2026-05-05T00:00:00Z" },
  { id: 8, parish: "St. James", accused_name: "Allen, Suzette", offence: "Housebreaking and larceny", status: "T", week_of: "2026-04-28", pdf_source_url: null, created_at: "2026-04-28T00:00:00Z" },
  { id: 9, parish: "Manchester", accused_name: "Clarke, Errol", offence: "Assault with intent to rob", status: "M", week_of: "2026-05-05", pdf_source_url: null, created_at: "2026-05-05T00:00:00Z" },
  { id: 10, parish: "Manchester", accused_name: "Black, Natoya", offence: "Possession of cocaine", status: "P", week_of: "2026-05-05", pdf_source_url: null, created_at: "2026-05-05T00:00:00Z" },
  { id: 11, parish: "Clarendon", accused_name: "Davis, Winston", offence: "Malicious destruction of property", status: "A", week_of: "2026-04-28", pdf_source_url: null, created_at: "2026-04-28T00:00:00Z" },
  { id: 12, parish: "Clarendon", accused_name: "Henry, Petronia", offence: "Larceny as a servant", status: "H", week_of: "2026-05-05", pdf_source_url: null, created_at: "2026-05-05T00:00:00Z" },
  { id: 13, parish: "St. Catherine", accused_name: "Morrison, Delroy", offence: "Murder", status: "M", week_of: "2026-05-05", pdf_source_url: null, created_at: "2026-05-05T00:00:00Z" },
  { id: 14, parish: "St. Catherine", accused_name: "Green, Audrey", offence: "Possession of ganja for own use", status: "F", week_of: "2026-05-05", pdf_source_url: null, created_at: "2026-05-05T00:00:00Z" },
  { id: 15, parish: "St. Catherine", accused_name: "White, Orville", offence: "Rape", status: "T", week_of: "2026-04-28", pdf_source_url: null, created_at: "2026-04-28T00:00:00Z" },
  { id: 16, parish: "Westmoreland", accused_name: "Jackson, Marvette", offence: "Shooting with intent", status: "H", week_of: "2026-05-05", pdf_source_url: null, created_at: "2026-05-05T00:00:00Z" },
  { id: 17, parish: "Westmoreland", accused_name: "Brown, Sheryl", offence: "Praedial larceny", status: "M", week_of: "2026-04-28", pdf_source_url: null, created_at: "2026-04-28T00:00:00Z" },
  { id: 18, parish: "St. Elizabeth", accused_name: "Lewis, Courtney", offence: "Assault occasioning actual bodily harm", status: "A", week_of: "2026-05-05", pdf_source_url: null, created_at: "2026-05-05T00:00:00Z" },
  { id: 19, parish: "St. Ann", accused_name: "Walker, Donovan", offence: "Dangerous drug possession", status: "P", week_of: "2026-05-05", pdf_source_url: null, created_at: "2026-05-05T00:00:00Z" },
  { id: 20, parish: "St. Ann", accused_name: "Thompson, Yvonne", offence: "Obtaining money by false pretences", status: "H", week_of: "2026-04-28", pdf_source_url: null, created_at: "2026-04-28T00:00:00Z" },
  { id: 21, parish: "Portland", accused_name: "Scott, Dwayne", offence: "Burglary", status: "T", week_of: "2026-05-05", pdf_source_url: null, created_at: "2026-05-05T00:00:00Z" },
  { id: 22, parish: "St. Mary", accused_name: "Edwards, Paulette", offence: "Careless driving causing death", status: "M", week_of: "2026-05-05", pdf_source_url: null, created_at: "2026-05-05T00:00:00Z" },
  { id: 23, parish: "St. Thomas", accused_name: "Bailey, Garfield", offence: "Manslaughter", status: "H", week_of: "2026-05-05", pdf_source_url: null, created_at: "2026-05-05T00:00:00Z" },
  { id: 24, parish: "Trelawny", accused_name: "Palmer, Juliet", offence: "Forgery", status: "A", week_of: "2026-04-28", pdf_source_url: null, created_at: "2026-04-28T00:00:00Z" },
  { id: 25, parish: "Hanover", accused_name: "Robinson, Lenroy", offence: "Larceny", status: "D", week_of: "2026-04-28", pdf_source_url: null, created_at: "2026-04-28T00:00:00Z" },
  { id: 26, parish: "Kingston", accused_name: "Johnson, Michael", offence: "Shooting wounding", status: "T", week_of: "2026-04-28", pdf_source_url: null, created_at: "2026-04-28T00:00:00Z" },
  { id: 27, parish: "St. Andrew", accused_name: "Wright, Claudette", offence: "Possession of prohibited weapon", status: "M", week_of: "2026-04-28", pdf_source_url: null, created_at: "2026-04-28T00:00:00Z" },
  { id: 28, parish: "Manchester", accused_name: "Myers, Cornelius", offence: "Sexual intercourse with a person under 16", status: "H", week_of: "2026-04-28", pdf_source_url: null, created_at: "2026-04-28T00:00:00Z" },
  { id: 29, parish: "St. Catherine", accused_name: "Francis, Leroy", offence: "Ganja cultivation", status: "P", week_of: "2026-04-28", pdf_source_url: null, created_at: "2026-04-28T00:00:00Z" },
  { id: 30, parish: "Clarendon", accused_name: "Burke, Annmarie", offence: "Theft by agent", status: "C", week_of: "2026-04-21", pdf_source_url: null, created_at: "2026-04-21T00:00:00Z" },
];

// ── Offence categorisation helper — mirrors backend/frontend logic ────────────

function mockCategorise(offence) {
  if (!offence) return "other";
  const o = offence.toLowerCase();
  if (["murder","manslaughter","assault","wounding","robbery","rape","sexual",
       "grievous","gun","firearm","shooting","stabbing","arson"].some((k) => o.includes(k))) return "violent";
  if (["ganja","cannabis","cocaine","drug","possession of prohib","traffick",
       "dangerous drug"].some((k) => o.includes(k))) return "drugs";
  if (["larceny","theft","burglary","housebreaking","fraud","forgery","obtaining",
       "malicious","damage","possession of sto"].some((k) => o.includes(k))) return "property";
  return "other";
}

// ── Court-filter helper — mirrors backend sitting_court_filter logic ───────────

function sittingMatchesCourt(sitting, court) {
  if (!court) return true;
  const c = court.toLowerCase();
  const div = (sitting.court_division ?? "").toLowerCase();
  if (c.includes("appeal")) return div.includes("appeal");
  if (c.includes("parish")) return div.includes("parish");
  // Supreme Court — exclude appeal and parish
  return !div.includes("appeal") && !div.includes("parish");
}

// ── In-memory stores ──────────────────────────────────────────────────────────

let userCasesStore = [];
let nextUserCaseId = 1;

let notificationsStore = [];
let nextNotifId = 1;

let mockUsers = [
  { id: 1, email: "admin@courtwatchja.com", role: "super_admin", created_at: "2024-01-01T00:00:00Z" },
  { id: 2, email: "user@courtwatchja.com", role: "user", created_at: "2024-01-02T00:00:00Z" },
];
let nextUserId = 3;

let mockConfig = [
  { key: "cutoff_date", value: "2024-01-01", updated_at: "2026-05-01T00:00:00Z" },
  { key: "max_pdf_failures", value: "3", updated_at: "2026-05-01T00:00:00Z" },
];

let mockScraperState = {
  is_running: false,
  processed_sc_count: 142,
  processed_coa_count: 58,
  processed_parish_count: 23,
  last_sc_scraped: "2026-05-04T08:30:00Z",
  last_coa_scraped: "2026-05-04T08:45:00Z",
  next_judgment_page: 6,
  next_appeal_page: 3,
  next_parish_page: 2,
  pdf_failures: {
    "https://supremecourt.gov.jm/broken-link-1.pdf": 2,
    "https://supremecourt.gov.jm/broken-link-2.pdf": 1,
  },
  pdf_skipped: ["https://supremecourt.gov.jm/not-a-court-list.pdf"],
  pdf_skipped_count: 1,
};

// ── Helpers ──────────────────────────────────────────────────────────────────────

function parseBody(req, cb) {
  let body = "";
  req.on("data", (chunk) => (body += chunk.toString()));
  req.on("end", () => {
    try {
      cb(body ? JSON.parse(body) : {});
    } catch {
      cb({});
    }
  });
}

function json(res, data, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

let nextSittingId = Math.max(...fakeCourtSittings.map((s) => s.id)) + 1;
let nextJudgmentId = Math.max(...fakeJudgments.map((j) => j.id)) + 1;
let judgmentsMutable = [...fakeJudgments];

// ── Server ────────────────────────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;
  console.log(`${req.method} ${path}`);

  // ── Maintenance / Health ──────────────────────────────────────────────────────

  if (req.method === "GET" && path === "/api/maintenance/status") {
    return json(res, { maintenance_mode: false });
  }

  // ── Parish Court Cases ────────────────────────────────────────────────────────

  const parishCaseByIdMatch = path.match(/^\/api\/parish-cases\/(\d+)$/);
  if (req.method === "GET" && parishCaseByIdMatch) {
    const id = parseInt(parishCaseByIdMatch[1], 10);
    const c = fakeParishCases.find((x) => x.id === id);
    if (!c) return json(res, { error: "Not found" }, 404);

    const related = fakeParishCases.filter(
      (r) =>
        r.id !== id &&
        r.accused_name === c.accused_name &&
        r.parish === c.parish &&
        r.week_of === c.week_of,
    );

    const all_charges = fakeParishCases
      .filter((r) => r.accused_name === c.accused_name && r.parish === c.parish)
      .sort((a, b) => (b.week_of ?? "").localeCompare(a.week_of ?? "") || a.id - b.id);

    const offence_tallies = { violent: 0, property: 0, drugs: 0, other: 0 };
    for (const ch of all_charges) {
      offence_tallies[mockCategorise(ch.offence)]++;
    }

    return json(res, {
      case: c,
      related,
      all_charges,
      total_count: all_charges.length,
      offence_tallies,
    });
  }

  if (req.method === "GET" && path === "/api/parish-cases") {
    const parish = url.searchParams.get("parish");
    const q = url.searchParams.get("q")?.toLowerCase();
    const category = url.searchParams.get("category");
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const limit = Math.min(1000, Math.max(1, parseInt(url.searchParams.get("limit") || "50", 10)));

    let results = [...fakeParishCases];
    if (parish) results = results.filter((c) => c.parish === parish);
    if (q) results = results.filter(
      (c) =>
        c.accused_name?.toLowerCase().includes(q) ||
        c.offence?.toLowerCase().includes(q) ||
        c.parish.toLowerCase().includes(q),
    );
    if (category) results = results.filter((c) => categoriseOffence(c.offence) === category);
    results.sort((a, b) => (b.week_of ?? "").localeCompare(a.week_of ?? "") || a.id - b.id);
    const total = results.length;
    const offset = (page - 1) * limit;
    return json(res, { cases: results.slice(offset, offset + limit), total });
  }

  if (req.method === "GET" && path === "/api/parish-summary") {
    const counts = {};
    for (const c of fakeParishCases) {
      counts[c.parish] = (counts[c.parish] || 0) + 1;
    }
    const summary = Object.entries(counts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, total_cases]) => ({ name, total_cases }));
    return json(res, { summary });
  }

  // ── Auth ──────────────────────────────────────────────────────────────────────

  if (req.method === "POST" && path === "/api/auth/login") {
    parseBody(req, ({ email, password }) => {
      if (email && password) {
        return json(res, { token: MOCK_JWT });
      }
      return json(res, { error: "Invalid credentials" }, 401);
    });
    return;
  }

  if (req.method === "POST" && path === "/api/auth/signup") {
    parseBody(req, ({ email, password }) => {
      if (email && password) {
        return json(res, { token: MOCK_JWT });
      }
      return json(res, { error: "Invalid data" }, 400);
    });
    return;
  }

  if (req.method === "GET" && path === "/api/auth/me") {
    return json(res, {
      id: 1,
      email: "admin@courtwatchja.com",
      role: "super_admin",
      created_at: "2024-01-01T00:00:00Z",
    });
  }

  // ── Judgments ─────────────────────────────────────────────────────────────────

  if (req.method === "GET" && path === "/api/judgments") {
    const q = url.searchParams.get("q");
    const court = url.searchParams.get("court");
    const judge = url.searchParams.get("judge");
    let results = [...judgmentsMutable];
    if (court) results = results.filter((j) => j.court === court);
    if (judge) results = results.filter((j) => j.judge_name === judge);
    if (q) {
      const ql = q.toLowerCase();
      results = results.filter(
        (j) =>
          j.title?.toLowerCase().includes(ql) ||
          j.case_number?.toLowerCase().includes(ql) ||
          j.judge_name?.toLowerCase().includes(ql),
      );
    }
    results.sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return b.date.localeCompare(a.date);
    });
    const total = results.length;
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get("limit") || "50", 10)));
    const offset = (page - 1) * limit;
    return json(res, { judgments: results.slice(offset, offset + limit), total });
  }

  if (req.method === "GET" && /^\/api\/judgments\/\d+$/.test(path)) {
    const id = parseInt(path.split("/").pop());
    const judgment = judgmentsMutable.find((j) => j.id === id);
    if (judgment) return json(res, { judgment });
    return json(res, { error: "Not found" }, 404);
  }

  // ── Judges ────────────────────────────────────────────────────────────────────

  if (req.method === "GET" && path === "/api/judges") {
    const court = url.searchParams.get("court");
    const results = court
      ? fakeJudges.filter((j) => j.court === court)
      : fakeJudges;
    return json(res, { judges: results });
  }

  if (req.method === "GET" && /^\/api\/judges\/\d+$/.test(path)) {
    const id = parseInt(path.split("/").pop());
    const judge = fakeJudges.find((j) => j.id === id);
    if (judge) {
      const filtered = judgmentsMutable
        .filter((j) => j.judge_name === judge.name)
        .sort((a, b) => {
          if (!a.date && !b.date) return 0;
          if (!a.date) return 1;
          if (!b.date) return -1;
          return b.date.localeCompare(a.date);
        });
      return json(res, { judge, judgments: filtered });
    }
    return json(res, { error: "Not found" }, 404);
  }

  if (req.method === "GET" && path === "/api/judge-connections") {
    const connections = [];
    // Derive connections from judges who share the same court (co-bench)
    for (let i = 0; i < fakeJudges.length; i++) {
      for (let j = i + 1; j < fakeJudges.length; j++) {
        if (fakeJudges[i].court && fakeJudges[i].court === fakeJudges[j].court) {
          connections.push({ judge_a_id: fakeJudges[i].id, judge_b_id: fakeJudges[j].id });
        }
      }
    }
    return json(res, { connections });
  }

  // ── Court Sittings ────────────────────────────────────────────────────────────

  if (req.method === "GET" && path === "/api/court-sittings") {
    const q = url.searchParams.get("q");
    const court = url.searchParams.get("court");
    const dateFrom = url.searchParams.get("date_from");
    const dateTo = url.searchParams.get("date_to");
    const judge = url.searchParams.get("judge");
    let results = [...fakeCourtSittings];
    if (court) results = results.filter((s) => sittingMatchesCourt(s, court));
    if (judge) results = results.filter((s) => s.judge_name === judge);
    if (dateFrom) results = results.filter((s) => (s.event_date ?? "") >= dateFrom);
    if (dateTo) results = results.filter((s) => (s.event_date ?? "") <= dateTo);
    if (q) {
      const ql = q.toLowerCase();
      results = results.filter(
        (s) =>
          s.case_number?.toLowerCase().includes(ql) ||
          s.title?.toLowerCase().includes(ql) ||
          s.judge_name?.toLowerCase().includes(ql),
      );
    }
    if (!dateFrom && !dateTo && !q) {
      const today = new Date().toISOString().split("T")[0];
      results = results.filter((s) => !s.event_date || s.event_date >= today);
    }
    results.sort((a, b) => {
      if (!a.event_date && !b.event_date) return 0;
      if (!a.event_date) return 1;
      if (!b.event_date) return -1;
      return a.event_date.localeCompare(b.event_date);
    });
    const total = results.length;
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get("limit") || "50", 10)));
    const offset = (page - 1) * limit;
    return json(res, { sittings: results.slice(offset, offset + limit), total });
  }

  if (req.method === "GET" && path === "/api/court-sittings/today") {
    const today = new Date().toISOString().split("T")[0];
    return json(res, {
      sittings: fakeCourtSittings.filter((s) => s.event_date === today),
    });
  }

  if (req.method === "GET" && /^\/api\/court-sittings\/\d+$/.test(path)) {
    const id = parseInt(path.split("/").pop());
    const sitting = fakeCourtSittings.find((s) => s.id === id);
    if (sitting) return json(res, { sitting });
    return json(res, { error: "Not found" }, 404);
  }

  // ── Court Stats ───────────────────────────────────────────────────────────────

  if (req.method === "GET" && path === "/api/court-stats") {
    const court = url.searchParams.get("court") ?? "Supreme Court";
    const today = new Date().toISOString().split("T")[0];
    const weekEnd = new Date(Date.now() + 7 * 86_400_000).toISOString().split("T")[0];

    const total_judgments = judgmentsMutable.filter((j) => j.court === court).length;
    const courtSittings = fakeCourtSittings.filter((s) => sittingMatchesCourt(s, court));
    const sittings_this_week = courtSittings.filter(
      (s) => (s.event_date ?? "") >= today && (s.event_date ?? "") <= weekEnd,
    ).length;
    const total_sittings = courtSittings.length;
    const active_judges = fakeJudges.filter((j) => j.court === court).length;

    return json(res, { court, total_judgments, sittings_this_week, total_sittings, active_judges });
  }

  // ── User Cases ────────────────────────────────────────────────────────────────

  if (req.method === "GET" && path === "/api/user/cases") {
    return json(res, { cases: userCasesStore });
  }

  if (req.method === "POST" && path === "/api/user/cases") {
    parseBody(req, ({ case_id, case_type = "judgment" }) => {
      if (case_id == null) return json(res, { error: "case_id required" }, 400);
      const existing = userCasesStore.find(
        (c) => c.case_id === case_id && c.case_type === case_type,
      );
      if (!existing) {
        userCasesStore.push({
          id: nextUserCaseId++,
          user_id: 1,
          case_id,
          case_type,
          created_at: new Date().toISOString(),
        });
      }
      return json(res, { success: true });
    });
    return;
  }

  if (req.method === "DELETE" && /^\/api\/user\/cases\/\d+$/.test(path)) {
    const case_id = parseInt(path.split("/").pop());
    const case_type = url.searchParams.get("case_type") || "judgment";
    userCasesStore = userCasesStore.filter(
      (c) => !(c.case_id === case_id && c.case_type === case_type),
    );
    return json(res, { success: true });
  }

  // ── Notifications ─────────────────────────────────────────────────────────────

  if (req.method === "GET" && path === "/api/notifications") {
    return json(res, { notifications: notificationsStore.filter((n) => n.user_id === 1) });
  }

  if (req.method === "GET" && path === "/api/notifications/unread-count") {
    const count = notificationsStore.filter(
      (n) => n.user_id === 1 && !n.read_at,
    ).length;
    return json(res, { count });
  }

  if (req.method === "POST" && path === "/api/notifications/mark-read") {
    notificationsStore = notificationsStore.map((n) =>
      n.user_id === 1 ? { ...n, read_at: new Date().toISOString() } : n,
    );
    return json(res, { updated: 1 });
  }

  if (req.method === "POST" && /^\/api\/notifications\/\d+\/mark-read$/.test(path)) {
    const id = parseInt(path.split("/")[3]);
    notificationsStore = notificationsStore.map((n) =>
      n.id === id ? { ...n, read_at: new Date().toISOString() } : n,
    );
    return json(res, { marked: true });
  }

  if (req.method === "PUT" && path === "/api/user/preferences") {
    parseBody(req, () => json(res, { success: true }));
    return;
  }

  // ── Admin: Users ──────────────────────────────────────────────────────────────

  if (req.method === "GET" && path === "/api/admin/users") {
    return json(res, { users: mockUsers });
  }

  if (req.method === "PUT" && /^\/api\/admin\/users\/\d+\/role$/.test(path)) {
    const id = parseInt(path.split("/")[4]);
    parseBody(req, ({ role }) => {
      const u = mockUsers.find((u) => u.id === id);
      if (!u) return json(res, { error: "Not found" }, 404);
      u.role = role;
      return json(res, { id: u.id, email: u.email, role: u.role });
    });
    return;
  }

  if (req.method === "DELETE" && /^\/api\/admin\/users\/\d+$/.test(path)) {
    const id = parseInt(path.split("/").pop());
    const idx = mockUsers.findIndex((u) => u.id === id);
    if (idx === -1) return json(res, { error: "Not found" }, 404);
    mockUsers.splice(idx, 1);
    return json(res, { deleted: true });
  }

  // ── Admin: Config ──────────────────────────────────────────────────────────────

  if (req.method === "GET" && path === "/api/admin/config") {
    return json(res, { config: mockConfig });
  }

  if (req.method === "PUT" && /^\/api\/admin\/config\/.+$/.test(path)) {
    const key = decodeURIComponent(path.split("/").pop());
    parseBody(req, ({ value }) => {
      const entry = mockConfig.find((c) => c.key === key);
      if (entry) {
        entry.value = value;
        entry.updated_at = new Date().toISOString();
      } else {
        mockConfig.push({ key, value, updated_at: new Date().toISOString() });
      }
      return json(res, { key, value, updated: true });
    });
    return;
  }

  // ── Admin: Scraper ────────────────────────────────────────────────────────────

  if (req.method === "GET" && path === "/api/admin/scraper/state") {
    return json(res, mockScraperState);
  }

  if (req.method === "POST" && path === "/api/admin/scraper/trigger") {
    if (mockScraperState.is_running) {
      return json(res, { error: "Scraper already running" }, 400);
    }
    mockScraperState.is_running = true;
    setTimeout(() => {
      mockScraperState.is_running = false;
    }, 3000);
    return json(res, { started: true, message: "Scraper started in background" });
  }

  if (req.method === "DELETE" && path === "/api/admin/scraper/skipped") {
    parseBody(req, ({ url }) => {
      delete mockScraperState.pdf_failures[url];
      mockScraperState.pdf_skipped = mockScraperState.pdf_skipped.filter((u) => u !== url);
      mockScraperState.pdf_skipped_count = mockScraperState.pdf_skipped.length;
      return json(res, { removed: true, url });
    });
    return;
  }

  if (req.method === "POST" && path === "/api/admin/scraper/skip") {
    parseBody(req, ({ url }) => {
      delete mockScraperState.pdf_failures[url];
      if (!mockScraperState.pdf_skipped.includes(url)) {
        mockScraperState.pdf_skipped.push(url);
        mockScraperState.pdf_skipped_count++;
      }
      return json(res, { skipped: true, url });
    });
    return;
  }

  // ── Admin: Data — Judgments ───────────────────────────────────────────────────

  if (req.method === "GET" && path === "/api/admin/data/judgments") {
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const offset = (page - 1) * limit;
    const paginated = judgmentsMutable.slice(offset, offset + limit);
    return json(res, { judgments: paginated, total: judgmentsMutable.length });
  }

  if (req.method === "POST" && path === "/api/admin/data/judgments") {
    parseBody(req, (body) => {
      if (!body.case_number) return json(res, { error: "case_number required" }, 400);
      const j = {
        id: nextJudgmentId++,
        case_number: body.case_number,
        title: body.title ?? null,
        judge_name: body.judge_name ?? null,
        court: body.court ?? null,
        date: body.date ?? null,
        pdf_url: body.pdf_url ?? null,
        local_pdf_path: null,
        summary_text: body.summary_text ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      judgmentsMutable.unshift(j);
      return json(res, { judgment: j });
    });
    return;
  }

  if (req.method === "PUT" && /^\/api\/admin\/data\/judgments\/\d+$/.test(path)) {
    const id = parseInt(path.split("/").pop());
    parseBody(req, (body) => {
      const idx = judgmentsMutable.findIndex((j) => j.id === id);
      if (idx === -1) return json(res, { error: "Not found" }, 404);
      judgmentsMutable[idx] = {
        ...judgmentsMutable[idx],
        ...body,
        id,
        updated_at: new Date().toISOString(),
      };
      return json(res, { judgment: judgmentsMutable[idx] });
    });
    return;
  }

  if (req.method === "DELETE" && /^\/api\/admin\/data\/judgments\/\d+$/.test(path)) {
    const id = parseInt(path.split("/").pop());
    const before = judgmentsMutable.length;
    judgmentsMutable = judgmentsMutable.filter((j) => j.id !== id);
    return json(res, { deleted: judgmentsMutable.length < before });
  }

  // ── Admin: Data — Sittings ────────────────────────────────────────────────────

  if (req.method === "GET" && path === "/api/admin/data/sittings") {
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const offset = (page - 1) * limit;
    const paginated = fakeCourtSittings.slice(offset, offset + limit);
    return json(res, { sittings: paginated, total: fakeCourtSittings.length });
  }

  if (req.method === "POST" && path === "/api/admin/data/sittings") {
    parseBody(req, (body) => {
      const s = {
        id: nextSittingId++,
        case_number: body.case_number ?? null,
        title: body.title ?? null,
        judge_name: body.judge_name ?? null,
        court_division: body.court_division ?? null,
        event_type: body.event_type ?? null,
        event_date: body.event_date ?? null,
        event_time: body.event_time ?? null,
        lawyers: body.lawyers ?? null,
        pdf_source_url: body.pdf_source_url ?? null,
        created_at: new Date().toISOString(),
      };
      fakeCourtSittings.unshift(s);
      return json(res, { sitting: s });
    });
    return;
  }

  if (req.method === "PUT" && /^\/api\/admin\/data\/sittings\/\d+$/.test(path)) {
    const id = parseInt(path.split("/").pop());
    parseBody(req, (body) => {
      const idx = fakeCourtSittings.findIndex((s) => s.id === id);
      if (idx === -1) return json(res, { error: "Not found" }, 404);
      fakeCourtSittings[idx] = { ...fakeCourtSittings[idx], ...body, id };
      return json(res, { sitting: fakeCourtSittings[idx] });
    });
    return;
  }

  if (req.method === "DELETE" && /^\/api\/admin\/data\/sittings\/\d+$/.test(path)) {
    const id = parseInt(path.split("/").pop());
    const before = fakeCourtSittings.length;
    fakeCourtSittings = fakeCourtSittings.filter((s) => s.id !== id);
    return json(res, { deleted: fakeCourtSittings.length < before });
  }

  // ── Admin: Stats ─────────────────────────────────────────────────────────────

  if (req.method === "GET" && path === "/api/admin/stats") {
    return json(res, {
      pending_notifications: 0,
      last_scrape_at: new Date().toISOString(),
    });
  }

  // ── Admin: Logs ───────────────────────────────────────────────────────────────

  if (req.method === "GET" && path === "/api/admin/logs") {
    const activity = notificationsStore.slice(0, 100).map((n) => ({
      id: n.id,
      email: "admin@courtwatchja.com",
      case_id: n.case_id,
      notification_type: n.type,
      sent_at: n.sent_at,
    }));
    return json(res, { activity });
  }

  // ── Admin: Announce ───────────────────────────────────────────────────────────

  if (req.method === "POST" && path === "/api/admin/announce") {
    parseBody(req, ({ title, message }) => {
      if (!title || !message) return json(res, { error: "title and message required" }, 400);
      const user_count = mockUsers.length;
      mockUsers.forEach((u) => {
        notificationsStore.push({
          id: nextNotifId++,
          user_id: u.id,
          case_id: null,
          type: "announcement",
          title,
          message,
          sent_at: new Date().toISOString(),
          read_at: null,
        });
      });
      return json(res, { sent: true, user_count });
    });
    return;
  }

  // ── Admin: Upload PDF ─────────────────────────────────────────────────────────

  if (req.method === "POST" && path === "/api/admin/upload-pdf") {
    parseBody(req, ({ filename, doc_type, court }) => {
      console.log(`  Upload: ${filename} | type=${doc_type} | court=${court}`);
      return json(res, {
        extracted: 0,
        message: "Upload received. Processing will run on next scheduled scrape.",
      });
    });
    return;
  }

  // ── 404 ───────────────────────────────────────────────────────────────────────

  json(res, { error: "Not found" }, 404);
});

server.listen(PORT, () => {
  console.log(`✅  Mock API running at http://localhost:${PORT}/api`);
  console.log(`    Token role: super_admin (JWT-shaped, decodable by frontend)`);
  console.log(`    Endpoints: judgments, court-sittings, judges, user/cases, court-stats, admin/*`);
});
