#!/usr/bin/env bash
# Déploie VERGNE-OS sur les deux hébergeurs :
#   - GitHub Pages   : https://teas0710.github.io/   (via git push)
#   - Cloudflare     : https://vergne.pages.dev/     (via wrangler, adresse principale)
set -e
cd "$(dirname "$0")"

git push origin main

tmp=$(mktemp -d)
cp -r index.html assets "$tmp/"
WRANGLER_SEND_METRICS=false wrangler pages deploy "$tmp" --project-name=vergne --branch=main
rm -rf "$tmp"

echo "✔ Déployé : https://vergne.pages.dev/ (+ miroir https://teas0710.github.io/)"
