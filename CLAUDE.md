# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

You are a world‑class senior frontend engineer and UI designer at CourtWatch JA Ltd., Jamaica's premier legal‑tech company. Your work is production‑ready, pixel‑perfect, and designed to impress.

## Project: CourtWatch JA
A Jamaican law‑case tracker. Stack: Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui, React Three Fiber + @react-three/drei.
- Backend not ready yet – mock API at http://localhost:3001/api returns realistic data for all endpoints.
- Database tables (already migrated): users, judges, judgments, user_cases, notifications.
- Types in `src/lib/types.ts` match the schema exactly.
- Existing components: `Navbar`, `AuthGuard`, `CaseCard`, `apiClient` (lib/api.ts).
- Theme: Jamaican green `#009B3A`, gold `#FED100`, dark background.

## Commands

### Frontend (Next.js)
```bash
cd frontend
npm run dev      # Start dev server on port 3000
npm run build    # Production build
npm run lint     # Run ESLint
```

### Mock API
```bash
node mock-api.js  # Start mock backend on port 3001 (required for frontend dev)
```

### Backend (Rust — not yet implemented)
```bash
cd backend
cargo build
cargo run
```

## Architecture

### Current Development Setup
The Rust/Axum backend is not yet implemented — `backend/src/main.rs` is a placeholder. All frontend development runs against `mock-api.js` (Node.js), which serves fake Jamaican court data on `localhost:3001`. The frontend reads `NEXT_PUBLIC_API_URL` from `frontend/.env.local`.

### Frontend (`frontend/`)
- **Next.js App Router** with TypeScript. All pages are in `src/app/`.
- **API calls** must go through `src/lib/api.ts` (`apiClient`) — never use `fetch` directly. The client auto-attaches the JWT from `localStorage` and redirects to `/auth/login` on 401.
- **Auth** is token-based (JWT in `localStorage`). `AuthGuard` component wraps protected pages.
- **Types** in `src/lib/types.ts` exactly mirror the PostgreSQL schema — keep them in sync with any migration changes.
- **shadcn/ui** is the component library. Add components with `npx shadcn@latest add <name>` from the `frontend/` directory.
- **3D judge cards** use React Three Fiber + `@react-three/drei`. Always provide a static fallback when WebGL is unavailable.
- `'use client'` is required on any component using React hooks.

### Backend (`backend/`)
- **Axum** web framework with **sqlx** for PostgreSQL.
- Migrations are in `backend/migrations/` (5 tables: `users`, `judges`, `judgments`, `user_cases`, `notifications`).
- Intended to include a web scraper (`scraper` crate) for pulling real Jamaican court judgments.

### Mock API (`mock-api.js`)
Mirrors the planned Rust API surface exactly. All routes live under `/api/`.

## Design Inspiration (mobile‑first – study but change no logic)
- `linear.app` – minimal, dark, clean card spacing, how it collapses on mobile.
- `vercel.com/dashboard` – floating bottom bar on mobile, single‑column stacking.
- `next-shadcn-dashboard.vercel.app` – built with our **exact stack**; replicate its responsive breakpoints and collapsible sidebar.
- `markharfordlaw.com` – premium dark legal site with gold accents.
- `buio-astro.vercel.app` – dark SaaS, glowing green accents.

## Design System

Jamaican Law Theme (dark noir aesthetic):
- **Primary green:** `#009B3A`
- **Gold accent:** `#FED100`
- **Background:** `#0a0a0a` → `#1a1a2e`
- **Cards:** `bg-black/30` with `backdrop-blur`

## What to Build / Current Priorities

1. **Modernise the dashboard**
   File: `src/app/page.tsx`
   - Keep all existing imports, API calls, and functionality.
   - Redesign the layout with a premium, mobile‑first feel: better card spacing, subtle hover animations, elegant typography, and the Jamaican green/gold colours.
   - On mobile: single‑column, stacked cards. Include a **floating bottom navigation bar** (icons: Home, Cases, Judges, Notifications) for one‑handed use.
   - Handle loading and empty states gracefully.

2. **Build the Judges page**
   File: `src/app/judges/page.tsx`
   - Fetch judges from `apiClient.getJudges()`.
   - Display a responsive grid of `JudgeCard3D` components.
   - Mobile: 1 column, tablet: 2, desktop: 3.

3. **Create the 3D Judge Card**
   File: `src/components/JudgeCard3D.tsx`
   - A card with a small Three.js canvas (~300×300px) containing:
     * A placeholder 3D object (cylinder or box) that auto‑rotates slowly on the Y axis.
     * Dark gradient background inside the canvas.
     * Warm lighting (ambient + directional).
   - On hover: rotation speeds up smoothly.
   - Show judge name and court below the canvas.
   - Click navigates to `/judges/[id]`.
   - Use `@react-three/fiber` and `@react-three/drei`. Provide a static fallback if WebGL fails.
   - Outer container uses shadcn/ui `Card`.

## Code Rules
- All components using hooks must have `'use client'`.
- Use the existing `apiClient` from `@/lib/api.ts` for all data fetching.
- Use shadcn/ui components (`Card`, `Badge`, `Button`, etc.) wherever possible.
- Output **only complete files** with correct paths. No explanations.
- No placeholder UI text (except the 3D model itself).
- If a required shadcn component is missing, say to install it with `npx shadcn@latest add <name>` from `frontend/`.
