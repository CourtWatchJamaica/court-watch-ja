# CourtWatch JA 🇯🇲

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/F8J6237MQQ)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)

Free, open-source platform for tracking Jamaican court cases and judgments.

Search Supreme Court and Court of Appeal judgments, browse upcoming court lists, and track cases you care about. Get notified when your case is listed, a judgment is delivered, or a hearing date changes — all in one place, completely free.

**Live at [courtwatchjamaica.com](https://courtwatchjamaica.com)**

---

## Features

- 🔍 Search Supreme Court & Court of Appeal judgments
- 📅 Browse upcoming court sittings and hearing lists
- 🔔 Track cases and get email notifications
- ⚖️ Parish Court criminal case listings
- 👨‍⚖️ Judge profiles and sitting history
- 🗺️ Interactive Jamaica parish map
- 📄 PDF download for judgments and court lists

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Rust (Axum, SQLx) |
| Frontend | Next.js 14, TypeScript, Tailwind CSS |
| Database | PostgreSQL (Supabase) |
| Hosting | Render |

## Getting Started

**Requirements:** Rust 1.75+, Node.js 18+, PostgreSQL

```bash
# Clone
git clone https://github.com/CourtWatchJamaica/court-watch-ja.git
cd court-watch-ja

# Backend
cp backend/.env.example backend/.env
# Edit backend/.env with your local database URL
cd backend && cargo run

# Frontend (separate terminal)
cp frontend/.env.example frontend/.env.local
# Edit frontend/.env.local
cd frontend && npm install && npm run dev
```

## Contributing

We welcome contributions — bug fixes, new features, scraper improvements, and more. See [CONTRIBUTING.md](./CONTRIBUTING.md) to get started.

## Support

CourtWatch JA is free and always will be. If it helps you, consider supporting hosting costs:

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/F8J6237MQQ)

## License

[AGPL-3.0](./LICENSE) — forks that run a modified version as a web service must publish their source code.

## Competition Use

This project was created and is maintained by **CourtWatchJamaica** (https://github.com/CourtWatchJamaica). Any use of this codebase in hackathons, competitions, grants, or awards must clearly credit CourtWatchJamaica as the original author. Entering this project or a derivative of it in a competition without attribution is a violation of the terms of this license and the spirit of open source. All competition rights for the original CourtWatch JA project belong to CourtWatchJamaica.

---

Built in Jamaica. For Jamaica. 🇯🇲
