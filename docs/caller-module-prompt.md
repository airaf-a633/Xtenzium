# Build Prompt — Cold-Calling Module ("Dialer") for Xtenzium CRM

## Context
You are working in the Xtenzium CRM (`Xtenzium-crm/`): React + TypeScript + Vite, Supabase (auth, Postgres, RLS, Edge Functions), `@dnd-kit/core`, react-router-dom. Live at https://www.xtenzium.com/crm.
Existing pieces to reuse, not duplicate: `src/lib/csv.ts`, `src/lib/deals.ts`, `src/lib/tasks.ts`, `src/lib/notifications.ts`, `src/lib/realtime.ts`, `src/context/AuthContext.tsx`, `src/pages/crm/pipeline/*`, migrations in `supabase/migrations/` (latest is `015_*`).

**Business model:** Xtenzium sells white-label dev capacity to other agencies ("instead of one hire, you get a whole team for the same price"). One business developer (BD) cold-calls US agencies using Google Voice from Pakistan. Admins (Airaf + team) handle all email follow-ups and closing.

**Goal:** give the BD their own login with a focused calling workspace. They import lead lists, call, log outcomes in one click, and book meetings on Google Calendar. Admins see everything, work an "email follow-up queue", and get meetings as deals.

### Target flows (source of truth)
**Rep:** 1) Upload CSV → mapped, validated, deduped, imported as a batch. 2) Call Screen: one lead at a time, big phone number (Copy + "Open in Google Voice"), pitch context, outcome buttons with keyboard shortcuts. 3) Click outcome (+ optional note) → rules apply (retry date, email task, status change) → auto-advance to next callable lead. 4) Interested leads → Book Meeting modal with owner's real availability → Google Calendar event with Meet link.
**Owner/admin:** "Needs your action" inbox (email follow-ups to send, interested leads, upcoming meetings, flagged callbacks); live feed of the rep's calls and notes; batch/tier analytics; editable email templates, call scripts, settings. Interested leads automatically become deals in the existing pipeline.

### Decisions locked
- Meetings: on owner's calendar; **rep is also invited** (they do the formal intro of the owner on the call).
- Daily dial target: default 80, **editable per rep by any admin** in Settings → Team.
- **Both admin and rep can import** CSVs.
- **No call duration tracking.**

Do this first: read the codebase, then present a phased plan (tables, not prose) and **wait for approval before writing code**.

---

## 1. Roles & security (do this first — it's a blocker)
Current RLS is `TO authenticated USING (true)`, so any logged-in user sees everything (deals, money, analytics, settings). Fix before creating the BD account.
- Add `profiles` (`id` = `auth.users.id`, `full_name`, `role` enum `admin | caller`, `timezone`, `daily_dial_target` int default 80).
- Add a SQL helper `is_admin()` (security definer). Rewrite existing policies to `is_admin()`. Caller gets access only to the new dialer tables, through their own policies.
- Frontend: load the role in `AuthContext`. Callers land on `/crm/dialer` and can't route to anything else (route guard + hidden nav). Admins see everything plus the new screens.
- Admin creates the BD's account from Settings → Team (Supabase admin invite via an Edge Function). No public sign-up.

