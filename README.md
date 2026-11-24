# Vice Code

Un joc 3D open-world în stilul GTA: Vice City, construit în HTML/CSS/JavaScript cu [Three.js](https://threejs.org/) (inclus local în `js/vendor/`, fără alte dependențe sau build step).

## Cum rulezi jocul

Jocul folosește module ES, aşa că trebuie servit printr-un server local (nu deschis direct ca `file://`):

```powershell
python -m http.server 8000
```

Apoi deschide [http://localhost:8000](http://localhost:8000) în browser.

## Controale

- **WASD / Săgeți** — mișcare pe jos sau condus
- **E** — intră / ieși din maşină
- **Shift** — sprint pe jos

## Ce conține

- Oraş generat procedural (clădiri, parcuri, străzi) cu coliziuni
- Personaj generic 3D, maşini conduse cu fizică arcade (accelerare, frânare, virare)
- Pietoni cu AI simplă, trafic de maşini care circulă pe grilă
- Sistem de căutare (wanted level) cu poliţie care te urmăreşte
- Lanţ de 3 misiuni demo (cursă contra cronometru, fugă de poliţie, livrare VIP)

## Structură

```
index.html
css/style.css
js/
  utils.js        math/helpers
  input.js        tastatură
  world3d.js       generare oraş + coliziuni
  entities3d.js     personaj, maşini, pietoni
  missions3d.js    lanţul de misiuni
  game3d.js        bucla principală a jocului
  main.js          pornire
  vendor/three.module.js
```
