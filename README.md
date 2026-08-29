# VERGNE-OS — CV d'Adrien Vergne

**En ligne : https://teas0710.github.io/**

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

Site utilisateur GitHub Pages : un push sur main déploie https://teas0710.github.io/ (~30 s). Rien à builder.

```bash
git add .
git commit -m "…"
git push origin main
```
