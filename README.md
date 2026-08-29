# VERGNE-OS — CV d'Adrien Vergne

**En ligne : https://vergne.pages.dev/** (miroir : https://teas0710.github.io/)

Le CV présenté comme un petit système d'exploitation jouable (thème Breeze/Kubuntu) :
fenêtres déplaçables, terminal fonctionnel (`help`, `train`, `ollama run adrien`,
`sudo hire adrien`…), boot animé façon tqdm/ollama, document `cv.pdf` imprimable.
Vanilla JS, zéro dépendance, zéro tracker.

## Structure

```
index.html          bureau, fenêtres (contenu du CV), barre des tâches, symboles SVG
assets/styles.css   thème Breeze dark + mobile + print (le doc CV seul s'imprime)
assets/app.js       window manager, boot animé, terminal, horloge, filtres
```

## Local preview

```bash
python3 -m http.server 8000
# → http://localhost:8000
```

## Deploy

```bash
git add . && git commit -m "…"
./deploy.sh    # git push (miroir GitHub Pages) + wrangler pages deploy (vergne.pages.dev)
```

Rien à builder. `deploy.sh` demande wrangler connecté au compte Cloudflare (`wrangler whoami`).
