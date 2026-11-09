# Local mock test — notifications & scan alerts

How the alert pipeline was exercised locally on 2026-11-09, without sending
real email or scraping the live court sites. Everything here is local-only.

## Servers (`.claude/launch.json` at the repo root)

| Name | What it runs |
| --- | --- |
| `courtwatch-backend-mock-email` | `cargo run` with `SKIP_STARTUP_CATCHUP=1` and `RESEND_API_KEY=re_mock_local_test` |
| `courtwatch-frontend` | `npm run dev` on port 3000 |

- `SKIP_STARTUP_CATCHUP=1` boots straight to the scheduler and skips the
  startup catch-up scrape (the local DB is months old, so catch-up would
  otherwise hit every court website).
- The mock Resend key makes every send fail with `401 API key is invalid`.
  The backend log still shows exactly which email it *tried* to send, to whom,
  with what subject — which is the point of the mock.
- Postgres 18 via Homebrew must be running (`brew services start postgresql@18`).
  Database: `jamaican_law`.

## Test account (local DB only)

| Field | Value |
| --- | --- |
| Email | `mocktest@localhost.test` |
| Password | in `backend/.env.mock.local` (git-ignored; local machine only) |
| Role | `admin` (needed for the manual trigger below) |
| Tracks | three existing court sittings (`user_cases` rows 32–34) |

Created directly in the local DB with a bcrypt hash from `htpasswd -nbB`; no
verification email was sent. The account does not exist anywhere else.

## Triggering a notification pass by hand

```bash
source backend/.env.mock.local   # sets MOCK_TEST_PASSWORD
TOKEN=$(curl -s -X POST localhost:3001/api/auth/login -H 'Content-Type: application/json' \
  -d "{\"email\":\"mocktest@localhost.test\",\"password\":\"$MOCK_TEST_PASSWORD\"}" | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])')
curl -s -X POST localhost:3001/api/admin/notifications/run -H "Authorization: Bearer $TOKEN"
```

`POST /api/admin/notifications/run` (admin only) runs the notification engine
and the email dispatcher immediately, without scraping. It is what the cron
jobs and the startup catch-up call internally.

## What the run showed

- Settings → Notifications: Scan Alerts switched on, frequency **Every scan**,
  delivery **In-app + email**; `GET /api/user/preferences` returned the same.
- Manual pass inserted one `scan_complete` row:
  "3 tracked cases checked, 0 updates since your last scan alert."
- It appeared on `/notifications` with the unread badge.
- The dispatcher attempted three emails, all rejected by the mock key:
  two "has been rescheduled" (`sitting_changed`, newly emailed) for an older
  test user whose tracked sittings had moved, and one "Court scan complete"
  for the test account.
