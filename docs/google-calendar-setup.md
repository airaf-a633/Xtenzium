# Google Calendar — one-time setup

The CRM code is done. What's left is creating a Google "OAuth client" so Google lets
the CRM book meetings on **your** calendar. Takes about 10 minutes, once.

You do this with the Google account whose calendar the meetings should land on
(currently your personal Gmail).

## 1. Create a Google Cloud project
1. Go to https://console.cloud.google.com and sign in with that Google account.
2. Top bar → project picker → **New project** → name it `Xtenzium CRM` → Create.

## 2. Turn on the Calendar API
1. **APIs & Services → Library**.
2. Search **Google Calendar API** → **Enable**.

## 3. Set up the consent screen
1. **APIs & Services → OAuth consent screen** (may be called *Google Auth Platform → Branding*).
2. User type: **External**. App name: `Xtenzium CRM`. Support email + developer email: yours.
3. **Scopes** → add exactly these three (nothing else):
   - `.../auth/calendar.events`
   - `.../auth/calendar.freebusy`
   - `openid` and `email` (these two are listed under "Google Account")
4. **Publishing status → Publish app → "In production".**

> **This step matters.** If you leave it on *Testing*, Google expires the connection every
> **7 days** and booking silently stops working. "In production" does not require Google's
> verification review for an app only you use. You will see a warning screen once when you
> connect ("Google hasn't verified this app") — click **Advanced → Go to Xtenzium CRM (unsafe)**.
> That's expected: it's your own app asking for your own calendar.

## 4. Create the OAuth client
1. **APIs & Services → Credentials → Create credentials → OAuth client ID**.
2. Application type: **Web application**. Name: `Xtenzium CRM web`.
3. **Authorized redirect URIs** → add **exactly**:

   ```
   https://www.xtenzium.com/api/google-callback
   ```
   (Add `https://xtenzium.com/api/google-callback` too if you also use the bare domain.
   It must match character for character — no trailing slash.)
4. Create. Copy the **Client ID** and **Client secret**.

## 5. Give them to Vercel
Vercel → your project (the one serving xtenzium.com) → **Settings → Environment Variables**.
Add, for Production:

| Name | Value |
|---|---|
| `GOOGLE_CLIENT_ID` | the Client ID |
| `GOOGLE_CLIENT_SECRET` | the Client secret (mark as sensitive) |

`SUPABASE_SERVICE_ROLE_KEY` should already be there. Then **redeploy** (Deployments → ⋯ → Redeploy)
so the functions pick up the new variables.

## 6. Connect
1. Run migration `022_google_calendar.sql` in the Supabase SQL editor.
2. Sign in to the CRM as an admin → **Dialer → Settings → Google Calendar → Connect Google Calendar**.
3. Approve on Google's screen. You land back in Settings showing **Connected as you@gmail.com**.
4. Check **Meeting hours** (defaults: 18:00 → 02:00 Karachi time, 30-minute meetings).

## If something goes wrong
| Symptom | Cause |
|---|---|
| "Google isn't set up on the server yet" | The two env vars are missing, or you haven't redeployed since adding them |
| Google shows `redirect_uri_mismatch` | The redirect URI in step 4 doesn't match exactly (www vs non-www, trailing slash) |
| "Google didn't grant lasting access" | You approved before without a refresh token. Remove *Xtenzium CRM* at myaccount.google.com/permissions and connect again |
| Booking stops after a week | The app is still on *Testing* — publish it (step 3.4), then reconnect |
| Settings shows "Connection lost — reconnect" | The token was revoked or expired; click **Reconnect Google** |

If the calendar is ever unavailable, the rep isn't blocked: "Meeting agreed" falls back to
typing the time, the meeting is flagged for you, and you send the invite by hand.
