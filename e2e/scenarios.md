# Dialer scenarios

Run against the local backend (see README). Times assume it is currently business hours somewhere in the US; use `/__open_zone` and `UPDATE call_leads SET timezone = '<zone>'` when seeding.

## The rep (`rep@xtenzium.com`)

| # | Do | Expect |
|---|---|---|
| 1 | Sign in | Lands on Dialer home, name in the header |
| 2 | Import a CSV with: a tier column (A/B/C/D/E), an Excel-ruined phone (`2.12555E+09`), a non-US number, an unreadable number, a duplicate phone, a look-alike company, a website that is a facebook.com page, social columns | Preview counts each; D shown as parked; setting E to "Don't import" drops it; the Excel warning appears; after import the list shows its totals and the message says why rows were skipped |
| 3 | Start calling | Highest tier/score first; *Calling from (407) 243-8456* strip; clock shows the prospect's time; social links and file details visible |
| 4 | `Shift+1` | No answer logged instantly, next lead shown, dial counter +1 |
| 5 | `6`, type a note with `@Sharab`, Enter | Lead → follow-up; deal created; email task assigned to Sharab; notifications for the mention and the deal owner |
| 6 | `S` on a lead, reload | Not served again; the "Skipped … back tomorrow" bar offers Undo skip; it returns at the next 12:00 Pakistan time, not at midnight |
| 7 | `Z` | Last call undone (activity removed, lead back to its previous state) |
| 8 | Hold or triple-press `Shift+1` | Exactly one call logged |
| 9 | Two tabs on the same lead, log in both | One call recorded |
| 10 | *Incoming call*: a known number (any format) | Found, with its earlier calls; *Work this lead* |
| 11 | *Incoming call*: unknown number + company + contact | Lead created ("Inbound" badge), contact details carried; logging it returns the queue to the lead the rep was on |
| 12 | *Wrong number? Edit* with another lead's number, then a free one | Refused with a clear message; then saved |
| 13 | Tick *Parked (D)* only | The parked lead is served; untick → not served |
| 14 | `/__fail?on=1`, press `Shift+1` | "Couldn't reach the server — that call is NOT logged yet"; nothing logged; works again once restored |
| 15 | `/__401?on=1`, press `Shift+1` | "Your login was just renewed — press it again"; exactly one refresh; second press logs |
| 16 | `/__revoke?on=1` + `/__401?on=1`, press `Shift+1` | Signed out cleanly to the login page with the explanation banner |
| 17 | Break the queue summary (see below) | The screen keeps working, or shows the "This screen hit a problem — Reload" panel; never blank |
| 18 | Phone width (375 px) | Everything wraps; no horizontal scroll |

To break the queue summary for scenario 17: `CREATE OR REPLACE FUNCTION public.dialer_list_summary() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT '{"broken":true}'::jsonb $$` via `/__sql`, reload, then restore the original definition.

## The owner (`owner@xtenzium.com`)

| # | Do | Expect |
|---|---|---|
| 20 | Settings → Follow-up email links: set the booking and portfolio links | Saved; only `http(s)://` accepted |
| 21 | Inbox → open the follow-up the rep handed over | The email is filled in: first name, company, **Select a time** and **Portfolio** as links, *Sharab K.* signature |
| 22 | Same, before the links are set | A warning, and *Mark sent* is disabled |
| 23 | *Copy for Zoho*, paste into the Zoho editor | The two links paste as clickable links |
| 24 | *Mark sent* | Task done; a nudge is scheduled for 10:00 their time in 3 business days |
| 25 | When the nudge is due (set `nudge_due_at` in the past) | It appears in the Inbox as "Nudge — no reply yet" with the nudge template; *Mark nudge sent* schedules one last nudge, then none |
| 26 | *They picked a time? Log the meeting* | Lead → Meetings, deal → Qualified, nudges stop |
| 27 | Reports, Board, Outreach, Feed, Summary | Render; Reports has *By segment* |
