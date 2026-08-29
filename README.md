# Adrien Vergne — CV site

Static one-page CV, no framework, no backend, no trackers. Industrial engineering aesthetic
(dark graphite, signal amber, technical mono accents), with a clean print stylesheet for
PDF export via the "Print / PDF" button.

## Structure

```
index.html          the whole page (hero, profile, experience, projects, skills, education, contact)
assets/styles.css   design system + print styles
assets/app.js       scroll progress, active nav, reveal animations, project filters, print
```

## Local preview

```bash
python3 -m http.server 8000
# → http://localhost:8000
```

## Deploy

Any static host works (GitHub Pages, Cloudflare Pages…). Nothing to build.

```bash
git add .
git commit -m "…"
git push origin main
```