## 2. Data model (new migration `016_dialer.sql`)
- `call_lists` — id, name, uploaded_by, source_filename, row_count, created_at.
- `call_leads` — id, list_id, company_name, phone_raw, phone_e164, phone_is_us, email, website, contact_url, profile_url, hq, state, timezone (IANA, derived), team_size, hourly_rate_usd, services, tier, score, why (talking points), source, `extra jsonb` (any unmapped CSV columns), contact_name, contact_title (BD fills in), status (enum below), attempt_count, last_called_at, next_call_at, assigned_to, deal_id (nullable), created_at. Unique index on `phone_e164` and a normalized website domain, for dedupe.
- `call_activities` — id, lead_id, caller_id, outcome, reason_tags text[], note, flagged bool (rep can flag for owner attention), created_at.
- `email_templates` — id, name, type (matches followup type), subject, body with merge fields (`{{company_name}}`, `{{contact_name}}`, `{{website}}`, `{{rep_note}}`), updated_by. Admin-editable.
- `call_scripts` — id, title, section (`opener | pitch | objection`), body, sort_order. Admin-editable, shown on the Call Screen. Append-only, so it's the audit trail.
- `followup_queue` — id, lead_id, type (`email_info | email_proposal | linkedin | admin_call`), requested_by, note, status (`queued | sent | done | cancelled`), handled_by, handled_at.
- `meetings` — id, lead_id, deal_id, google_event_id, starts_at, ends_at, attendee_email, meet_link, booked_by, status (`scheduled | held | no_show | rescheduled | cancelled`).
- `dnc_list` — phone_e164, domain, reason, added_at. Checked on import and before showing a lead.

## 3. CSV import (caller + admin)
- Drag a CSV in, then map columns. Auto-detect the headers in the sample file: `tier, score, name, phone, phone_is_us, role_email, hq, team, hourly_rate, rate_usd, website, contact_url, services, works_count, why, source, profile_url`. Show a mapping UI for unknown headers. Unmapped columns go to `extra`.
- Handle a UTF-8 BOM and quoted commas. Normalize phones to E.164 (`libphonenumber-js`, default US). Derive the timezone from the US state in `hq`.
- Preview step: N new, N duplicates (existing phone/domain), N on DNC, N invalid phones. The user confirms, then a batched insert.
- Must handle 2,000+ rows smoothly (chunked inserts of 500).

## 4. Caller workspace `/crm/dialer` — the core screen
The BD should be able to do 80–120 dials a day with almost no clicking.

**Call Mode (default view): one lead at a time, from a smart queue.**
- Queue order: callbacks due now → `new` leads by tier/score → retry leads whose `next_call_at` has passed. **Only show leads whose local time is 9:00–17:00 on a weekday.** Show a "their local time" clock on each lead.
- Lead card: company, phone (big), **Copy** button, **Open in Google Voice** button (`https://voice.google.com/u/0/calls?a=nc,%2B1XXXXXXXXXX`; verify it works and keep Copy as the fallback), website, profile link, team size, rate, services, the `why` field as talking points, and past attempts and notes.
- Collapsible **pitch script and objection snippets** panel. Content is editable by admin in Settings.
- Outcome = **one-click buttons + keyboard shortcuts (1–9)**. Each opens an optional note box with quick-tag chips. Save goes straight to the next lead.
- Optional "skip" (goes to the back of the queue, no attempt counted).

**Board view (drag & drop):** a kanban of the same leads, using `@dnd-kit`. Columns are status groups. Dropping a card opens the same outcome/note modal. It's for review and cleanup, not the main calling flow.

**My Day header:** dials today / target, connects, conversations, meetings booked, callbacks due. Updates live.

### Outcomes → automatic status and next step
| Outcome | Status | Auto action |
|---|---|---|
| No answer | `retry` | next_call_at = +1 business day, rotating time of day |
| Voicemail left | `retry` | +2 business days |
| Gatekeeper — got name/ext | `retry` | capture contact name, +1 day |
| Gatekeeper — blocked | `retry` | +3 days |
| Callback requested | `callback` | date/time picker (in *their* TZ), required |
| Interested — send info | `followup` | creates `followup_queue` (email_info) |
| Interested — wants proposal/pricing | `followup` | creates `followup_queue` (email_proposal), flags hot |
| Meeting booked | `meeting` | opens the booking flow (section 5) |
| Not interested — has in-house dev | `lost` | reason tag |
| Not interested — already outsources | `nurture` | re-call in 90 days |
| Not interested — bad timing/budget | `nurture` | re-call in 60 days |
| Not a fit (not an agency / too small) | `disqualified` | — |
| Wrong / disconnected number | `bad_data` | — |
| Do not call | `dnc` | adds to `dnc_list`, permanent |

