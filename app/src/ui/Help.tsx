import { X } from "lucide-react";
import { useEditor } from "../store/project";

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
      ["Strg+A", "Alles auswählen"],
    ],
  ],
  [
    "Ansicht",
    [
      ["F", "Plan einpassen; in 3D Kamera auf die Auswahl"],
      ["Doppelklick (3D)", "Kamera auf Objekt"],
      ["M", "Messen im Plan"],
      ["W", "Wanddarstellung wechseln: Auto (verdeckende Wände 15 cm, wie Die Sims) → Schnitt → Flach → Voll"],
      ["Plan: Ziehen auf freier Fläche, mittlere/rechte Taste", "Ansicht verschieben; Mausrad zoomt zum Mauszeiger"],
      ["3D: links ziehen / rechts oder Mitte ziehen", "Ansicht drehen / verschieben; Möbel nur bei direktem Treffer mit links"],
      ["Rundgang", "W A S D gehen, Maus umsehen, Umschalt schneller, Esc beendet"],
    ],
  ],
];

export function HelpOverlay() {
  const open = useEditor((s) => s.helpOpen);
  if (!open) return null;
  const close = () => useEditor.getState().set("helpOpen", false);
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/30 p-4" onClick={close}>
      <div className="max-h-full w-full max-w-2xl overflow-auto rounded-xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">Bedienung & Tastenkürzel</h2>
          <button className="btn-ghost" onClick={close} title="Schließen (Esc)">
            <X size={16} />
          </button>
        </div>
        {GROUPS.map(([title, rows]) => (
          <div key={title} className="mb-3">
            <div className="panel-title mb-1">{title}</div>
            <table className="w-full text-sm">
              <tbody>
                {rows.map(([k, v]) => (
                  <tr key={k} className="border-t border-stone-100">
                    <td className="py-1.5 pr-4 align-top font-medium whitespace-nowrap text-stone-800">{k}</td>
                    <td className="py-1.5 text-stone-600">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        <p className="mt-3 text-xs text-stone-500">
          Pendelleuchten über Tischen werden automatisch mittig und 65 cm über der Tischplatte gehängt, sonst mit mind. 2,00 m Durchgangshöhe. Tischleuchten, Deko und The Frame (Standfuß) stellen sich auf Sideboards, Kommoden und Tische; diese nehmen beim Verschieben alles mit, was auf ihnen steht.
        </p>
      </div>
    </div>
  );
}
