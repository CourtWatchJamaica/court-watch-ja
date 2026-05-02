const http = require("http");

const PORT = 3001;

// --- Fake data (matches your DB schema exactly) ---
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
    summary_text: "Constitutional challenge regarding fundamental rights.",
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
    summary_text: "Appeal against conviction in the Resident Magistrate Court.",
    created_at: "2024-02-21T00:00:00Z",
    updated_at: "2024-02-21T00:00:00Z",
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
    lawyers: "Chambers of Simister Law: Jerome D. Spencer; PeterMc & Associates; Nunes Schoefield DeLeon & Company: Sayeed Bernard",
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
];

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS",
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;
  console.log(`${req.method} ${path}`);

  // Mock endpoints

  if (req.method === "GET" && path === "/api/judgments") {
    const q = url.searchParams.get("q");
    if (q) {
      const ql = q.toLowerCase();
      const filtered = fakeJudgments.filter(
        (j) =>
          j.title?.toLowerCase().includes(ql) ||
          j.case_number?.toLowerCase().includes(ql) ||
          j.judge_name?.toLowerCase().includes(ql),
      );
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ judgments: filtered }));
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ judgments: fakeJudgments }));
  }

  if (req.method === "GET" && path.startsWith("/api/judgments/")) {
    const id = parseInt(path.split("/").pop());
    const judgment = fakeJudgments.find((j) => j.id === id);
    if (judgment) {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ judgment }));
    }
    res.writeHead(404);
    return res.end(JSON.stringify({ error: "Not found" }));
  }

  if (req.method === "GET" && path === "/api/judges") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ judges: fakeJudges }));
  }

  if (req.method === "GET" && path.startsWith("/api/judges/")) {
    const id = parseInt(path.split("/").pop());
    const judge = fakeJudges.find((j) => j.id === id);
    if (judge) {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ judge, judgments: fakeJudgments }));
    }
  }

  if (req.method === "GET" && path === "/api/court-sittings") {
    const q = url.searchParams.get("q");
    if (q) {
      const ql = q.toLowerCase();
      const filtered = fakeCourtSittings.filter(
        (s) =>
          s.case_number?.toLowerCase().includes(ql) ||
          s.title?.toLowerCase().includes(ql) ||
          s.judge_name?.toLowerCase().includes(ql),
      );
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ sittings: filtered }));
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ sittings: fakeCourtSittings }));
  }

  if (req.method === "GET" && path === "/api/court-sittings/today") {
    const today = new Date().toISOString().split("T")[0];
    const todaySittings = fakeCourtSittings.filter(
      (s) => s.event_date === today,
    );
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ sittings: todaySittings }));
  }

  if (req.method === "GET" && path === "/api/user/cases") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ cases: [] }));
  }

  if (req.method === "POST" && path === "/api/user/cases") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ success: true }));
  }

  if (req.method === "DELETE" && path.startsWith("/api/user/cases/")) {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ success: true }));
  }

  if (req.method === "GET" && path === "/api/notifications") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ notifications: [] }));
  }

  if (req.method === "PUT" && path === "/api/user/preferences") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ success: true }));
  }

  // Default 404
  res.writeHead(404);
  return res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(PORT, () => {
  console.log(`✅ Mock API running at http://localhost:${PORT}/api`);
});