Rule: after **6 attempts with no conversation**, move to `exhausted` and push to the email queue as a last touch. Admin can edit the cadence and outcome list in Settings.

Quick-tag chips for notes: "Asked for email", "Decision maker is ___", "Uses offshore already", "Price sensitive", "Busy — call morning", "Wants case studies", "Has WordPress needs", "Has app/React needs".

## 5. Google Calendar booking
- Admin connects **one** Google account (currently personal Gmail) in Settings via OAuth. Scope is `calendar.events` + `calendar.freebusy`. Store the refresh token **server-side only** (Supabase table readable only by the service role, or Vault). All Google calls run in an Edge Function. The BD never touches Google auth.
- Note: OAuth apps in "Testing" status lose refresh tokens after 7 days. Set the consent screen to "In production" (unverified is fine for internal use). Show a "reconnect" banner if the token fails.
- Booking modal (from the "Meeting booked" outcome): the prospect's name and email (prefilled from lead), and a duration (30 min default). Show free slots for the next 10 business days from free/busy, displayed in **both PKT and the prospect's TZ**. Creating the meeting makes an event on the admin's calendar with a Google Meet link, sends invites to the prospect **and the rep** (rep email from `profiles`; the rep joins to give the formal intro), and puts the BD's notes and lead link in the description.
- **Deal creation happens on any "interested" outcome** (send info, wants proposal, meeting booked), not only on meetings. Use `src/lib/deals.ts`, set `deal_id` on the lead, and don't create duplicates: if the lead already has a deal, move it to a later stage instead. Map stages: send info → early stage, proposal → qualified, meeting → meeting stage. Confirm the stage names against the existing pipeline.
- On booking success: insert `meetings`, set the lead to `meeting`, advance the deal, and notify admins (reuse `notifications.ts`).
- Admin can mark a meeting held / no-show / rescheduled. A no-show sends the lead back to the BD's queue as `callback`.

## 6. Admin side
- **"Needs your action" inbox** `/crm/inbox` (admin home for this module, badge count in nav). Tabs: Email follow-ups (queue items, with the matching template rendered with merge fields, plus **Copy subject/body** and **Open in Gmail compose** (`mailto:` or the Gmail compose URL); actions: mark sent, done, cancel) · Interested leads · Upcoming meetings (next 7 days) · Flagged callbacks (rep-flagged activities).
- **Live feed** `/crm/dialer/feed`: realtime stream of the rep's `call_activities` (outcome, note, lead link), via `realtime.ts`. Filter by rep, outcome, date.
- **Settings → Dialer:** email templates CRUD, call scripts CRUD, outcome cadence rules, and per-rep daily dial target.
- **Dialer Reports** `/crm/dialer/reports`: per day/week dials, connect rate, conversation→meeting rate, outcome breakdown, and results by tier, source, and list. Also best hours to call (by prospect local time), and the meeting → deal → won funnel.
- **Lead admin:** reassign, bulk-edit status, export to CSV, archive lists, manage DNC.

## 7. Non-goals (do not build)
Commission tracking, AI features of any kind, call duration/recording, in-app VoIP/dialing, email sending from the CRM (emails are sent manually from the queue for now).

## 8. Acceptance criteria
- A caller account can't read deals, clients, projects, analytics, or settings at the **DB level**. Verify with a caller JWT against the Supabase REST API, not just the UI.
- Importing the sample `CALL_LIST.csv` (2,080 rows) completes with a correct dedupe report.
- In Call Mode, logging an outcome and moving to the next lead takes ≤ 2 interactions (key press + Enter).
- The queue never shows a lead outside 9–17 in its local time.
- Booking creates a real Calendar event with a Meet link and an invite. A deal appears in the pipeline.
- `npm run build` and lint pass. Migrations are idempotent like the existing ones.
