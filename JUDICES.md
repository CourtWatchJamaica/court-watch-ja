                 __________
                    __________/VVVVVVVVVV\
                   /VVVVVVVVVVVVVVVVVVVVVV|
                 /VVVVVVVVVVVVVVVVVVVVVVV/
               /VVVVVVVVVVVVVVVVVVVVVVVV/
              |VVVV^^^^^^^^^^^^         |
             |                    vvvvvv\
             |     vvvvvvvVVVVVVVVVVVVVV/
             |/VVVVVVVVVVVVVVVVVVVVVVVVV|
             |VVVVVVV^^^^^^^^^^         |
              |V/                        \
              |             vvvvvvvvvvvvv|
               \  /VVVVVVVVVVVVVVVVVVVVVV\
                \/VVVVVVVVVVVVVVVVVVVVVVVV\____
                 |VVVVVVVV^^^^^^^^^^___________)
             |\__|/ _____ //--------   \\xx/
             | xx\ /%%%%///   __     __  \\ \
             \_xxx %%%%  /   /  \   /  \    |
             / \x%%%%       ((0) ) ((0) )   |
            / #/|%%%%        \__/   \__/     \__  ______-------
            \#/ |%%%%             @@            \/
              _/%%%%                             |_____
     ________/|%%%%                              |    -----___
-----         |%%%%     \___       Judaces    __/
           ___/\%%%%    /  --________________//
     __----     \%%%%                     ___/
    /             \%%%%                   _/
                     \%%%%              _/
                       \%%%%           /
                          \%%         |
                           |%%        |


text

**Jamaican Law Case Tracker – CourtWatch JA**

---

## Current Status (updated 2026‑04‑29)

| Layer        | Status                                                       |
|--------------|--------------------------------------------------------------|
| **Database** | PostgreSQL running locally (✅ tables created via sqlx)      |
| **Backend**  | Rust / Axum – project initialised, **not yet implemented**   |
| **Mock API** | Node.js mock server (mock-api.js) provides fake data         |
| **Frontend** | Next.js 14 – minimal dashboard running, core pages scaffolded|
| **3D Assets**| Not started – Blender scenes for judges to be added later    |

---

## Project structure
jamaican-law-app/
├── backend/ # Rust (Axum + sqlx)
│ ├── Cargo.toml
│ ├── src/
│ │ ├── main.rs # entrypoint (empty)
│ │ ├── config.rs
│ │ ├── db/ # database connection, models, queries
│ │ ├── api/ # axum handlers (auth, cases, judges, etc.)
│ │ ├── scraper/ # web scraper for court judgments
│ │ ├── notifications/ # email/push
│ │ └── middleware/ # JWT, logging
│ ├── migrations/ # sqlx migration files (all 5 tables)
│ └── .env
│
├── frontend/ # Next.js 14 (App Router)
│ ├── src/
│ │ ├── app/ # pages and layouts
│ │ ├── components/ # shared components (Navbar, AuthGuard, etc.)
│ │ ├── lib/ # api client, types
│ │ └── ...
│ ├── public/models/ # 3D judge models (.glb) – placeholder
│ └── .env.local
│
├── mock-api.js # Temporary Node server for frontend development
├── docker-compose.yml # (optional) PostgreSQL + backend + frontend
└── README.md # this file

text

---

## Getting started (development)

### Prerequisites
- Node.js 18+
- Rust (latest stable)
- PostgreSQL (local, with a database named `jamaican_law`)
- cargo-watch (optional, for hot‑reloading the backend)

### 1. Clone & install dependencies
```bash
git clone <repo-url>
cd jamaican-law-app

# Frontend
cd frontend
npm install
npx shadcn@latest add button card badge dropdown-menu dialog form input separator skeleton
cd ..

# Backend (just to have the Rust toolchain ready)
cd backend
cargo fetch
cd ..
2. Start the mock API (because backend is not ready)
bash
# In project root
node mock-api.js
This runs on http://localhost:3001/api. It returns fake data for all required endpoints.

3. Start the frontend
bash
cd frontend
npm run dev
Open http://localhost:3000.

4. Authenticate (development only)
Open your browser console on the login page and run:

js
localStorage.setItem('token', 'fake-jwt-token-for-development');
Then navigate to / – you’ll see the dashboard.

Environment variables
Frontend (frontend/.env.local)
text
NEXT_PUBLIC_API_URL=http://localhost:3001/api
Backend (backend/.env – will be used later)
text
DATABASE_URL=postgres:///jamaican_law
JWT_SECRET=change-me-in-production
SCRAPER_INTERVAL_HOURS=6
Database migrations (already applied)
Tables: users, judges, judgments, user_cases, notifications
Managed by sqlx-cli. To re‑run on a fresh DB:

bash
cd backend
sqlx migrate run --database-url "postgres:///jamaican_law"
What’s missing / Next steps
Backend implementation: Build the Axum routes, JWT authentication, sqlx queries.

Scraper: Pull judgments from the Jamaican court website and store them.

3D Judge Cards: Create Blender scenes → export as .glb → place in frontend/public/models/ → implement JudgeCard3D.tsx with React Three Fiber.

Notifications: Email/push integration.

Deployment: Dockerise backend, deploy frontend to Vercel, database to a cloud provider.

Team notes
The mock-api.js file is a temporary bridge. Remove it once the real backend is live.

All frontend code expects a token in localStorage. The real API must return a JWT on login.

3D judge models can be worked on in parallel – just name the files judge_{id}.glb and the frontend will pick them up.

For any new shadcn/ui components, run npx shadcn@latest add <name> from the frontend directory.

text

---

 

               .
              /=\\
             /===\ \
            /=====\' \
           /=======\'' \
          /=========\ ' '\
         /===========\''   \
        /=============\ ' '  \                                  
       /===============\   ''  \
      /=================\' ' ' ' \
     /===================\' ' '  ' \
    /=====================\' '   ' ' \
   /=======================\  '   ' /
  /=========================\   ' /
 /===========================\'  /
/=============================\/
