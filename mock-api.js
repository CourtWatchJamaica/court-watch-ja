const http = require("http");

const PORT = 3001;

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
];

const fakeCourtSittings = [
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
];

// ── In-memory user cases (stateful across requests, resets on restart) ──────────

let userCasesStore = [];
let nextUserCaseId = 1;

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

  // ── Judgments ─────────────────────────────────────────────────────────────────

  if (req.method === "GET" && path === "/api/judgments") {
    const q = url.searchParams.get("q");
    const court = url.searchParams.get("court");
    let results = [...fakeJudgments];
    if (court) results = results.filter((j) => j.court === court);
    if (q) {
      const ql = q.toLowerCase();
      results = results.filter(
        (j) =>
          j.title?.toLowerCase().includes(ql) ||
          j.case_number?.toLowerCase().includes(ql) ||
          j.judge_name?.toLowerCase().includes(ql),
      );
    }
    return json(res, { judgments: results });
  }

  if (req.method === "GET" && /^\/api\/judgments\/\d+$/.test(path)) {
    const id = parseInt(path.split("/").pop());
    const judgment = fakeJudgments.find((j) => j.id === id);
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
    if (judge) return json(res, { judge, judgments: fakeJudgments });
    return json(res, { error: "Not found" }, 404);
  }

  // ── Court Sittings ────────────────────────────────────────────────────────────

  if (req.method === "GET" && path === "/api/court-sittings") {
    const q = url.searchParams.get("q");
    const court = url.searchParams.get("court");
    const dateFrom = url.searchParams.get("date_from");
    const dateTo = url.searchParams.get("date_to");
    let results = [...fakeCourtSittings];
    if (court)
      results = results.filter((s) =>
        s.court_division?.toLowerCase().includes(court.toLowerCase()),
      );
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
    return json(res, { sittings: results });
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

    const totalJudgments = fakeJudgments.filter((j) => j.court === court).length;
    const sittingsThisWeek = fakeCourtSittings.filter(
      (s) => (s.event_date ?? "") >= today && (s.event_date ?? "") <= weekEnd,
    ).length;
    const activeJudges = fakeJudges.filter((j) => j.court === court).length;

    return json(res, { court, totalJudgments, sittingsThisWeek, activeJudges });
  }

  // ── User Cases ────────────────────────────────────────────────────────────────

  if (req.method === "GET" && path === "/api/user/cases") {
    return json(res, { cases: userCasesStore });
  }

  if (req.method === "POST" && path === "/api/user/cases") {
    parseBody(req, ({ case_id, case_type = "judgment" }) => {
      if (case_id == null) return json(res, { error: "case_id required" }, 400);
      const existing = userCasesStore.find((c) => c.case_id === case_id);
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
    userCasesStore = userCasesStore.filter((c) => c.case_id !== case_id);
    return json(res, { success: true });
  }

  // ── Notifications ─────────────────────────────────────────────────────────────

  if (req.method === "GET" && path === "/api/notifications") {
    return json(res, { notifications: [] });
  }

  // ── Auth ──────────────────────────────────────────────────────────────────────

  if (req.method === "POST" && path === "/api/auth/login") {
    parseBody(req, ({ email, password }) => {
      if (email && password) {
        return json(res, { token: "mock-jwt-token-" + Date.now() });
      }
      return json(res, { error: "Invalid credentials" }, 401);
    });
    return;
  }

  if (req.method === "POST" && path === "/api/auth/signup") {
    parseBody(req, ({ email, password }) => {
      if (email && password) {
        return json(res, { token: "mock-jwt-token-" + Date.now() });
      }
      return json(res, { error: "Invalid data" }, 400);
    });
    return;
  }

  if (req.method === "PUT" && path === "/api/user/preferences") {
    parseBody(req, () => json(res, { success: true }));
    return;
  }

  // ── 404 ───────────────────────────────────────────────────────────────────────

  json(res, { error: "Not found" }, 404);
});

server.listen(PORT, () => {
  console.log(`✅  Mock API running at http://localhost:${PORT}/api`);
  console.log(`    Endpoints: judgments, court-sittings, judges, user/cases, court-stats`);
});
