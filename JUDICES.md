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
-----         |%%%%     \___       Judices    __/
           ___/\%%%%    /  --________________//
     __----     \%%%%                     ___/
    /             \%%%%                   _/
                     \%%%%              _/
                       \%%%%           /
                          \%%         |
                           |%%        |

# CourtWatch JA 🇯🇲

**Track di case dem. Stay informed.**

CourtWatch JA is a modern legal‑tech platform that makes Jamaican court
information accessible to everyone — lawyers, journalists, students, and
the public.

It automatically sources Supreme Court and Court of Appeal judgments,
weekly court lists, and Parish Court criminal case data, then presents
them through a fast, mobile‑friendly web app with powerful search, case
tracking, email notifications, and a stunning 3D Judicial Constellation.

> **Status:** Public beta (v4.3) — live at [courtwatchjamaica.com](https://courtwatchjamaica.com)

---

## ✨ Features

### For everyone
- 🔍 **Search judgments & court lists** across all Jamaican courts
- 📅 **Browse upcoming sittings** by court, division, and date
- 👨‍⚖️ **Explore the Judicial Constellation** — an interactive 3D map of
  judges and their case relationships
- 📊 **Parish Court analytics** — choropleth map, crime breakdowns,
  leaderboards
- 📄 **Download PDF summaries** — CourtWatch‑branded case summaries

### For registered users
- 📬 **Track any case number** — get notified when it appears in a
  court list or a new judgment is published
- ⏰ **Custom notification timing** — immediate, day‑before, morning‑of
- 🔐 **Secure authentication** — email/password + Google OAuth
- 👤 **Personalised dashboard** with time‑based greeting and display name

### For admins
- 🛠️ **Admin panel** — manage users, edit judgments, trigger scrapers,
  send announcements, toggle maintenance mode
- 📊 **Scraper monitoring** — view scraper state, skipped PDFs, deep
  scrape controls

---

## 🧱 Tech Stack

| Layer      | Technology                                      |
|------------|-------------------------------------------------|
| Frontend   | Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui, React Three Fiber |
| Backend    | Rust (Axum), async, JWT authentication         |
| Database   | PostgreSQL (via sqlx)                            |
| Scraper    | Rust (reqwest, scraper, pdf-extract, Tesseract OCR) |
| Email      | Resend (transactional email)                    |
| Scheduling | tokio-cron-scheduler                             |
| 3D         | React Three Fiber, @react-three/drei, Blender exports |
| Hosting    | Vercel (frontend), Render (backend + PostgreSQL) |

---

## 🚀 Getting Started (Local Development)

### Prerequisites
- Node.js 18+
- Rust (latest stable)
- PostgreSQL (local database named `jamaican_law`)
- Tesseract OCR (`brew install tesseract poppler`)
- A [Resend](https://resend.com) account for email testing
- A Google Cloud project for OAuth (optional for local dev)

### 1. Clone the repository
```bash
git clone https://github.com/YOUR_USER/courtwatch-ja.git
cd courtwatch-ja
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
