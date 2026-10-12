# Talha Bahtiyar — Agentic Studio

Interactive Three.js portfolio studio built with React and Vite.

## Local development

```sh
pnpm install
pnpm dev
```

## Checks and production build

```sh
pnpm typecheck
pnpm test
pnpm build
```

## GitHub Pages

The Pages workflow typechecks, runs the Chromium and WebKit browser suite, builds for `https://talhabahtiyar.com/`, and deploys the artifact when changes reach `main` or `master`. It can also be started from the Actions tab with **Build and deploy to GitHub Pages**.

Before the first deployment, set the repository’s **Settings → Pages → Build and deployment → Source** to **GitHub Actions**, and configure `talhabahtiyar.com` as the custom domain. The build uses the root path because the custom domain is served from `/`.
