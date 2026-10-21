# MC Picker

A static lab-meeting MC picker with equal chances for every eligible member.

## Features

- Animated name reel and confetti for the selected MC.
- Manual exclusion list: add names or restore them with the × button.
- Add new members directly from the page, or edit the full roster.
- Names are displayed without parentheses or their contents.
- Member lists and exclusions are shared with all visitors. Everyone can edit. Recent picks remain local to each browser.
- Picking someone does not automatically exclude them.

## GitHub Pages

The included workflow publishes `web/` whenever `main` changes. In the repository's **Settings → Pages**, select **GitHub Actions** as the publishing source. No build or dependency installation is required.

For a repository named `mc-picker` owned by `ichi131`, the expected Pages address is `https://ichi131.github.io/mc-picker/`. This address is only live after GitHub Pages reports a successful deployment.

## Editing

- `web/index.html` — page structure
- `web/style.css` — appearance and animation styles
- `web/app.js` — member management, draw interactions, and celebrations
- `web/random.mjs` — unbiased random selection and name normalization

The default members are listed near the top of `web/app.js`. Visitors can edit the shared member list directly on the website without editing the repository.

## Shared data

All visitors read and edit the same member and exclusion list, stored in a Cloudflare D1 database behind the existing Sites Worker. The public website remains on GitHub Pages. The page checks for changes every three seconds and refreshes the pool immediately before a draw. A revision check rejects stale writes instead of overwriting another visitor's update. Each browser receives a short-lived public editing session. There is no account login requirement.

A visitor with a previous browser-local list can explicitly import it. Importing replaces the shared member and exclusion list; it does not happen automatically. Recent picks remain browser-local. Picking a member never automatically excludes them.

## Backend source

- `worker/index.js` — shared read/write API, public edit sessions, and embedded page serving.
- `drizzle/0000_shared_state.sql` — D1 schema migration.
- `.openai/hosting.json` — existing backend Site identity and D1 binding.
- `scripts/build-backend.mjs` — bundles the Worker and embeds the frontend assets.

The backend requires the runtime secret `MC_SESSION_SECRET`, stored in the hosting environment, never in this repository. Build with `node scripts/build-backend.mjs` and validate with `node scripts/validate-artifact.mjs`. Publishing the backend uses the Sites workflow for the existing project. GitHub Actions publishes only the public `web/` frontend.
