import { X } from "lucide-react";
import { useEditor } from "../store/project";

const ROWS: [string, string][] = [
  ["Katalog → Plan/3D ziehen", "Produkt per Drag & Drop platzieren (Vorschau mit Wandfang)"],
  ["Klick / Umschalt+Klick", "Auswählen / Mehrfachauswahl; Rahmen aufziehen im Plan"],
  ["Ziehen", "Verschieben – Raster, Wandfang (Rückseite an die Wand, Ecken), Ablage auf Möbeln"],
  ["Alt beim Ziehen", "Fang vorübergehend aus"],
  ["Pfeiltasten (Umschalt)", "Verschieben um 1 cm (10 cm)"],
  ["R / Umschalt+R", "Drehen um 15° / −15°"],
  ["Q / E", "Feindrehen um 1°"],
  ["Strg+D", "Duplizieren"],
  ["Entf", "Löschen"],
  ["Strg+Z / Strg+Y", "Rückgängig / Wiederholen"],
  ["Strg+A", "Alles auswählen"],
  ["F", "Plan einpassen; in 3D Kamera auf die Auswahl"],
  ["Doppelklick (3D)", "Kamera auf Objekt"],
  ["M", "Messen im Plan"],
  ["Mittlere/rechte Maustaste, Leertaste+Ziehen", "Plan verschieben; Mausrad zoomt"],
  ["Rundgang", "W A S D gehen, Maus umsehen, Umschalt schneller, Esc beendet"],
  ["Strg+S / Strg+O", "Speichern / Öffnen"],
  ["F1 oder ?", "Diese Hilfe"],
];

export function HelpOverlay() {
  const open = useEditor((s) => s.helpOpen);
  if (!open) return null;
  const close = () => useEditor.getState().set("helpOpen", false);
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/30 p-4" onClick={close}>
      <div className="max-h-full w-full max-w-2xl overflow-auto rounded-xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">Bedienung</h2>
          <button className="btn-ghost" onClick={close} title="Schließen (Esc)">
            <X size={16} />
          </button>
        </div>
        <table className="w-full text-sm">
          <tbody>
            {ROWS.map(([k, v]) => (
              <tr key={k} className="border-t border-stone-100">
                <td className="py-1.5 pr-4 align-top font-medium whitespace-nowrap text-stone-800">{k}</td>
                <td className="py-1.5 text-stone-600">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-stone-500">
          Pendelleuchten über Tischen werden automatisch mittig und 65 cm über der Tischplatte gehängt, sonst mit mind. 2,00 m Durchgangshöhe. Tischleuchten, Deko und The Frame (Standfuß) stellen sich auf Sideboards, Kommoden und Tische; diese nehmen beim Verschieben alles mit, was auf ihnen steht.
        </p>
      </div>
    </div>
  );
}
