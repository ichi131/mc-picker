# MC Picker

A static lab-meeting MC picker with equal chances for every eligible member.

## Features

- Animated name reel and confetti for the selected MC.
- Manual exclusion list: add names or restore them with the × button.
- Add new members directly from the page, or edit the full roster.
- Names are displayed without parentheses or their contents.
- Member lists, exclusions, and recent picks are saved in the current browser.
- Picking someone does not automatically exclude them.

## GitHub Pages

The included workflow publishes `dist/` whenever `main` changes. In the repository's **Settings → Pages**, select **GitHub Actions** as the publishing source. No build or dependency installation is required.

For a repository named `mc-picker` owned by `ichi131`, the expected Pages address is `https://ichi131.github.io/mc-picker/`. This address is only live after GitHub Pages reports a successful deployment.

## Editing

- `dist/index.html` — page structure
- `dist/style.css` — appearance and animation styles
- `dist/app.js` — member management, draw interactions, and celebrations
- `dist/random.mjs` — unbiased random selection and name normalization

The default members are listed near the top of `dist/app.js`. Visitors can change their own member list without editing the repository.

## Data when moving domains

Browser storage belongs to each website origin. Personal member lists, exclusions, and history from the previous domain are not automatically copied to the GitHub Pages domain. Changes remain local to each visitor's browser; they are not shared across visitors.
