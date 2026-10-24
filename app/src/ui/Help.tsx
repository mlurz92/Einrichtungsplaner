import { useState } from "react";
import { Keyboard, Search } from "lucide-react";
import { useEditor } from "../store/project";
import { Dialog } from "./kit";
import { matches } from "./commands";

const GROUPS: [string, [string, string][]][] = [
  [
    "Allgemein",
    [
      ["Strg+K", "Befehlssuche: Befehle, Räume, Objekte im Projekt und Katalogprodukte (Enter platziert)"],
      ["Strg+N / Strg+O", "Neue Einrichtung / Öffnen (Datei → Zuletzt verwendet)"],
      ["Strg+S / Strg+Umschalt+S", "Speichern / Speichern unter"],
      ["Strg+Z / Strg+Y", "Rückgängig / Wiederholen – Schritte sind benannt (Tooltip, Statusleiste)"],
      ["1 / 2 / 3", "Nur Plan / Plan und 3D / nur 3D"],
      ["F1 oder ?", "Diese Hilfe"],
      ["Strg+,", "Einstellungen: Design (hell, dunkel, wie Windows), Transparenz, Oberflächengröße"],
      ["Strg+B / Strg+Umschalt+B", "Linke / rechte Leiste ein- oder ausblenden; Leistenrand ziehen ändert die Breite"],
      ["F11", "Vollbild"],
      ["Rechtsklick", "Kontextmenü für Objekte und freie Planfläche (Plan und 3D)"],
      [".we13 ins Fenster ziehen", "Projekt öffnen; Doppelklick im Explorer öffnet es in der laufenden App"],
      ["Esc", "Dialog schließen, Platzieren abbrechen, Auswahl aufheben"],
    ],
  ],
  [
    "Auswählen & Bearbeiten",
    [
      ["Katalog → Plan/3D ziehen", "Produkt per Drag & Drop platzieren (Vorschau mit Wandfang)"],
      ["Klick / Umschalt+Klick", "Auswählen / Mehrfachauswahl"],
      ["Umschalt+Ziehen (Plan)", "Auswahlrahmen aufziehen"],
      ["Teppiche", "Erst anklicken, dann ziehen – so verschiebt man beim Navigieren keinen Teppich"],
      ["Ziehen", "Verschieben – Raster, Wandfang (Rückseite an die Wand, Ecken), Ablage auf Möbeln"],
      ["Alt beim Ziehen", "Fang vorübergehend aus"],
      ["Pfeiltasten (Umschalt)", "Verschieben um 1 cm (10 cm) – zusammenhängende Tastendrücke sind ein Undo-Schritt"],
      ["R / Umschalt+R", "Drehen um 15° / −15°"],
      ["Q / E", "Feindrehen um 1°"],
      ["Strg+C / Strg+X / Strg+V", "Kopieren / Ausschneiden / Einfügen an der Mausposition im Plan"],
      ["Strg+D", "Duplizieren"],
      ["Entf", "Löschen (Hinweis mit „Rückgängig“)"],
      ["L / H", "Sperren bzw. entsperren / Ein- bzw. Ausblenden"],
      ["T", "Tauschen: Alternativen mit Vorschau in Plan/3D (Maus oder ↑/↓), Enter tauscht; „Farbe beibehalten“ wählt die passende Hersteller-Ausführung"],
      ["T bei Mehrfachauswahl", "Alle markierten gleichen Objekte (z. B. 6 Stühle) in einem Schritt tauschen; jedes behält Position, Drehung und Bezug (Tischkante, Wand oder Mitte). Andere markierte Objekte bleiben unverändert"],
      ["Ausführungen (Inspector)", "Musterkarte überfahren = Vorschau, Klick = übernehmen; bei Bezug × Gestell je Achse wählen, abgeblendet = andere Kombination"],
      ["Strg+A", "Alles auswählen"],
    ],
  ],
  [
    "Ansicht",
    [
      ["F", "Plan einpassen; in 3D Kamera auf die Auswahl"],
      ["Doppelklick (3D)", "Kamera auf Objekt"],
      ["M", "Messen im Plan"],
      ["+ / −", "Plan vergrößern / verkleinern (Zoomleiste unten rechts, Prozentwert = einpassen)"],
      ["Abstandsmaß anklicken", "Exakten Wandabstand in cm eingeben – das Objekt rückt passend"],
      ["W", "Wanddarstellung wechseln: Auto (verdeckende Wände 15 cm, wie Die Sims) → Schnitt → Flach → Voll"],
      ["Plan: Ziehen auf freier Fläche, mittlere/rechte Taste", "Ansicht verschieben; Mausrad zoomt zum Mauszeiger"],
      ["3D: links ziehen / rechts oder Mitte ziehen", "Ansicht drehen / verschieben; Möbel nur bei direktem Treffer mit links"],
      ["Rundgang", "W A S D gehen, Maus umsehen, Umschalt schneller, Esc beendet"],
    ],
  ],
];

function Keys({ k }: { k: string }) {
  // „Strg+Z / Strg+Y“ → Tasten als Kappen; Beschreibungen in Worten bleiben Text
  if (!/^[A-ZÄÖÜa-z0-9+/ ,.?−↑↓F-]+$/.test(k) || k.split(" ").length > 6 || /[a-zäöü]{4,}/.test(k.replace(/Strg|Umschalt|Entf|Esc|Alt/g, "")))
    return <span className="font-medium text-stone-800">{k}</span>;
  return (
    <span className="flex flex-wrap items-center gap-1">
      {k.split(/\s*\/\s*|\s+oder\s+/).map((combo, i) => (
        <span key={i} className="flex items-center gap-0.5">
          {i > 0 && <span className="mr-1 text-stone-400">/</span>}
          {combo.split("+").map((x, j) => (
            <kbd key={j}>{x.trim()}</kbd>
          ))}
        </span>
      ))}
    </span>
  );
}

export function HelpOverlay() {
  const open = useEditor((s) => s.helpOpen);
  const [q, setQ] = useState("");
  const close = () => useEditor.getState().set("helpOpen", false);
  const groups = GROUPS.map(([t, rows]) => [t, q ? rows.filter(([k, v]) => matches(`${k} ${v}`, q)) : rows] as const).filter(([, r]) => r.length);
  return (
    <Dialog open={open} onClose={close} title="Bedienung & Tastenkürzel" icon={<Keyboard size={18} />} width="max-w-3xl">
      <label className="relative mb-3 block">
        <Search size={14} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-stone-400" />
        <input className="field pl-8" placeholder="Kürzel oder Funktion suchen …" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      </label>
      {groups.map(([title, rows]) => (
        <div key={title} className="mb-4">
          <div className="panel-title mb-1">{title}</div>
          <div className="overflow-hidden rounded-xl border border-line bg-card/50">
            {rows.map(([k, v]) => (
              <div key={k} className="grid grid-cols-[minmax(160px,38%)_1fr] gap-4 border-t border-line px-3 py-2 text-sm first:border-t-0">
                <Keys k={k} />
                <span className="text-stone-600">{v}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
      {!groups.length && <div className="py-6 text-center text-sm text-stone-500">Nichts gefunden.</div>}
      <p className="mt-1 text-xs text-stone-500">
        Pendelleuchten über Tischen werden automatisch mittig und 65 cm über der Tischplatte gehängt, sonst mit mind. 2,00 m Durchgangshöhe. Tischleuchten, Deko und The Frame (Standfuß) stellen sich auf Sideboards, Kommoden und Tische; diese nehmen beim Verschieben alles mit, was auf ihnen steht.
      </p>
    </Dialog>
  );
}
