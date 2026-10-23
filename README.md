# Einrichtungsplaner WE 13

Windows-Desktop-Anwendung zum maßstabsgetreuen Möblieren und Gestalten der Wohnung **WE 13** in 2D und 3D –
mit Katalog hochwertiger Produkte von **Westwing, IKEA und JYSK** und den vier vollständig übernommenen
Möblierungskonzepten.

## Funktionen

| Bereich | Umfang |
|---|---|
| Grundriss | exakt aus der Vektor-PDF rekonstruiert (Wandpolygone, Raumpolygone, 16 Öffnungen mit Rohbaubreiten, 8°-Flügel), Raumhöhe 2,56 m, Flächen identisch mit den Raumstempeln |
| 2D-Plan | maßstäblich (cm), Fang an Raster und Wänden (wandbündig), Drehen mit 15°/8°-Raster, Größenänderung, Abstandsmaße zu den Wänden, Messwerkzeug, Mehrfachauswahl, Kollisionsanzeige, Positionsnummern |
| 3D | PBR-Materialien (CC0-Texturen), Sonnenstand nach Uhrzeit, Abendlicht mit Leuchten, Ambient Occlusion, Wandschnitt (voll/Schnitt/flach), Rundgang (WASD), Türen öffnen, Ziehen von Objekten in 3D |
| Katalog | 2.255 Produkte (Westwing, IKEA-Designserien, JYSK-Premiumklasse, Designleuchten, OBI-Wandpaneele), Varianten, Maße, Preise, Shop-Links, Vorschaubilder aus den 3D-Modellen, Filter „Premium“ |
| Konzepte | alle Positionen der vier Konzepte (Travertin·Kupfer·Salbei, Espresso·Petrol·Chrom, Stone·Petrol·Salbei, Ivory·Petrol·Messing) lagegenau, Budgets centgenau wie in den PDFs |
| Gestaltung | Wandfarbe (Alpina, Schöner Wohnen, Farrow & Ball u. a.), Kalkfarbe, Tapeten, Holzlamellen, Holzpaneele, Kassetten-Vertäfelung, Fliesen, Naturstein, Mikrozement, Sockelzone; Bodenbeläge (Dielen, Fischgrät, Chevron, Fliesen …), Deckenfarbe – je Raum oder je einzelner Wand |
| Bearbeiten | Tauschen gegen passende Alternativen (gleiche Kategorie, ähnliche Maße, Rückseite bleibt an der Wand), Farben/Materialien je Bauteil, Ausführungsparameter, Stückliste, Undo/Redo, Autosave |
| Budget | nach Raum/Händler, Rahmen, Einkaufsliste CSV (Excel), Druck/PDF |
| Export | Projektdatei `.we13`, 3D-Ansicht PNG, Grundriss SVG, eigene GLB-Modelle importieren |

## Installation (Windows)

Der Installer (`*.exe`, NSIS, bzw. `*.msi`) wird von GitHub Actions gebaut
(Workflow **Windows-Build**, Artefakt *Einrichtungsplaner-WE13-Windows*; bei Tags `v*` als Release).
WebView2 wird bei Bedarf automatisch nachinstalliert.

## Entwicklung

```bash
cd app
npm ci
npm run dev          # Browser: http://localhost:1420
npm run tauri:dev    # Desktop-Fenster (Rust + WebView2)
npm run tauri:build  # Installer (Windows)
npx vitest run       # Tests (Geometrie, Budgets, Katalog)
```

Architektur: Tauri 2 (Rust) · React 19 · TypeScript · three.js / React Three Fiber · Zustand · Tailwind CSS 4.

## Daten-Pipeline (`tools/`)

| Skript | Zweck |
|---|---|
| `extract_floorplan.py` | Grundriss-PDF → `app/src/data/apartment.json` |
| `extract_concepts.py` | Produktlisten der vier Konzept-PDFs (inkl. Links) |
| `extract_shapes.py` | Möbelformen/Positionen aus den Möblierungsplänen |
| `build_concepts.py` | Konzeptprojekte + Konzeptkatalog |
| `research/scrape_*.py`, `enrich_ikea.py` | Händlerdaten (Westwing, IKEA, JYSK), Stand 23.10.2026 |
| `build_catalog.py` | Gesamtkatalog `app/src/data/catalog.json` |

Preise und Verfügbarkeit: Stand der Händlerseiten bzw. der Konzepte (Oktober 2026), ohne Gewähr.
Texturen, Pflanzen-/Vasenmodelle und HDRI: CC0 (ambientCG, Poly Haven), siehe `app/public/assets/LICENSES.md`.
