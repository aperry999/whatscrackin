# whatscrackin.us

The What's Crackin' website, phase 1: homepage with Orlando signup, city requests with the public counter, a trip-list waitlist, and the admin panel.

## What's in it

- `/` homepage. The city dropdown lists every city marked Live in admin, preselecting the nearest one for visitors close to it. "My city isn't listed" turns the signup into a city request.
- `/trips` trip lists landing page with a "tell me when it launches" waitlist (paid trips are phase 2).
- `/admin` sign-in by emailed link. Cities, goals, live/waiting status, launch settings, exports, and team invites (owners and editors).

## Going live on Vercel

1. **Put the code on GitHub.** Create a private repo and push this folder to it.
2. **Import it into Vercel.** New Project, pick the repo, keep the defaults (Next.js is detected).
3. **Add a database.** In the Vercel project, open Storage, add Neon Postgres and connect it to the project. That sets `DATABASE_URL`.
4. **Set environment variables** (Settings > Environment Variables), using `.env.example` as the list:
   - `SESSION_SECRET`: a long random string
   - `SITE_URL`: `https://whatscrackin.us`
   - `SENDGRID_API_KEY` and `EMAIL_FROM`
   - `BEEHIIV_API_KEY` and `BEEHIIV_PUBLICATION_ID` (beehiiv Settings > Integrations > API)
   - `EVENTS_FEED_URL` (see below)
5. **Create the tables and your owner account**, once, from a computer with Node installed:
   ```
   npx vercel env pull .env.local
   DATABASE_URL="(value from .env.local)" OWNER_EMAIL=you@example.com npm run db:setup
   ```
   This also adds Orlando as the first live city.
6. **Redeploy** so the variables take effect, then sign in at `/admin/login`.

## Domain and email setup

Order matters so the newsletter never goes offline:

1. **Move beehiiv to `read.whatscrackin.us`.** In beehiiv's custom domain settings, change the web domain to the subdomain and add the DNS record it gives you at Namecheap. Wait until beehiiv shows it as verified.
2. **Point the root domain to Vercel.** In Vercel, add `whatscrackin.us` and `www.whatscrackin.us` under Settings > Domains. Vercel shows the exact records to add at Namecheap. Replace the old beehiiv records for the root domain with those.
3. **Authenticate the domain in SendGrid** (Settings > Sender Authentication > Authenticate Your Domain) and add its CNAME records at Namecheap. Use an API key with only Mail Send permission for this site, separate from anything Crackem uses.

## Event feed

The homepage "This week" board reads a JSON feed from the existing event engine, refreshed hourly. The feed is either a list of events or `{ "events": [...] }`, each in the same shape as the What's Crackin' Events page:

```json
{
  "city": "orlando",
  "venue": "Toll Road Brewing Company",
  "date": "2026-10-20",
  "time": "18:15",
  "title": "Not So Serious Run Club",
  "cat": "fitness_run_club",
  "link": "https://www.instagram.com/p/...",
  "weekly": true,
  "featured": true
}
```

`city` matches a live city's name (lowercase, dashes for spaces). `featured` marks CBC breweries, which get the highlighted rows. The board shows six events across the next seven days: up to three featured, no more than two per day, timed events before all-day specials.

## Running it locally

```
npm install
cp .env.example .env.local   # fill in DATABASE_URL and SESSION_SECRET at minimum
npm run db:setup
npm run dev
```

Without SendGrid or beehiiv keys (and outside production), sign-in links and signups are printed to the terminal instead of sent. For a local event feed, set `EVENTS_FEED_FILE` to a JSON file path.
