# GymLog

Personal gym logger. Theme C2 "Commander". Offline PWA, hosted on Firebase, data synced through Firestore.

- `js/seed.js`: the 4-day program and exercises
- `js/store.js`: storage. The device's localStorage is the instant, offline copy the UI uses
- `js/sync.js`: optional Firestore mirror + Google sign-in (the app works without it)
- `js/firebase-config.js`: Firebase web config for project `wo-cmd` (not a secret)
- `js/logic.js`: targets, rotation, sessions (theme-independent)
- `js/app.js` + `css/c2.css`: the C2 interface

## How sync works

- Sign in under Settings → Sync. Until then data stays on the device only.
- Firestore layout: `users/{uid}/data/config` (exercises, workouts, settings) and `users/{uid}/sessions/{start}` (one doc per workout).
- Logging works offline; changes queue and upload when back online. Last write wins.
- First time a device meets the account, the side with the newer workout supplies the config, and any sessions only this device has are uploaded.
- Appearance (light/dark) stays per device.
- `firestore.rules`: a user can only read and write their own `users/{uid}` data.

## Deploy

Merging to `main` runs `.github/workflows/deploy.yml`, which deploys hosting and the Firestore rules to project `wo-cmd`.
One-time setup: a Google service account key stored as the GitHub secret `FIREBASE_SERVICE_ACCOUNT`.
Sign-in only works on authorised domains (Firebase console → Authentication → Settings → Authorized domains); `wo-cmd.web.app` and `wo-cmd.firebaseapp.com` are there by default.

Bump `VERSION` in `sw.js` on every release.

Notes for later: theme A as a skin, swipe-to-skip on collapsed rows, illustrations.
