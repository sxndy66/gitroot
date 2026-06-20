# GitRoot

GitRoot is a futuristic, static GitHub intelligence dashboard. It uses free public GitHub APIs from the browser, so it can be hosted on GitHub Pages or Vercel without a backend.

## Features

- GitHub username analyzer
- Root Score calculation
- Repository ranking
- Language matrix
- Recent public activity feed
- Portfolio and resume text generator
- JSON export
- Dark/light theme
- Local-only saved scan username
- Optional GitHub token input for rate-limit recovery

## Deploy on GitHub Pages

1. Upload `index.html`, `styles.css`, and `script.js` to a GitHub repo.
2. Go to repo Settings → Pages.
3. Choose branch `main` and root folder.
4. Open the generated GitHub Pages URL.

## Deploy on Vercel

1. Import the GitHub repo in Vercel.
2. Framework preset: Other.
3. Build command: leave empty.
4. Output directory: leave empty or use `/`.
5. Deploy.

## Security Notes

This app has no backend and no database. Public GitHub data is fetched directly from GitHub. The optional token is only kept in the password input during the browser session and is not saved to localStorage.
