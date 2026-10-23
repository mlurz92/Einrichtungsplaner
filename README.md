# Einrichtungsplaner WE 13

Windows-Desktop-Anwendung zum maßstabsgetreuen Möblieren und Gestalten der Wohnung **WE 13** in 2D und 3D –
mit Katalog hochwertiger Produkte von **Westwing, IKEA, JYSK, Tylko** und Designleuchten von **lampe.de**
(Artemide, Tecnolumen, Serien Lighting, Bopp, Grossmann u. a.), **Samsung The Frame** und den vier vollständig
übernommenen Möblierungskonzepten.

## Funktionen

| Bereich | Umfang |
|---|---|
| Grundriss | exakt aus der Vektor-PDF rekonstruiert (Wandpolygone, Raumpolygone, 16 Öffnungen mit Rohbaubreiten, 8°-Flügel), Raumhöhe 2,56 m, Flächen identisch mit den Raumstempeln |
| 2D-Plan | maßstäblich (cm), Drag & Drop aus dem Katalog, Wandfang (Rückseite automatisch zur Wand drehen, bündig, Eckfang, grüne Hilfslinien), Ablage auf Möbeln (Leuchten, Deko, TV), Mitbewegen aufgestellter Objekte, Ausrichten/Verteilen, Drehen mit 15°/8°-Raster, Größenänderung, Abstandsmaße zu den Wänden, Messwerkzeug, Mehrfachauswahl, Kollisionsanzeige, Positionsnummern |
| 3D | PBR-Materialien (CC0-Texturen), Sonnenstand nach Uhrzeit, Abendlicht mit Leuchten, Ambient Occlusion, Wandschnitt (voll/Schnitt/flach), Rundgang (WASD), Türen öffnen, Ziehen und Ablegen von Objekten in 3D mit gleichem Fang, Fokus per Doppelklick/F |
| Katalog | 5.093 Produkte mit 11.831 Farb-/Materialvarianten (Westwing, IKEA-Designserien, JYSK-Premiumklasse, Tylko Original/Tone/Smooth, 845 Designleuchten von lampe.de, Samsung The Frame 43–85″, OBI-Wandpaneele), Varianten, Maße, Preise, Shop-Links, Vorschaubilder aus den 3D-Modellen, Filter „Premium“ |
| Konzepte | alle Positionen der vier Konzepte (Travertin·Kupfer·Salbei, Espresso·Petrol·Chrom, Stone·Petrol·Salbei, Ivory·Petrol·Messing) lagegenau, Budgets centgenau wie in den PDFs |
| Gestaltung | Wandfarbe (Alpina, Schöner Wohnen, Farrow & Ball u. a.), Kalkfarbe, Tapeten, Holzlamellen, Holzpaneele, Kassetten-Vertäfelung, Fliesen, Naturstein, Mikrozement, Sockelzone; Bodenbeläge (Dielen, Fischgrät, Chevron, Fliesen …), Deckenfarbe – je Raum oder je einzelner Wand |
| Bearbeiten | Tauschen gegen passende Alternativen (gleiche Kategorie, ähnliche Maße, Rückseite bleibt an der Wand), Farben/Materialien je Bauteil, Ausführungsparameter, Stückliste, Undo/Redo, Autosave |
| Leuchten | Pendel über Tischen automatisch mittig/in Tischachse und 65 cm über der Platte, sonst ≥ 2,00 m Durchgangshöhe; Deckenleuchten fangen die Raummitte; Wandleuchten docken an (Mitte ≈ 1,70 m); Tischleuchten stehen auf Ablagen; Abendlicht mit realen Lichtpunkten |
| TV | Samsung The Frame: Wandmontage (Slim-Fit) oder Standfuß auf Sideboard/Lowboard, Art Mode, Wechselrahmen |
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
| `research/scrape_*.py`, `enrich_ikea.py` | Händlerdaten (Westwing, IKEA, JYSK, Tylko-Feed über ladendirekt, lampe.de), Stand 23.10.2026 |
| `build_catalog.py` | Gesamtkatalog `app/src/data/catalog.json` (Ausführungstexte → Bauteilfarben über `finish.py`) |
| `finish.py`, `test_finish.py` | Farb-/Materialparser für Händler-Ausführungen (IKEA-Bezugsnamen, Holzarten, Stein, Glas, Metall) inkl. Regressionstests |
| `audit_catalog.py` | Qualitätsprüfung: Variantenname ↔ Farbe, gleich aussehende Varianten, Maße je Archetyp |

Preise und Verfügbarkeit: Stand der Händlerseiten bzw. der Konzepte (Oktober 2026), ohne Gewähr.
Texturen, Pflanzen-/Vasenmodelle und HDRI: CC0 (ambientCG, Poly Haven), siehe `app/public/assets/LICENSES.md`.
