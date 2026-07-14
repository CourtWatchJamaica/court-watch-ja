# Contributing to CourtWatch JA

Thank you for your interest in contributing to CourtWatch JA — a free, open-source platform for tracking Jamaican court cases and judgments.

## Ways to Contribute

### Report Bugs
Open an issue on GitHub describing:
- What you expected to happen
- What actually happened
- Steps to reproduce it
- Screenshots if relevant

### Suggest Features
Open an issue tagged `enhancement`. Explain the use case — who benefits and why it matters for Jamaican court transparency.

### Submit Code
1. Fork the repository
2. Create a branch: `git checkout -b feature/your-feature-name`
3. Make your changes
4. Test locally (see setup below)
5. Open a pull request with a clear description of what changed and why

### Improve Data Coverage
The scrapers currently cover the Supreme Court and Court of Appeal. If you know of other public Jamaican court data sources, open an issue or PR.

## Local Setup

**Requirements:** Rust (1.75+), Node.js (18+), PostgreSQL

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

## Code Style
- **Rust:** run `cargo clippy` before submitting. No warnings.
- **TypeScript/React:** run `npm run lint`. Follow the existing patterns in the codebase.
- Keep PRs focused — one feature or fix per PR.
- No new dependencies without discussion in an issue first.

## License
By contributing, you agree your code will be licensed under [AGPL-3.0](./LICENSE). Forks that run a modified version as a web service must also publish their source code.

## Questions?
Open an issue or email **courtwatchjamaica@protonmail.com**.
