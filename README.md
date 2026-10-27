# TikTok Creator Stats

A Next.js dashboard that connects to your TikTok account and tells you **what to post and when**, based on your own numbers.

```bash
npm install
npm run dev          # http://localhost:3000 — shows sample data until you connect
```

## What it shows

| Section | What it answers |
|---|---|
| **What to do next** | Plain-language recommendations (best topics, day, time, length, cadence) |
| **Views per video** | Your last 60 videos against your typical view count |
| **When to post** | Day × time-of-day grid, plus by-day and by-time bars |
| **Topics / hashtags / length** | Which content gets above-usual views |
| **Follower growth** | Daily snapshots (TikTok only gives current totals, so history starts the day you connect) |
| **All videos** | Sortable table: views, "vs usual", engagement, share rate, comment rate |

### The one number to understand: "× usual"

Raw views are misleading. A video from 6 months ago, when you had fewer followers, will look worse than a mediocre one from last week. So each video is compared with the **median views of the ~20 videos you posted closest in time**:

- `1.0×` = typical for you at that point
- `2.0×` = twice your normal views. Do more of that.
- `0.5×` = half. Figure out why.

Videos younger than 7 days are excluded from the analysis because they're still collecting views.

## Connecting your TikTok

1. Go to <https://developers.tiktok.com>, log in, and **create an app**.
2. Add the **Login Kit** product (Web) and the **Display API**.
3. Request these scopes: `user.info.basic`, `user.info.profile`, `user.info.stats`, `video.list`.
4. **Redirect URI**: TikTok requires HTTPS and won't accept `http://localhost`. Pick one:
   - **Tunnel (easiest for local use):** `npx cloudflared tunnel --url http://localhost:3000` (or ngrok). Register `https://<tunnel-host>/api/auth/callback`.
   - **Deploy** (e.g. Vercel) and register `https://<your-domain>/api/auth/callback`. See the note on snapshots below.
5. Fill in `.env.local` (see `.env.example`). `SESSION_SECRET` is already generated.
6. While your app is unreviewed, use **Sandbox** mode and add your own TikTok account as a target user. Sandbox is enough for personal use.
7. Restart `npm run dev`, open the app **through the tunnel URL**, and click **Connect TikTok**.

Tokens are stored only in an encrypted, httpOnly cookie. Nothing goes to a database.

## Customising

- **Topics**: edit `lib/topics.ts` to match the themes you cover. This is the most useful thing to tweak.
- **Timezone**: set `TIMEZONE` in `.env.local` (for example `Europe/Paris`) so "best time" matches your audience.
- **Snapshots** are written to `.data/snapshots.json`. On Vercel the filesystem is temporary, so swap `lib/snapshots.ts` for a small database (Vercel KV, Supabase, etc.) if you deploy there.

## What the API *can't* tell you

TikTok's public API doesn't expose watch time, retention curves, traffic sources (For You vs. followers vs. search), audience demographics, or follower activity hours. Check these in **TikTok Studio → Analytics**, especially:

- **Average watch time and the retention graph** on your top 5 and bottom 5 videos. The drop-off point is where your hook or pacing fails.
- **Followers → activity by hour.** Combine it with the "When to post" grid here.
- **Traffic source → Search.** Dev content does well in TikTok search, so it's worth knowing which videos rank there.

## A weekly routine that works

1. **Monday: review (10 min).** Open the dashboard and sort "All videos" by *vs usual*. For your top 3, write down the hook (first 2 seconds), topic and format. Do the same for the bottom 3.
2. **Plan 3–5 videos.** Aim for roughly 70% proven topics/formats, 30% experiments. Post experiments at your best time slot so timing doesn't skew the result.
3. **Post consistently** in your best slots. Change one variable at a time (topic *or* length *or* time), or you won't learn which change made the difference.
4. **Reply to comments with videos.** High comment rate means people want more of that. A reply video is a ready-made idea with a built-in audience.
5. **Turn winners into series.** If something hits 2×+, make part 2 within a week while the audience remembers it.

### Signals, in rough order of importance for reach

1. **Watch time / completion** (in TikTok Studio only): strong hooks, no slow intros, show the result first.
2. **Share rate**: dev content gets shared when it's *useful* ("save this for your next interview") or *relatable* ("tag the dev who…").
3. **Comment rate**: ask a specific question ("which one would you pick?"), or say something mildly debatable.
4. **Likes** matter least of the four.
