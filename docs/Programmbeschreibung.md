# Einrichtungsplaner WE 13 – Programmbeschreibung

Version 2.5.0 · Stand 26.10.2026

Diese Beschreibung erklärt jede Fläche, jeden Schalter, jede Taste und jede Regel des Einrichtungsplaners. Sie ist
zum Nachschlagen gedacht. Den schnellsten Überblick gibt Abschnitt 1. Alle Tastenkürzel stehen zusätzlich in der
Hilfe (**F1**), und jeder Befehl ist über die Befehlssuche (**Strg+K**) erreichbar.

## Inhalt

1. [Überblick](#1-überblick)
2. [Programmfenster](#2-programmfenster)
3. [Startseite und neue Einrichtung](#3-startseite-und-neue-einrichtung)
4. [Kopfleiste und Menüs](#4-kopfleiste-und-menüs)
5. [Ansichtsfenster und Aufteilung](#5-ansichtsfenster-und-aufteilung)
6. [2D-Plan](#6-2d-plan)
7. [3D-Ansicht](#7-3d-ansicht)
8. [Ansichtsleiste der 3D-Fenster](#8-ansichtsleiste-der-3d-fenster)
9. [Linke Leiste](#9-linke-leiste)
10. [Rechte Leiste (Eigenschaften)](#10-rechte-leiste-eigenschaften)
11. [Tauschen](#11-tauschen)
12. [Platzieren, Fang und Ablage](#12-platzieren-fang-und-ablage)
13. [Einbauküche und Bestand](#13-einbauküche-und-bestand)
14. [Die vier Konzepte und der Essplatz](#14-die-vier-konzepte-und-der-essplatz)
15. [Planungs-Check](#15-planungs-check)
16. [Speichern, Dateien und Export](#16-speichern-dateien-und-export)
17. [Einstellungen](#17-einstellungen)
18. [Statusleiste, Hinweise und Dialoge](#18-statusleiste-hinweise-und-dialoge)
19. [Tastenkürzel (vollständig)](#19-tastenkürzel-vollständig)
20. [Daten, Katalog und Grundriss](#20-daten-katalog-und-grundriss)
21. [Technik, Leistung und Grenzen](#21-technik-leistung-und-grenzen)
22. [Fehlerbehebung](#22-fehlerbehebung)

---

## 1. Überblick

Mit dem Einrichtungsplaner möbliert und gestaltet man die Wohnung **WE 13** maßstabsgetreu in 2D und 3D. Der
Grundriss ist exakt aus der Vektor-PDF rekonstruiert.

- **Katalog:** 6.617 Produkte mit rund 19.500 Hersteller-Ausführungen, jede mit Preis, Shop-Link und Produktfoto.
- **Konzepte:** die vier Möblierungskonzepte, lagegenau übernommen.
- **Fest eingebaut:** die gekaufte Einbauküche **Alno 2060** (Höffner).
- **Werkzeuge:** Planungs-Check nach DIN 18011/18022, Varianten mit Vergleich, Budget mit Kaufstatus, Raumfotos und
  Export.

| Begriff | Bedeutung |
|---|---|
| **Projekt** | Möblierung, Gestaltung, Budgetrahmen, gespeicherte Kameraansichten und Varianten. Wird als `.we13` gespeichert. |
| **Objekt** | Ein platziertes Produkt (Möbel, Leuchte, Teppich, Deko, Wandpaneel …) mit Position, Drehung, Maßen und Ausführung. |
| **Ausführung** | Eine lieferbare Farb-, Stoff- oder Materialvariante des Herstellers mit eigenem Preis und Link. |
| **Bestand** | Fest zur Wohnung gehörende Objekte: Einbauküche mit Sideboard, Sanitärobjekte, Waschmaschine. |
| **Fenster** (Ansichtsfenster) | Ein Bereich in der Mitte, der einen 2D-Plan oder eine 3D-Ansicht zeigt. Bis zu vier gleichzeitig. |
| **Aktives Fenster** | Das zuletzt angeklickte Fenster. Es ist an der Akzentlinie unter seiner Kopfzeile zu erkennen. |
| **Variante** | Ein gesicherter Zwischenstand innerhalb des Projekts, der sich laden und vergleichen lässt. |

---

## 2. Programmfenster

Von oben nach unten:

1. **Kopfleiste** (Abschnitt 4).
2. **Arbeitsbereich**, von links nach rechts:
   - **linke Leiste** mit sechs Reitern (Abschnitt 9)
   - **Ansichtsfenster** (Abschnitte 5–8)
   - **rechte Leiste** mit den Eigenschaften der Auswahl (Abschnitt 10)
3. **Statusleiste** (Abschnitt 18).

**Seitenleisten:**
- Beide Leisten lassen sich ausblenden: links mit **Strg+B**, rechts mit **Strg+Umschalt+B**, oder über die zwei
  Schalter rechts in der Kopfleiste.
- Die Breite ändert man, indem man den schmalen Griff zwischen Leiste und Fenstern zieht. Hat der Griff den Fokus,
  ändern **←/→** die Breite um 10 px (mit Umschalt um 40 px).
- Breiten und Sichtbarkeit bleiben über Neustarts erhalten.

**Oberfläche:**
- Halbtransparente Glasflächen: unter Windows 11 über Mica, sonst über einem weichen Farbverlauf.
- Hell oder dunkel; „Wie Windows“ folgt dem Systemdesign, auch in der Titelleiste.
- Alle Menüs, Dialoge und Segmentschalter sind per Tastatur bedienbar: Pfeiltasten, Enter, Esc, und der Fokus bleibt
  im Dialog.
- Tooltips zeigen Tastenkürzel als Tastenkappen.

**Fenstergröße:**
- Mindestbreite für die vollständige Kopfleiste: 1.200 px.
- Fenstergröße und -position werden gespeichert.
- Vollbild mit **F11**.

---

## 3. Startseite und neue Einrichtung

### Startseite

Die Startseite erscheint beim ersten Start und über **Datei → Startseite …**. **Esc** oder das ✕ schließt sie.
Danach arbeitet man mit dem zuletzt automatisch gesicherten Stand weiter („letzter Stand (automatisch gesichert)“).

| Kachel | Wirkung |
|---|---|
| **Mit einem Konzept beginnen** | Vier Karten mit Untertitel, Titel und Beschreibung. Ein Klick lädt das Konzept vollständig. |
| **Leere Wohnung** – von Grund auf einrichten | Öffnet den Dialog „Neue Einrichtung“. |
| **Datei öffnen …** | Öffnet eine Projektdatei `.we13`. |
| **Zuletzt verwendet** | Die zuletzt geöffneten oder gespeicherten Dateien. Ein Klick öffnet die Datei. Nicht mehr vorhandene Dateien werden entfernt. |
| **Schnell zum Ziel** | Drei Merksätze: Strg+K sucht Befehle, Räume, Objekte und Produkte. Ziehen aus dem Katalog platziert, mit Rückseite an der Wand. Strg+Z macht jeden benannten Schritt rückgängig. Darunter ein Verweis auf „Alle Tastenkürzel (F1)“. |

### Neue Einrichtung (Strg+N)

Der Dialog „Leere Wohnung mit Bestand, Farbstimmung und Boden“ hat folgende Felder:

| Feld | Inhalt |
|---|---|
| Projektname | Vorgabe „Meine Einrichtung WE 13“. **Enter** legt die Wohnung an. |
| Bestand übernehmen | Schalter **Sanitärobjekte** (WC, Waschtische, Wanne, Dusche) und **Waschmaschine**. |
| Hinweis | Die Einbauküche Alno 2060 (Walnuss dunkel, Naturstein) mit Sideboard ist immer fest eingebaut. |
| Bestandsböden | Eichendielen 1,90 m. HWR, Bad und Dusche/WC: Feinsteinzeug 60 × 60 cm „Iron“. |
| Farbstimmung Wände/Decken | Warmweiß, Kalkweiß, Greige, Salbei, Terrakotta hell oder Taubenblau. |
| Boden Wohnräume | Eine der Bodenvorlagen (Abschnitt 9.2). |

**Wohnung anlegen** erzeugt das Projekt und öffnet den Reiter **Katalog**. Der Schritt lässt sich mit **Strg+Z**
zurücknehmen.

---

## 4. Kopfleiste und Menüs

Von links nach rechts:

| Element | Funktion |
|---|---|
| **App-Icon + Projektname** | Ein Klick auf den Namen benennt das Projekt um (Enter übernimmt, Esc bricht ab). „· ungespeichert“ erscheint bei offenen Änderungen. |
| **Menüleiste** | Datei, Bearbeiten, Ansicht, Konzepte, Hilfe, wie in Desktop-Programmen. Ist ein Menü offen, öffnet das Überfahren eines anderen Menüs dieses direkt. **←/→** wechselt zum Nachbarmenü, **↑/↓** wählt, **Enter** führt aus, **Esc** schließt. |
| **Rückgängig / Wiederholen** | Der Tooltip nennt den Schritt, z. B. „Rückgängig: Sofa verschieben (Strg+Z)“. |
| **Aufteilung** | Ab 1.600 px Fensterbreite sechs Symbole nebeneinander, darunter ein Klappmenü mit denselben sechs Aufteilungen (Abschnitt 5). |
| **Magnet** | Fang an Raster und Wänden an/aus. **Alt** beim Ziehen setzt ihn vorübergehend aus. |
| **Suchen …** (Strg K) | Öffnet die Befehlssuche. |
| **Budget** | Summe und Fortschrittsbalken gegen den Budgetrahmen. Ein Klick öffnet den Reiter Budget. |
| **Speichern** | Wie Strg+S. |
| **Leistenschalter** | Linke bzw. rechte Leiste ein-/ausblenden. |

Unterhalb von 1.200 px Breite werden zuerst Beschriftungen gekürzt, dann seltene Schalter ausgeblendet. Jede Funktion
bleibt über die Menüs, die Befehlssuche und die Hilfe (F1) erreichbar.

### Menü Datei

| Eintrag | Kürzel | Wirkung |
|---|---|---|
| Startseite … | – | Startseite öffnen. |
| Neue Einrichtung … | Strg+N | Dialog „Neue Einrichtung“. |
| Öffnen … | Strg+O | `.we13` öffnen. |
| Zuletzt verwendet ▸ | – | Untermenü der letzten Dateien. |
| Speichern | Strg+S | In die aktuelle Datei. Ohne Datei: wie „Speichern unter“. |
| Speichern unter … | Strg+Umschalt+S | Neuen Dateinamen wählen. |
| Exportieren ▸ | – | 3D-Ansicht als Bild (PNG) · Grundriss als Bild (PNG) · Grundriss als Vektorgrafik (SVG) · Einkaufsliste (CSV/Excel) · Einkaufsliste drucken / PDF |
| Eigenes 3D-Modell (GLB) importieren … | – | Eine `.glb`-Datei als Objekt einfügen. |
| Einstellungen … | Strg+, | Abschnitt 17. |

### Menü Bearbeiten

| Eintrag | Kürzel |
|---|---|
| Rückgängig: *Schritt* / Wiederholen: *Schritt* | Strg+Z / Strg+Y |
| Ausschneiden / Kopieren / Einfügen | Strg+X / Strg+C / Strg+V. Eingefügt wird an der Mausposition im Plan. |
| Duplizieren | Strg+D |
| Löschen | Entf. Ein Hinweis bietet „Rückgängig“ an. |
| Alles auswählen | Strg+A |
| Tauschen (Alternativen mit Vorschau) … | T |
| Sperren / Entsperren · Ausblenden / Einblenden | L · H |
| Fang an Raster und Wänden (Häkchen) | Alt hält ihn beim Ziehen an. |

### Menü Ansicht

| Eintrag | Kürzel | Wirkung |
|---|---|---|
| Schnellwahl: Nur 2D-Plan | 1 | Ein Fenster mit Plan. Ein vorhandenes Planfenster wird wiederverwendet, seine Einstellungen bleiben. |
| Schnellwahl: 2D-Plan und 3D nebeneinander | 2 | Zwei Fenster, links Plan, rechts 3D. |
| Schnellwahl: Nur 3D-Ansicht | 3 | Ein Fenster mit 3D, mit Kamera und Wandmodus des vorhandenen 3D-Fensters. |
| Aufteilung ▸ | – | Sechs Aufteilungen mit Häkchen an der aktuellen. |
| Aktives Fenster maximieren / Aufteilung wiederherstellen | Strg+Leertaste | Abschnitt 5.4. |
| Aufteilung zurücksetzen | – | Zwei Fenster nebeneinander, Plan links, 3D rechts, Teiler mittig. |
| Linke Leiste (Katalog und Werkzeuge) / Rechte Leiste (Eigenschaften) | Strg+B / Strg+Umschalt+B | Häkchen = sichtbar. |
| Vollbild | F11 | – |
| Abendlicht (Leuchten an) · Leuchten auch tagsüber · Decke anzeigen · Türen geöffnet | – | Gilt für alle 3D-Fenster. |
| Design ▸ Hell · Dunkel · Wie Windows | – | – |

### Menü Konzepte

- die vier Konzepte (Laden ersetzt die Möblierung, rückgängig mit Strg+Z)
- „Leere Wohnung (nur Bestand)“
- „Varianten sichern und vergleichen …“ öffnet den Reiter Planung
- „Planungs-Check …“ öffnet Planung und blendet die Freiflächen ein

### Menü Hilfe

| Eintrag | Kürzel | Wirkung |
|---|---|---|
| Bedienung und Tastenkürzel | F1 oder ? | Hilfe mit Suchfeld. |
| Befehlssuche | Strg+K | – |
| Programmbeschreibung (online) | – | Öffnet dieses Dokument auf GitHub. |
| Versionshinweise | – | Öffnet die Releases auf GitHub. |
| Über den Einrichtungsplaner … | – | Icon, Version, Kurzbeschreibung, Links zu Programmbeschreibung und Versionshinweisen, Lizenzhinweis der Texturen (CC0, ambientCG, Poly Haven). |

### Befehlssuche (Strg+K)

Ein Suchfeld mit Ergebnisgruppen:

1. **Zuletzt benutzt** (nur bei leerem Feld)
2. **Datei**, **Bearbeiten**, **Ansicht**
3. **Im Projekt**: platzierte Objekte mit Positionsnummer, Name und Raum. Enter wählt das Objekt aus.
4. **Katalog**: Produkte mit Händler, Maßen und Preis. Enter startet das Platzieren, danach in den Plan klicken.

Die Suche ignoriert Groß-/Kleinschreibung und Umlaut-Schreibweisen. **↑/↓** wählt, **Enter** führt aus, **Esc**
schließt. Zusätzliche Befehle, die nur hier stehen:
- jede Aufteilung einzeln („Aufteilung: Vier Fenster“ …)
- „Ansichtsart des aktiven Fensters wechseln“
- Kamera Modell / Draufsicht / Rundgang
- Wandmodi Auto / Voll / Schnitt / Flach

Kamera- und Wandbefehle öffnen bei Bedarf ein 3D-Fenster.

---

## 5. Ansichtsfenster und Aufteilung

Neu in 2.5.0: Die Mitte des Programms besteht aus bis zu vier frei belegbaren Fenstern, ähnlich wie in CAD-Programmen.
Jedes Fenster zeigt entweder einen **2D-Plan** oder eine **3D-Ansicht**. Möglich sind damit auch 2D | 2D (z. B. zwei
Zoomstufen), 3D | 3D (z. B. Draufsicht und Rundgang) und jede Mischung.

### 5.1 Aufteilungen

| Symbol | Name | Fenster | Teiler |
|---|---|---|---|
| ▢ | Ein Fenster | 1 | – |
| ▥ | Zwei nebeneinander | 1 links · 2 rechts | senkrecht |
| ▤ | Zwei übereinander | 1 oben · 2 unten | waagerecht |
| ◧ | Drei: groß links, zwei rechts | 1 links · 2 rechts oben · 3 rechts unten | senkrecht + waagerecht (rechts) |
| ⬒ | Drei: groß oben, zwei unten | 1 oben · 2 unten links · 3 unten rechts | waagerecht + senkrecht (unten) |
| ⊞ | Vier Fenster | 1 links oben · 2 rechts oben · 3 links unten · 4 rechts unten | Kreuz |

Was jedes Fenster zeigt, ist seine eigene Einstellung. Die Aufteilung legt nur fest, wie viele Fenster sichtbar sind
und wo sie stehen. Wechselt man von „Vier Fenster“ zu „Zwei nebeneinander“, bleiben die Einstellungen von Fenster 3
und 4 erhalten und erscheinen beim Zurückwechseln wieder.

Werkseinstellungen der vier Fenster:

| Fenster | Ansicht | Kamera | Wände | Ansichtsleiste |
|---|---|---|---|---|
| 1 | 2D-Plan | – | – | – |
| 2 | 3D | Modell | Auto | eingeblendet |
| 3 | 3D | Rundgang | raumhoch | aus |
| 4 | 2D-Plan | – | – | – |

### 5.2 Kopfzeile eines Fensters

Jedes Fenster hat eine schmale Kopfzeile:

1. **Ansichtsart** (Menü mit Symbol und „2D-Plan“ bzw. „3D-Ansicht“). Hier wechselt man das Fenster zwischen Plan und
   3D. Das Menü enthält auch „Fenster maximieren“.
2. **Werkzeuge der Ansicht**:
   - Plan: Messen, Pos.-Nr., Freiflächen, Maße (Abschnitt 6.2).
   - 3D: Kamera, Wände, Licht, Darstellung (Abschnitt 7.2).
3. **Ansichtsleiste** (nur 3D, Symbol ▯▏): blendet rechts im Fenster die Ansichtsleiste ein oder aus (Abschnitt 8).
4. **Maximieren** (⤢ bzw. ⤡).

**Doppelklick** auf die freie Fläche der Kopfzeile maximiert das Fenster bzw. stellt die Aufteilung wieder her.

Die Kopfzeile passt sich der Fensterbreite an. Unter etwa 560 px fallen Beschriftungen weg (nur Symbole), unter 340 px
verschwindet das Darstellungsmenü. Die Ansichtsleiste wird unter 380 px Fensterbreite ausgeblendet und die
Blickrichtungsrose unter 420 px. Die Funktionen bleiben über das Menü **Ansicht** erreichbar.

### 5.3 Teiler

| Aktion | Wirkung |
|---|---|
| Teiler ziehen | Fenstergrößen stufenlos ändern, 12–88 % je Achse. Der Mauszeiger zeigt ↔ bzw. ↕. |
| Doppelklick auf den Teiler | Wieder halbe-halbe. |
| Teiler mit Tab fokussieren, dann ←/→ bzw. ↑/↓ | Schritte von 2 %, mit Umschalt 10 %. |
| Kreuzungspunkt (nur „Vier Fenster“) ziehen | Beide Teiler zugleich verschieben. Doppelklick = vier gleiche Fenster. |

### 5.4 Maximieren

**Strg+Leertaste**, das Maximieren-Symbol oder ein Doppelklick auf die Kopfzeile vergrößert das **aktive Fenster** auf
die ganze Mitte. Die anderen Fenster bleiben im Hintergrund erhalten, ihre 3D-Ansichten rechnen aber nicht weiter.
Derselbe Befehl stellt die Aufteilung wieder her. Ein Wechsel der Aufteilung hebt das Maximieren auf.

### 5.5 Aktives Fenster

Ein Klick in ein Fenster (oder Fokus per Tab) macht es aktiv. Es ist an der Akzentlinie unter der Kopfzeile zu
erkennen. Das aktive Fenster ist das Ziel für Tasten, die sich auf eine Ansicht beziehen:

| Taste | Ziel |
|---|---|
| W | Wanddarstellung des aktiven 3D-Fensters. Ist ein Planfenster aktiv: das zuletzt aktive 3D-Fenster. Bei mehreren 3D-Fenstern nennt ein Hinweis das betroffene Fenster („Fenster 2: Wände Schnitt“). |
| M, + / −, F | Messen, Zoom und Einpassen im aktiven Planfenster, sonst im ersten sichtbaren Plan. |
| W A S D, Pfeile im Rundgang | Nur das aktive Rundgang-Fenster bewegt sich. |
| Foto (PNG), Grundriss-Export | Aktives bzw. erstes sichtbares Fenster der passenden Art. Ohne passendes Fenster erscheint ein Hinweis („Keine 3D-Ansicht sichtbar …“ bzw. „Kein 2D-Plan sichtbar …“). |

### 5.6 Gespeicherte Aufteilung

Aufteilung, Teilerpositionen, die Einstellung jedes Fensters (Ansichtsart, Kamera, Wandmodus, Ansichtsleiste),
Maximieren und aktives Fenster werden auf dem Gerät gespeichert (`we13.layout.v1`). Sie sind unabhängig vom Projekt:
Eine geöffnete Datei ändert die Aufteilung nicht.

**Einstellungen → Zurücksetzen** und **Ansicht → Aufteilung zurücksetzen** stellen die Werkseinstellung her. Ansicht
und Wandmodus aus Versionen vor 2.5 werden beim ersten Start übernommen.

### 5.7 Mehrere 3D-Fenster

- Jedes 3D-Fenster hat **eigene Kamera, eigene Brennweite und eigenen Wandmodus**. Ansichtsleiste und Raumfotos wirken
  auf ihr Fenster.
- **Gemeinsam** für alle 3D-Fenster sind Licht (Tag/Abend, Uhrzeit, Datum, Standort, Lichtfarbe), Decke, Türen und
  Qualität, denn sie beschreiben dieselbe Wohnung.
- Jedes Fenster rechnet nur, wenn sich etwas ändert. Rundgang-Fenster laufen dauerhaft, solange sie aktiv sind.
  Verborgene Fenster (hinter einem maximierten Fenster) rechnen nicht.
- Auf schwacher Grafik besser höchstens zwei 3D-Fenster zeigen und „Schnell“ wählen.

---

## 6. 2D-Plan

### 6.1 Darstellung

- **Wände** schwarz gefüllt mit exakter Stärke. **Öffnungen** mit Rohbaubreiten: Türflügel mit Schwenkbogen,
  Fenster mit Glaslinie, Fenstertüren zum Balkon.
- **Böden** in echter Farbe, mit maßstäblichem Bild in **Verlegerichtung**: Dielen, Fischgrät, Chevron, Fliesen mit
  Fuge, Terrazzokörnung.
- **Raumstempel** mit Raumname, Fläche und lichten Maßen (z. B. „4,18 × 3,77 m“; abschaltbar mit „Maße“).
- **Möbelsymbole** in Draufsicht nach Archetyp, in Ausführungsfarbe, mit weichem Schatten.
- **Nordpfeil** oben rechts mit Gradangabe (einstellbar in der Ansichtsleiste 3D unter „Lage von Norden“).
- **Zoomleiste** unten rechts:
  - **−** verkleinert, **+** vergrößert
  - der Prozentwert dazwischen passt die ganze Wohnung ein (wie **F**)
- **Mauskoordinate** unten links (x · y in m).
- **Hinweis-Abzeichen** bei Überschneidungen und Planungshinweisen. Ein Klick öffnet den Planungs-Check.

Der Plan erscheint und exportiert immer im hellen Design, auch wenn die Oberfläche dunkel ist.

### 6.2 Planwerkzeuge (Kopfzeile des Planfensters)

| Werkzeug | Taste | Wirkung |
|---|---|---|
| **Messen** | M | Zwei Punkte anklicken, die Strecke wird in m angezeigt. Esc beendet. |
| **Pos.-Nr.** | – | Positionsnummern der Einkaufsliste an den Objekten. |
| **Freiflächen** | – | Bewegungsflächen, Türschwenkbereiche und Balkonzugänge: grün = ausreichend, gelb = eng, rot = zu wenig (Abschnitt 15). |
| **Maße** | – | Lichte Raummaße in den Raumstempeln. |

Ab 540 px Fensterbreite tragen die Werkzeuge Beschriftungen, darunter nur Symbole. Jedes Planfenster hat eigene
Werkzeuge, aber die Schalter gelten für alle Pläne gemeinsam.

### 6.3 Navigation

| Eingabe | Wirkung |
|---|---|
| Mausrad | Zoomt zum Mauszeiger. |
| Ziehen auf freier Fläche (links), mittlere oder rechte Taste ziehen, Leertaste + Ziehen | Ansicht verschieben. |
| F | Ganze Wohnung einpassen. Ist ein Objekt gewählt, zielt F in 3D auf das Objekt. |
| + / − | Zoom in Stufen. |

### 6.4 Auswählen und Bearbeiten

| Eingabe | Wirkung |
|---|---|
| Klick auf Objekt | Auswählen. Im Plan zeigt das gewählte Objekt Drehgriff (oben), Größengriffe (Ecken/Kanten) und die **Abstandsmaße zu den Wänden**. |
| Umschalt+Klick | Zur Auswahl hinzufügen oder entfernen. |
| Umschalt+Ziehen auf freier Fläche | Auswahlrahmen. |
| Klick auf eine Wand-Innenkante | Wand wählen (Gestaltung dieser Wand, Abschnitt 10.3). |
| Klick in einen Raum ohne Objekt | Raum wählen (Raumgestaltung). |
| Ziehen | Verschieben, erst ab 4 px Mausweg (Klicks verschieben nichts). Mehrere gewählte Objekte bewegen sich gemeinsam. |
| Drehgriff ziehen | Drehen mit Rastung 15°, nahe der Wandrichtung 8°-Fang. |
| Größengriff ziehen | Breite/Tiefe ändern (bei Produkten mit festen Maßen abgeblendet). |
| **Abstandsmaß anklicken** | Exakten Wandabstand in cm eingeben. Enter rückt das Objekt passend. |
| Rechtsklick | Kontextmenü: Tauschen, Duplizieren, Drehen, An Wand ausrichten, Sperren, Ausblenden, Löschen. Auf freier Fläche: Einfügen, Alles auswählen, Einpassen. |
| Teppiche | Erst anklicken, dann ziehen. So verschiebt man beim Navigieren keinen Teppich. |
| Gesperrte Objekte (L) | Lassen sich wählen, aber nicht bewegen. Die Statusleiste meldet „gesperrt · L: entsperren“. |

Überschneidungen von Objekten zeigen rote Umrisse. Bestand gegen Bestand wird nicht gemeldet.

---

## 7. 3D-Ansicht

### 7.1 Darstellung

- **Materialien:** PBR mit CC0-Texturen: Holz mit Maserung in Verlegerichtung, Stoffe (Bouclé, Chenille, Mikrofaser in
  Wildleder-Optik, Cord, Samt), Stein, Metall, Glas. Die Keramikplatte Laminam® Noir Désir nutzt das Herstellerfoto.
- **Licht:** echter Sonnenstand nach Datum, Uhrzeit, Standort und Nordrichtung (NOAA-Algorithmus, MEZ/MESZ).
  - Die Sonne fällt nur durch Fenster; Decke und volle Wandhöhe werfen immer Schatten.
  - Schatten haben eine weiche Kante (Halbschatten der Sonnenscheibe).
- **Abendlicht:** Licht aus den Lichtpunkten der Leuchtenmodelle mit Lumen und Lichtfarbe 2700–4000 K
  (Planckscher Strahler). Mit „Leuchten auch bei Tageslicht“ entsteht Mischlicht.
- **Weißabgleich wie beim Auge:** chromatische Adaptation nach CIECAM02. Sie hängt von der Raumhelligkeit ab (abends
  ≈ 84 %, tagsüber ≈ 95 %) und richtet sich nach Lichtquelle und Raumlicht. Farben bleiben bei jedem Licht
  verlässlich: Beige bleibt beige, weißes Papier wirkt warmweiß.
- **Indirektes Licht und Spiegelungen** aus einer Umgebungssonde der Wohnung (mehrere Lichtsprünge, Himmel und
  Außenboden durch die Fenster).
- **Bild:** Belichtungsautomatik, Neutral-Tone-Mapping, Umgebungsverdeckung (Qualität „Hoch“).
- **Auswahl:** Kontur und Maßangabe B × T × H am gewählten Objekt.
- **Umgebung:** Verlaufshintergrund passend zum Design, Bodenplatte unter der Wohnung.
- **Blickrichtungsrose** N/O/S/W unten links. Ein Klick auf „Draufsicht“ setzt die Kamera senkrecht von oben.

### 7.2 Werkzeuge in der Kopfzeile eines 3D-Fensters

| Element | Optionen | Wirkung |
|---|---|---|
| **Kamera** (Segmentschalter) | **Modell** · **Oben** · **Rundgang** | Modell: frei drehen um die Wohnung. Oben: Draufsicht. Rundgang: auf Augenhöhe gehen (Abschnitt 7.4). |
| **Wände** (Menü, Taste W) | **Auto** – verdeckende Wände gekappt · **Voll** – raumhoch · **Schnitt** – in 1,30 m Höhe · **Flach** – nur Sockel (Grundriss in 3D) | Gilt nur für dieses Fenster. Im Rundgang sind die Wände immer raumhoch (Menü abgeblendet). |
| **Licht** (Sonne/Mond) | – | Tageslicht ↔ Abendlicht mit Leuchten (alle 3D-Fenster). |
| **Darstellung** (Regler-Symbol) | Sonnenstand (Uhrzeit 7:00–19:30 in Viertelstunden), Türen geöffnet, Decke anzeigen, Darstellungsqualität Hoch (Umgebungsverdeckung, Glanz) / Mittel / Schnell (schwächere Grafik) | Alle 3D-Fenster. |

Wandmodus **Auto** funktioniert wie bei „Die Sims“: Wände, die von der Kamera aus Teile der Wohnung verdecken, werden
kameraabhängig auf 15 cm gekappt. Wandobjekte (Bilder, Paneele, Wandleuchten) bleiben sichtbar und werden von hinten
durchscheinend.

### 7.3 Navigation (Modell und Oben)

| Eingabe | Wirkung |
|---|---|
| Links ziehen | Drehen um den Zielpunkt. |
| Rechts oder Mitte ziehen | Verschieben. |
| Mausrad | Zoom zum Mauszeiger. |
| Doppelklick auf ein Objekt | Kamera fliegt auf das Objekt. |
| F | Kamera auf die Auswahl. Ohne Auswahl: ganze Wohnung. |
| Links ziehen auf einem Möbel | Möbel verschieben (gleicher Fang wie im Plan). Ein Klick wählt nur bei direktem Treffer. |

### 7.4 Rundgang

1. Kamera **Rundgang** wählen oder Taste W A S D nach einem Klick in ein Rundgangfenster.
2. **In das Fenster klicken.** Erst dann übernimmt das Fenster die Maus (Pointer Lock). Ein Klick in ein anderes
   Fenster oder in eine Leiste sperrt die Maus nicht.
3. **Maus** = umsehen, **W A S D** oder Pfeile = gehen, **Umschalt** = schneller.
4. **Esc** gibt die Maus frei.

Der Rundgang startet in der längsten Sichtachse der Wohnung auf Augenhöhe. Möbel bremsen (Kollision), Sitzmöbel
setzen auf Sitzhöhe. Ein Hinweis im Fenster erklärt die Bedienung, bis man hineinklickt.

---

## 8. Ansichtsleiste der 3D-Fenster

Die Ansichtsleiste („Ansicht“) blendet man je 3D-Fenster über das Symbol in der Kopfzeile ein; ✕ blendet sie aus.
Sie schwebt rechts im Fenster und hat einklappbare Abschnitte: **Sonne**, **Kunstlicht**, **Kamera & Ansichten**,
**Raumfotos** und **Foto**. Der Kopf eines eingeklappten Abschnitts zeigt den Stand (z. B. „aus“, „10 Ansichten“).

### 8.1 Sonne und Kunstlicht

| Element | Inhalt |
|---|---|
| Jahreszeit | Frühling, Sommer, Herbst, Winter. Setzt das Datum auf 21.3., 21.6., 23.9. bzw. 21.12. des laufenden Jahres. |
| Datum | Freies Datum für den Sonnenstand. |
| Tagesverlauf ▶ / ❚❚ | Spielt den Tag von Sonnenaufgang bis -untergang ab. Alle 3D-Fenster laufen mit. |
| Uhrzeit (Ortszeit) | Regler. Darunter Uhrzeit, „Sonne SW, 16° hoch“ bzw. „Sonne unter dem Horizont“ sowie Sonnenaufgang und -untergang des Tages. |
| Sonne nur durch Fenster (realistisch) | An: Decke und Wände werfen immer Schatten, auch wenn sie ausgeblendet sind. Aus: Studiolicht von oben. |
| Ausrichtung & Standort ▸ Lage von Norden im Grundriss | Grad im Uhrzeigersinn, „Plan oben“ = 0°. Wirkt auf den Nordpfeil im Plan und auf die Sonne. |
| Standort für den Sonnenstand | Mitte Deutschland, Berlin, Dresden, Düsseldorf, Frankfurt am Main, Hamburg, Hannover, Köln, Leipzig, München, Nürnberg, Stuttgart oder „eigener Standort“ mit Breite/Länge. |
| Kunstlicht | Abendlicht (dunkel, Leuchten an); Leuchten auch bei Tageslicht. |
| Lichtfarbe | 2700 K · 2900 K · 3500 K · 4000 K (warmweiß bis neutralweiß). |

### 8.2 Kamera & Ansichten

| Element | Inhalt |
|---|---|
| Raumansicht auf Augenhöhe | Ein Knopf je Raum: „*Raum*: Blick über die Raumdiagonale“. |
| Brennweite | Kleinbild-Brennweite in mm (klein = Weitwinkel). Je Fenster und je Kamera (Modell bzw. Rundgang) getrennt. |
| Augenhöhe | Stehen (1,62 m) oder Sitzen (1,15 m) für die Raumansichten. |
| Gespeicherte Ansichten | „Aktuelle Kameraposition speichern“ legt „Ansicht 1, 2 …“ an. Sie werden mit dem Projekt gesichert. Klick springt hin, ✕ löscht. |

### 8.3 Raumfotos

Zehn kuratierte Blickwinkel, jeder mit passender Tageszeit:

1. Wohnen · Lamellenwand
2. Wohnen · Sofaecke
3. Essplatz · Sideboard
4. Essplatz · Fenster
5. Essplatz · Tischplatte
6. Küche
7. Diele · Konsole
8. Schlafen · Bett
9. Arbeit / Gast
10. Bad

Bedienung:
- Ein Klick auf den Namen schwenkt die Kamera des Fensters dorthin.
- Das Kamera-Symbol schwenkt hin und speichert ein PNG in Full HD (1920 px). Der Dateiname lautet
  „*Projekt* - *Raumfoto*.png“.
- **Alle Raumfotos speichern** fragt nach einem Ordner, schwenkt nacheinander alle Ansichten an und legt sie dort ab.
- Kamera, Uhrzeit und Licht kehren danach zurück.

### 8.4 Foto

PNG der aktuellen Ansicht ohne Auswahlrahmen in **Full HD** (1920 px Breite) oder **4K** (3840 px Breite). Der
Dateiname lautet „*Projekt*_*Breite*px.png“.

---

## 9. Linke Leiste

Sechs Reiter: **Katalog · Gestaltung · Objekte · Konzepte · Planung · Budget**.

### 9.1 Katalog

**Suche** („Suchen: Sofa Bouclé, Travertin …“): Name, Händler, Marke, Serie, Kategorie, Ausführungsnamen und
Schlagworte. Mehrere Wörter müssen alle passen. ✕ leert die Suche.

**Bereich** (Kopf der Liste):

| Bereich | Inhalt |
|---|---|
| Alle Produkte | Gesamtkatalog. |
| Merkliste ☆ | Produkte mit Stern. Leer: „Noch nichts gemerkt – den Stern an einem Produkt anklicken.“ |
| Zuletzt | Zuletzt platzierte Produkte. |

**Filter** (einklappbar mit Zähler aktiver Filter, „Filter zurücksetzen“):

| Filter | Werte |
|---|---|
| Händler | Westwing, IKEA, JYSK, DELIFE, Designhandel (lampe.de), Tylko, Samsung, Höffner, Fachhandel |
| Kategorie | Gruppen Sitzen, Tische, Stauraum, Schlafen, Licht, Textil & Deko, Wand & Ausbau, Außen, je mit Unterkategorien |
| Farbe | Weiß & Creme, Beige & Sand, Braun & Cognac, Grau, Schwarz & Anthrazit, Grün & Oliv, Blau & Petrol, Rot/Rosa & Terrakotta, Gelb & Ocker. Bezieht sich auf die Ausführungen. Die Karte zeigt dann die passende Ausführung. |
| Material | Bouclé & Teddy, Samt & Cord, Webstoff & Leinen, Leder, Holz hell, Holz dunkel, Stein & Keramik, Lack & Kunststoff, Metall, Glas & Spiegel, Rattan & Papier (Bezug, Platte, Korpus oder Gestell) |
| Sortierung | Empfohlen, Preis ↑, Preis ↓, Name |
| Premium | Nur hochwertige Produkte. |
| Höchstpreis | Regler („alle Preise“ = aus). |
| Höchstbreite | „Passt in die Lücke“: höchstens so breit („jede Breite“ = aus). |

**Ansicht:** Liste oder **Raster** mit großen Vorschaubildern. Jede Karte zeigt:
- Foto, Name, Händler, Maße und Preis
- Ausführungs-Punkte (Farbtupfer der Ausführungen)
- Stern für die Merkliste

**Platzieren:**
- Karte in Plan oder 3D **ziehen**. Die Vorschau zeigt den Wandfang.
- Oder **Platzieren** anklicken und dann in Plan/3D klicken. Mit Umschalt platziert man mehrfach, Esc bricht ab.

**Produktdetail** (Klick auf eine Karte):
- großes Foto (online), Marke, Beschreibung
- **Ausführungen des Herstellers** mit Preis
- „Im Shop ansehen“
- „Platzieren“ (im sichtbaren Raum)
- Esc führt zurück zur Liste.

### 9.2 Gestaltung

| Abschnitt | Inhalt |
|---|---|
| **Farbstimmung ganze Wohnung** | Warmweiß, Kalkweiß, Greige, Salbei, Terrakotta hell, Taubenblau: Wände und Decke aller Innenräume in einem Schritt. |
| **Innentüren** | Farbe; Oberfläche glatt, Kassette oder Rillen; Beschlag Griff schwarz, Messing oder Edelstahl. |
| **Fensterrahmen** | Farbe der Rahmen. |
| **Raum wählen** | Liste der Räume. Ein Klick wählt den Raum, dessen Gestaltung dann rechts erscheint. Hinweis: „Einzelne Wand gestalten: Wand im Plan (Innenkante) oder in der 3D-Ansicht anklicken.“ |

**Wandoberflächen:**
- Wandfarbe (Alpina, Schöner Wohnen, Farrow & Ball u. a.)
- Kalkfarbe (Limewash)
- Tapete: Blockstreifen, Nadelstreifen, Bögen, Raster, Punkte, Blätter, Leinenstruktur
- Holzlamellen (Akustik), Holzpaneele, Wandvertäfelung
- Fliesen: Großformat 60 × 60, Metro 15 × 7,5, Mosaik 10 × 10
- Naturstein (Travertin), Mikrozement / Beton, Textil-/Leinentapete
- jeweils mit Sockelzone, Vertäfelung oder Zweifarbig und Abschlussleiste

**Bodenvorlagen:**
- Eiche natur, Diele 1,90 m (Bestand)
- Eiche weiß geölt, Landhausdiele
- Eiche geräuchert, Landhausdiele
- Amerik. Nussbaum, Diele
- Fischgrät Eiche natur, Fischgrät Eiche geräuchert, Chevron Eiche hell
- Feinsteinzeug 60 × 60 Iron (Bestand), Feinsteinzeug 120 × 120 Betonoptik
- Travertin 60 × 40 geschliffen, Marmor Carrara 60 × 60
- Terrazzo hell, Terrazzo Salbei
- Mikrozement Greige
- Wollteppichboden Sand

**Decke:** Anstrich, Holzlamellen (akustisch), Holzpaneele oder Sichtbeton. Dazu ein Stuckprofil und „wie Wandfarbe“
bzw. Weiß.

**Sockelleisten:** keine; 6 cm wie Wand (Bestand); 10 cm weiß; 12 cm Altbau weiß; 6 cm Eiche; 4 cm Schattenfuge
schwarz.

### 9.3 Objekte

Alle Objekte des Projekts nach Räumen gruppiert, außerdem „Außerhalb“ und „Bestand“. Das Feld „Objekte filtern …“
sucht nach Name, Positionsnummer und Händler. Ein Klick wählt das Objekt aus. Die Symbole zeigen gesperrt und
ausgeblendet; die Schalter für Sperren und Ausblenden stehen in der Zeile.

### 9.4 Konzepte

- Vier Konzeptkarten mit Untertitel, Titel und Beschreibung, dazu **Konzept laden** bzw. **Erneut laden (Original)**.
  Laden ersetzt das aktuelle Projekt; rückgängig mit Strg+Z.
- Karte „Leere Wohnung von Grund auf einrichten“: Bestand wählen (Küche, Sanitär), Farbstimmung und Boden festlegen.
- Die Konzepte sind vollständig übernommen: alle Positionen mit exakten Planpositionen, Maßen, Farben, Preisen und
  Shop-Links.

### 9.5 Planung

Drei Teile:

1. **Planungs-Check** (Abschnitt 15): Fehler und Hinweise, Schalter „im Plan zeigen“.
2. **Varianten:**
   - Name eingeben (Vorschlag „Variante *n*“, z. B. „Sofa an Ostwand“), **Sichern** oder Enter.
   - Je Variante: **Laden** (ersetzt den Arbeitsstand, rückgängig mit Strg+Z), **Überschreiben** (mit Rückfrage),
     **Umbenennen**, **Löschen** (mit Rückfrage), **Vergleichen**.
   - **Vergleichen** mit Variante oder Konzept zeigt:
     - Kosten gesamt und je Raum (±)
     - neue und entfallene Objekte
     - getauschte Objekte („A → B“)
     - andere Farbe/Ausführung, verschoben/Maße
     - geänderte Gestaltung, bzw. „Keine Unterschiede.“
   - Varianten bleiben beim Konzeptwechsel erhalten und werden in der `.we13`-Datei gespeichert.
3. **Raumkennzahlen** je Raum: Fläche, Kosten, €/m², „frei“ (Bodenfläche ohne Stellflächen der Möbel, Teppiche zählen
   nicht). Unter etwa 45 % wirkt ein Wohnraum schnell vollgestellt.

### 9.6 Budget

- **Summe** und **Budgetrahmen** (änderbar). Balken nach Händler mit Farben, Balken nach Kaufstatus.
- **Gruppierung:** nach Raum, Händler oder Status.
- **Positionen:** Positionsnummer, Name, Ausführung, Kategorie, Raum und Preis.
- **Kaufstatus** je Position: Klick schaltet weiter, geplant → bestellt → geliefert → aufgebaut. Die Summe „offen“
  zeigt, was noch nicht bestellt ist.
- **Einkaufsliste (CSV)** für Excel: mit Status, Link, Ausführung und Menge.
- **Drucken / PDF**: Liste mit Abhakspalte.

---

## 10. Rechte Leiste (Eigenschaften)

Ohne Auswahl erscheinen eine Kurzhilfe (Ziehen, Alt, R, Pfeile, Rechtsklick, Strg+D, Entf, Strg+K, F1) und der Satz
„Objekt, Wand oder Raum anklicken, um Eigenschaften zu bearbeiten.“

### 10.1 Ein Objekt

Kopf: Name, Händler und Positionsnummer. Darunter eine Werkzeugreihe:

| Werkzeug | Wirkung |
|---|---|
| Tauschen (T) | Alternativen mit Vorschau. Bei Bestand nicht möglich. |
| Duplizieren (Strg+D) | – |
| −15° (Umschalt+R) / +15° (R) | Drehen. |
| An nächster Wand ausrichten | Rückseite an die nächste Wand. |
| Sperren (L), Ausblenden (H), Löschen (Entf) | Bestand trägt „Fest eingebaut“ statt Sperren und Löschen. |

Abschnitte (einklappbar, der Zustand wird gemerkt):

| Abschnitt | Inhalt |
|---|---|
| **Position & Maße** | X, Y, Drehung, Breite, Tiefe, Höhe, Unterkante bzw. Montagehöhe (Wandobjekte). Felder mit Mausrad oder ↑/↓ änderbar. |
| **Ausführungen des Herstellers (*n*)** | Musterkarten nach Stoffart gruppiert, mit Stoffmuster bzw. angedeuteter Oberfläche (Bouclé, Cord, Holz, Stein, Metall …). Überfahren zeigt die Ausführung im Plan und in 3D, ein Klick übernimmt. Bei getrennten Achsen (z. B. Bezug × Gestell) wählt man je Achse. Abgeblendet = andere Kombination. Bei vielen Ausführungen: Suchfeld „*n* Ausführungen durchsuchen …“. Ausverkaufte sind markiert. Nach freier Farbänderung steht dort „Individuell angepasst“. „Shop“ öffnet die gewählte Ausführung. |
| **Farben & Materialien** | Je Bauteil (Bezug, Gestell, Platte, Korpus, Fronten, Schirm …) Farbe, Material und „glänzend“. „Dieses Objekt hat keine einstellbaren Materialien.“ falls nicht zutreffend. |
| **Ausführung** | Parameter des Produkts (z. B. Armlehnen, Schubladen, Kissen, Füße) als Schalter oder Auswahl. |
| **Stückliste & Preis** | Positionen mit Marke, Name, Hinweis, Lieferzeit, Preis und „Im Shop öffnen“. |
| **Kaufstatus** | geplant / bestellt / geliefert / aufgebaut. |
| **Notiz** | Freitext, wird mit dem Projekt gespeichert. |
| **Samsung The Frame** (nur TV) | Montageart Wandmontage (Slim-Fit, rastet an der nächsten Wand ein; Montagehöhe = Unterkante) oder Standfuß (über ein Sideboard/Lowboard ziehen, dann steht er auf dessen Oberseite und übernimmt die Ausrichtung). Bildschirm: Art Mode oder Aus. |

### 10.2 Mehrere Objekte

- Kopf „*n* Objekte ausgewählt“.
- **Ausrichten & Verteilen (Plan):** links bündig, horizontal mittig, rechts bündig, oben bündig, vertikal mittig,
  unten bündig; horizontal bzw. vertikal gleichmäßig verteilen (ab 3 Objekten).
- **Gleiche Drehung:** übernimmt die Drehung des ersten Objekts.
- **Tauschen (T):** alle markierten gleichen Objekte gemeinsam (Abschnitt 11).
- **Duplizieren, Löschen.**

### 10.3 Wand

| Abschnitt | Inhalt |
|---|---|
| **Wandfläche** | Länge, Raum, Zustand „Individuell gestaltet“ oder „Raumstandard“. |
| **Gestaltung dieser Wand** | Oberfläche (Abschnitt 9.2) mit Farbe aus Herstellerfächern, Muster, Zweitfarbe/Fuge, Sockelzone. Knöpfe: **Auf ganzen Raum**, **Alle Wände einzeln**, **Auf Raumstandard zurücksetzen**. |

### 10.4 Raum

| Abschnitt | Inhalt |
|---|---|
| **Raum** | Name, Fläche, lichte Maße. |
| **Boden** | Vorlage („Belag aus Vorlage wählen …“). Belag: Dielen (Landhausdiele), Fischgrät, Chevron, Fliesen / Feinsteinzeug, Naturstein, Terrazzo, Mikrozement, Teppichboden, Holzdeck (außen). Dazu Farbe, Zuschlag, Fuge, Verlegerichtung, Dielenlänge, Dielenbreite, Fliesengröße. „Boden übertragen auf“ Wohnräume / Bad/HWR / alle Innenräume. |
| **Wände (Raumstandard)** | Oberfläche für alle Wände ohne eigene Gestaltung. „Wände übertragen auf“ … |
| **Decke** | Art, Deckenfarbe, Farbton, Stuckprofil, „Wie Wandfarbe“ / „Weiß“, „Decke übertragen auf“ … |
| **Sockelleiste** | Vorlage, Höhe 0–30 cm, Farbe, Material, „Sockelleiste übertragen auf“ … |

---

## 11. Tauschen

**T** oder „Tauschen“ öffnet in der linken Leiste die Alternativen zum gewählten Objekt.

| Element | Wirkung |
|---|---|
| Kopf | Aktuelles Produkt. Ein Klick übernimmt die gewählte Ausführung. Es ist die Vergleichsbasis für Maße und Preise (Stand beim Öffnen). |
| Suche | Name, Serie, Stoff, Farbe … |
| Händler | Alle Händler oder einer. |
| Maßtoleranz | Erlaubte Abweichung von Breite und Tiefe: ±10 %, ±30 % oder „Maße egal“. |
| Preis | Preisgrenze oder „Preis egal“. |
| Sortierung | passend, Farbe, Preis ↑, Preis ↓. |
| **Farbe beibehalten** | Wählt bei jedem Vorschlag die Hersteller-Ausführung, die der jetzigen Farbe und dem Material am nächsten kommt. |
| verwandte Kategorien | z. B. Sideboard ↔ Lowboard, Sessel ↔ Loungesessel. |
| Vorschlagsliste | Bild, Name, Ausführung, Maß- und Preisdifferenz. **Maus oder ↑/↓ = Vorschau in Plan und 3D**, Klick oder **Enter = tauschen**, **Esc** = schließen ohne Änderung. |

**Mehrfachtausch:** Sind mehrere gleiche Objekte markiert (z. B. 6 Stühle), tauscht T alle in einem Schritt. Jedes
behält Position, Drehung und Bezug (Tischkante, Wand oder Mitte). Andere markierte Objekte bleiben unverändert; der
Kopf nennt ihre Zahl.

**Regeln:**
- Die Rückseite bleibt nur an der Wand, wenn das Objekt an einer Wand stand.
- Frei stehende Objekte behalten ihre Mitte.
- Wand- und Deckenobjekte behalten ihre Höhe.
- Notiz und Positionsnummer bleiben.
- Bestand (Küche, Sanitär) kann nicht getauscht werden.

---

## 12. Platzieren, Fang und Ablage

| Regel | Verhalten |
|---|---|
| **Wandfang** | Nähert sich ein Möbel einer Wand, dreht es die Rückseite zur Wand und rückt bündig an. |
| **Eckfang** | In Ecken rastet es an beiden Wänden ein. Grüne Hilfslinien zeigen den Fang. |
| **Raster** | Verschieben rastet im 5-cm-Raster, Größe ändern in 1-cm-Schritten. **Alt** oder der Magnet-Schalter setzt Raster und Wandfang aus. |
| **Ablage auf Möbeln** | Tischleuchten, Deko, Vasen, Schalen und The Frame (Standfuß) stellen sich auf Sideboards, Kommoden und Tische. Verschiebt man das Möbel, nimmt es alles mit, was auf ihm steht. |
| **Pendelleuchten** | Über Tischen automatisch mittig und in der Tischachse, 65 cm über der Platte. Sonst mit mindestens 2,00 m Durchgangshöhe. |
| **Deckenleuchten** | Fangen die Raummitte. |
| **Wandleuchten** | Docken an die Wand an (Mitte ≈ 1,70 m). |
| **Teppiche** | Liegen unter allen Möbeln. Verschieben erst nach Auswahl. |
| **Pfeiltasten** | 1 cm, mit Umschalt 10 cm. Zusammenhängende Tastendrücke ergeben einen Undo-Schritt. |
| **Drehen** | R / Umschalt+R ±15°, Q / E ±1°. Ebenfalls ein Undo-Schritt je Serie. |
| **Kopieren/Einfügen** | Strg+V fügt an der Mausposition im Plan ein. Ohne Mausposition je Einfügen 25 cm versetzt. |

---

## 13. Einbauküche und Bestand

Die gekaufte **Einbauküche Alno 2060** (Höffner-Planung) ist in jedem Projekt fest eingebaut. Das gilt für alle
Konzepte, die leere Wohnung und ältere Projektdateien; dort wird sie beim Öffnen ergänzt.

| Merkmal | Ausführung |
|---|---|
| Lage | Westwand, 3,64 m |
| Fronten | Walnuss dunkel, UV-Mattlack |
| Korpus und Griffleisten | Schwarz |
| Arbeitsplatte und Rückwand | Naturstein Verde Eucalypto, poliert mit Flocken |
| Hochschränke | Backofen links (AEG), Kühl-Gefrier rechts |
| Kochfeld | 80-cm-Induktion mit Muldenlüfter |
| Spüle | Franke, Black Matt |
| Oberschränke | Faltlift mit LED |
| Gegenüber | Sideboard 1,24 m |

Die Küche ist **nicht verschiebbar, nicht löschbar und nicht tauschbar**. Strg+A, Entf, Ausschneiden und Tauschen
lassen sie aus, und die Eigenschaften zeigen „Fest eingebaut“. Gestaltung von Wänden und Boden in der Küche bleibt
möglich. Sanitärobjekte und Waschmaschine sind ebenfalls Bestand. In der leeren Wohnung sind sie wählbar.

---

## 14. Die vier Konzepte und der Essplatz

| Nr. | Titel | Gold (höchstens ein Stück) |
|---|---|---|
| 1 | Noir · Sand · Nussbaum | Schale Ramina |
| 2 | Noir · Espresso · Emperador | Stehleuchte Multi-Lite Schwarz/Gold |
| 3 | Noir · Stone · Greige | keines |
| 4 | Noir · Ivory · Travertin | Messing-Kerzenhalter auf dem Esstisch |

Alle Konzepte sind minimalistisch-luxuriös in Schwarz, Beige/Greige und Stein/Keramik gehalten und auf den Essplatz
abgestimmt. Die Budgets der PDFs sind centgenau übernommen, ersetzte Positionen bleiben im Katalog.

**Essplatz-Regeln** (alle Konzepte):

| Regel | Wert |
|---|---|
| Tisch | Rechteckig, **DELIFE Edge 200 × 100 × 74 cm**, Keramik Laminam® Noir Désir Braun, V-Mittelfuß schwarz. Kein Holz an Platte oder Gestell. |
| Länge | Höchstens 2,0 m: Zwischen Sofarücken und Sideboard bleiben 3,58 m. |
| Lage | Mittig zwischen Sofarücken und Sideboard, Längsachse im Plan von oben nach unten. ≥ 80 cm vor dem Sideboard, 1,1–1,6 m hinter den Stühlen. |
| Stühle | 6 + Nischenplatz, **DELIFE Pejo-Flex** Mikrofaser Beige Vintage, Kreuzgestell schwarz, 89,90 €. Sitzkante 12 cm unter der Tischkante, 65 cm Achsabstand. Armlehnen (64 cm) passen unter die Platte (Unterkante 73 cm). |
| Teppich | Mindestens 60 cm Überstand an den Stuhlseiten (250 × 350 bzw. 240 × 350 cm). |
| Pendelleuchte | Linear, **50–60 % der Tischlänge**, in der Tischachse, 65 cm über der Platte. |

---

## 15. Planungs-Check

Der Check läuft bei jeder Änderung und meldet **Fehler** (rot) und **Hinweise** (gelb). Ein Klick auf eine Meldung
springt zum Objekt; „im Plan zeigen“ bzw. **Freiflächen** blendet die Zonen ein. Bestand gegen Bestand wird nicht
gemeldet.

Bewegungsflächen nach DIN 18011/18022 (Minimum / empfohlen):

| Vor … | Minimum | Empfohlen |
|---|---|---|
| Kleiderschrank, Kommode | 70 cm | 90 cm |
| Sideboard, Schrank | 60 cm | 80 cm |
| Lowboard, Regal | 50 cm | 70 cm |
| Schreibtisch (Stuhlzone) | 80 cm | 100 cm |
| Küchenzeile (auch Alno) | 100 cm | 120 cm |
| Küchen-Sideboard | 90 cm | 120 cm |
| Waschmaschine, Wanne | 70 cm | 90 cm |
| WC, Waschtisch | 55 cm | 70 cm |
| Fußende des Bettes | 50 cm | 70 cm |
| Neben dem Bett | 60 cm | 70 cm |
| Hinter den Stühlen am Esstisch | 75 cm | 90 cm |

Weitere Prüfungen:

| Prüfung | Meldung |
|---|---|
| Couchtisch | Abstand zur Sitzkante üblich 30–50 cm („sehr nah“ unter 28 cm bzw. „weit“). |
| Türen | Objekt im Schwenkbereich bzw. Tür verstellt: „Die Tür lässt sich nicht vollständig öffnen.“ Vor Türen mindestens 60 cm frei. |
| Balkonzugang | Vor Fenstertüren 90 cm Bewegungsfläche freihalten. |
| Fenster | Hohe Möbel vor Fenstern nehmen Licht und behindern das Öffnen/Lüften. |
| Wand | Objekt ragt in die Wand: Position oder Maße prüfen. |
| Lieferweg | Passt das Möbel gekippt durch Wohnungs- und Zimmertür? Sonst: „passt montiert nicht durch die Tür (lichte Breite ca. *n* cm). Zerlegbar oder Teillieferung?“ |

Ohne Befund: „Keine Konflikte: Bewegungsflächen, Türen, Balkonzugänge und Lieferweg sind in Ordnung.“

---

## 16. Speichern, Dateien und Export

| Funktion | Verhalten |
|---|---|
| **Autosave** | Der Arbeitsstand wird laufend gesichert (Statusleiste „gesichert 14:32“). Beim nächsten Start ist er wieder da. |
| **Projektdatei `.we13`** | JSON mit Projekt, Varianten und gespeicherten Ansichten. Das Format ist seit 1.x kompatibel. Gespeicherte Projekte bleiben nach einem Katalog-Neuaufbau gültig (ID-Aliase). |
| Öffnen | Strg+O, Doppelklick im Explorer (auch in die laufende App) oder Datei ins Fenster ziehen. |
| Fenstertitel | Dateiname mit ● bei ungespeicherten Änderungen. |
| Beenden | Mit ungespeicherten Änderungen fragt der Dialog „Änderungen speichern?“: Speichern und beenden / Nicht speichern / Abbrechen. |
| Fehler | Verständliche Meldungen bei Speichern, Öffnen und Export, z. B. bei Schreibschutz oder beschädigter Datei. |

**Export:**

| Export | Details |
|---|---|
| 3D-Ansicht als Bild (PNG) | Aktives 3D-Fenster in Fenstergröße. Full HD / 4K über die Ansichtsleiste. |
| Raumfotos | Einzeln oder alle in einen Ordner (Abschnitt 8.3). |
| Grundriss als Bild (PNG) | Aktiver Plan, ganze Wohnung, dreifache Auflösung, immer hell. |
| Grundriss als Vektorgrafik (SVG) | Wie PNG, als Vektor. |
| Einkaufsliste (CSV/Excel) | Positionen mit Status, Ausführung, Preis und Link, Trennzeichen Semikolon. |
| Einkaufsliste drucken / PDF | Druckansicht mit Abhakspalte. |
| Eigenes 3D-Modell (GLB) | Import als Objekt mit frei einstellbaren Maßen. |

---

## 17. Einstellungen

Öffnen mit **Strg+,**. Die Einstellungen gelten für dieses Gerät, unabhängig vom Projekt. Ein Suchfeld filtert die
Einträge.

| Bereich | Eintrag | Werte |
|---|---|---|
| Darstellung | Design | System (folgt Windows), Hell, Dunkel |
| | Transparenzeffekte | Glasflächen mit Unschärfe. Aus = deckende Flächen, schneller auf schwacher Grafik. |
| | Animationen | Weiche Übergänge bei Menüs, Dialogen und Leisten. |
| | Oberflächengröße | 80–150 % in 5-%-Schritten. Strg + Mausrad oder Strg +/− funktionieren zusätzlich. |
| | 3D-Darstellungsqualität | Hoch, Mittel, Schnell („Schnell“ für Notebooks ohne eigene Grafikkarte). |
| Programm | Nach Updates suchen | Beim Start auf GitHub nach einer neuen Version schauen (nur Hinweis). „Jetzt prüfen“ meldet „Neue Version *x* verfügbar“, „Aktuell – keine neuere Version“ oder „Keine Verbindung zu GitHub“. |
| | Version | Anzeige mit Link „Versionshinweise“. |
| | Zurücksetzen | Design, Leisten, Größe und Fensteraufteilung. Die Merkliste bleibt. |

---

## 18. Statusleiste, Hinweise und Dialoge

**Statusleiste:**
- **Links:** ein Kontexthinweis passend zur Lage, zum Beispiel:
  - Platzieren: „*Produkt* platzieren: in Plan oder 3D klicken · Umschalt+Klick: mehrere · Esc: abbrechen“
  - Rundgang: „in die Ansicht klicken · Maus = umsehen · W A S D = gehen …“
  - ein Objekt gewählt: „Ziehen: verschieben (Alt ohne Fang) · Pfeile: 1 cm …“
  - mehrere Objekte gewählt: „*n* Objekte · gemeinsam ziehen, ausrichten (rechts) · T: gleiche tauschen …“
  - eine Wand gewählt
  - ohne Auswahl: „Strg+K: Befehl oder Produkt suchen …“
- **Mitte:** der zuletzt ausgeführte Schritt.
- **Rechts:** Speicherstand („Gespeichert in *Datei*“, „Ungespeichert (*Datei*)“, „Noch nicht als Datei gespeichert“)
  und die Zeit des letzten Autosaves.

**Hinweise (Toasts)** erscheinen unten in der Mitte mit einer Restzeitleiste und halten beim Überfahren an. Nach
Löschen oder Konzept laden bieten sie „Rückgängig“ an.

**Update-Hinweis:** Gibt es eine neue Version, erscheint ein Hinweis mit „Zur Download-Seite“. Man installiert das
Installationsprogramm einfach über die bestehende Version; Projekte bleiben erhalten. Der Hinweis lässt sich für diese
Version ausblenden.

---

## 19. Tastenkürzel (vollständig)

Tasten ohne Strg wirken nicht, solange ein Eingabefeld den Fokus hat.

| Taste | Wirkung |
|---|---|
| **Allgemein** | |
| Strg+K | Befehlssuche |
| Strg+N / Strg+O | Neue Einrichtung / Öffnen |
| Strg+S / Strg+Umschalt+S | Speichern / Speichern unter |
| Strg+Z / Strg+Y (auch Strg+Umschalt+Z) | Rückgängig / Wiederholen |
| F1 oder ? | Hilfe |
| Strg+, | Einstellungen |
| Strg+B / Strg+Umschalt+B | Linke / rechte Leiste |
| F11 | Vollbild |
| Esc | Dialog schließen → Platzieren abbrechen → Messen beenden → Auswahl aufheben |
| **Fenster** | |
| 1 / 2 / 3 | Nur Plan / Plan und 3D / nur 3D |
| Strg+Leertaste | Aktives Fenster maximieren / Aufteilung wiederherstellen |
| W | Wanddarstellung des aktiven 3D-Fensters: Auto → Schnitt → Flach → Voll |
| **Bearbeiten** | |
| Strg+C / Strg+X / Strg+V | Kopieren / Ausschneiden / Einfügen an der Mausposition |
| Strg+D | Duplizieren |
| Strg+A | Alles auswählen (ohne gesperrte Objekte) |
| Entf / Rücktaste | Löschen |
| Pfeiltasten (Umschalt) | Verschieben 1 cm (10 cm) |
| R / Umschalt+R | Drehen +15° / −15° |
| Q / E | Feindrehen −1° / +1° |
| L / H | Sperren / Ausblenden |
| T | Tauschen |
| **Ansicht** | |
| F | Plan einpassen · 3D: Kamera auf Auswahl |
| M | Messen |
| + / − | Zoom im Plan |
| W A S D (Umschalt) | Rundgang gehen (schneller) |
| Alt (beim Ziehen) | Fang aus |

---

## 20. Daten, Katalog und Grundriss

### Grundriss

Der Grundriss ist aus der Vektor-PDF rekonstruiert: Wandpolygone, Raumpolygone, 16 Öffnungen mit Rohbaubreiten,
Türflügel um 8° gedreht. Die Raumhöhe beträgt 2,56 m, und die Flächen sind identisch mit den Raumstempeln.

| Raum | Fläche |
|---|---|
| 13.01 Essen / Wohnen / Flur | 42,45 m² |
| 13.02 Kochen | 10,39 m² |
| 13.03 Schlafen | 15,76 m² |
| 13.04 Arbeit / Gast / Kind | 9,96 m² |
| 13.05 Bad | 5,93 m² |
| 13.06 Dusche / Gäste-WC | 4,37 m² |
| 13.07 HWR | 2,95 m² |
| 13.08 Balkon 1 | 5,32 m² |
| 13.09 Balkon 2 | 5,15 m² |

### Katalog (Stand 25.10.2026)

| Händler | Produkte |
|---|---|
| IKEA | 1.517 |
| Tylko | 1.231 |
| DELIFE | 1.190 |
| Westwing | 1.173 |
| lampe.de (Designhandel: Artemide, Tecnolumen, Serien Lighting, Bopp, Grossmann u. a.) | 870 + 28 |
| JYSK | 555 |
| Höffner | 16 |
| Fachhandel (Mobitec, Musterring, bert plantagie, connubia) und BoConcept | 12 |
| OBI (Wandpaneele) | 9 |
| Samsung (The Frame 43–85″) | 6 |
| Bestand | 10 |

**Ausführungen:**
- 19.471 Ausführungen insgesamt, jede mit eigenem Preis, Shop-Link und Foto.
- IKEA hat den vollständigen Ausführungs-Wähler der Produktseite, mit getrennten Achsen wie Bezug × Gestell.
- Westwing-Farben sind aus dem Original-Stoffmuster gemessen, DELIFE-Farben aus dem Freisteller-Foto.

**Maße und Stoffe:**
- Die Maße sind plausibilisiert, mit der Raumhöhe als Obergrenze.
- Stoffe sind unterscheidbar: Bouclé, Chenille, Mikrofaser, Melange, Cord, Samt.

**Preise und Verfügbarkeit:** Stand der Händlerseiten bzw. der Konzepte (Oktober 2026), ohne Gewähr.

---

## 21. Technik, Leistung und Grenzen

| Thema | Details |
|---|---|
| Plattform | Windows 10/11 (64 bit), Tauri 2 (Rust) mit WebView2 (wird bei Bedarf nachinstalliert). |
| Oberfläche | React 19, TypeScript, Tailwind CSS 4, Zustand. |
| 3D | three.js mit React Three Fiber. Je 3D-Fenster ein eigener Canvas mit eigenem Weißabgleich. Rendern nur bei Änderungen. |
| Gerätedaten | Einstellungen, Leisten, Fensteraufteilung, Merkliste und zuletzt verwendete Dateien im lokalen Speicher der App. |
| Installer | NSIS (`*.exe`) bzw. MSI, gebaut von GitHub Actions. Er registriert `.we13` und frischt Desktop-Verknüpfung und Icon-Cache auf. |
| Mindestbreite | 1.200 px für die vollständige Kopfleiste. Darunter Menüs und Befehlssuche. |
| Grenzen | Bis zu vier Fenster. Viele 3D-Fenster gleichzeitig kosten Grafikleistung. Produktfotos werden online geladen (offline: Platzhalter). |

---

## 22. Fehlerbehebung

| Problem | Lösung |
|---|---|
| 3D ruckelt | Weniger 3D-Fenster zeigen (z. B. Taste 2), Qualität „Schnell“, Transparenzeffekte aus. |
| Fenster zu klein für Werkzeuge | Teiler ziehen oder Strg+Leertaste (maximieren). Jede Funktion steht auch im Menü Ansicht und in Strg+K. |
| Maus „hängt“ im Rundgang | Esc gibt die Maus frei. |
| W wirkt im falschen Fenster | Zuerst in das gewünschte 3D-Fenster klicken: Es wird aktiv. |
| Aufteilung durcheinander | Ansicht → Aufteilung zurücksetzen. |
| Altes Icon nach Update | Der Installer frischt den Icon-Cache auf. Sonst Verknüpfung neu anlegen oder `ie4uinit.exe -show` ausführen. |
| Projekt aus älterer Version | Öffnet unverändert. Die Einbauküche wird ergänzt, veraltete Katalog-IDs werden über Aliase aufgelöst. |
