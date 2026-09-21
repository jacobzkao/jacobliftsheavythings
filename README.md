# Chest Priority Log

A single-page workout logging app for chest-priority training — body-map view, weekly volume tracker, per-exercise set logging, and a rest timer. It is an installable, offline-capable PWA with a shared Neon Postgres logbook when deployed on Vercel.

## Run it locally

No build step is required. `npm start` serves the UI only; use Vercel preview/development when testing the database API.

```bash
npm install
npm start     # serves index.html at http://localhost:5173
```

Or skip npm entirely and just open `index.html` directly in a browser, or serve it with any static file server:

```bash
python3 -m http.server 5173
```

## Deploy to Vercel + Neon

The app is static except for `api/state.js`, a Vercel Function that stores one shared state record in Neon Postgres.

1. Push this folder to a GitHub repository.
2. In Vercel, import the repository and add a Neon Postgres integration from **Storage**. Vercel adds `DATABASE_URL` to the project environment.
3. Deploy with the default settings. Vercel serves the root `index.html` and deploys `api/state.js` automatically.
4. Optionally run [db/schema.sql](db/schema.sql) in Neon before the first deploy; the API also creates this tiny table on first use.

The first successful connection to an empty database starts a fresh shared logbook. Existing browser history is deliberately not imported.

## Install and offline use

After the first online visit, the app shell is cached for offline gym use. Use the in-app installation hint:

- iPhone/iPad: open the app in Safari, tap **Share**, then **Add to Home Screen**.
- Android: use the browser menu's **Install** or **Add to Home screen** action.

Test the deployed app on both platforms: install it, save a workout, reopen it, then enable airplane mode and reopen it again. Local storage caches edits made offline and sends them to the shared logbook after reconnection.

## Notes

- The deployed logbook is public read/write: anyone with the app URL can view or change it. Do not store private data there.
- `localStorage` is an offline cache, not the source of truth after deployment.
- The first load needs an internet connection. Google Fonts may fall back to system fonts while offline.
- No build tooling, frameworks, or dependencies — it's plain HTML/CSS/JS.
