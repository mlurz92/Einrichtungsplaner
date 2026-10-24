import { useState } from "react";
import { FilePlus } from "lucide-react";
import { Dialog } from "./kit";
import { useEditor } from "../store/project";
import { FLOOR_PRESETS, WALL_MOODS } from "../data/paints";

/** Dialog „Neue Einrichtung“: leere Wohnung mit gewähltem Bestand, Farbstimmung und Bodenbelag. */
export function NewFurnishingDialog() {
  const open = useEditor((s) => s.newDialogOpen);
  const [name, setName] = useState("Meine Einrichtung WE 13");
  const [sanitary, setSanitary] = useState(true);
  const [washer, setWasher] = useState(true);
  const [mood, setMood] = useState(0);
  const [floor, setFloor] = useState("oak");
  const close = () => useEditor.getState().set("newDialogOpen", false);
  const create = () => {
    const m = WALL_MOODS[mood];
    const f = FLOOR_PRESETS.find((x) => x.id === floor);
    useEditor.getState().newFurnishing({
      name,
      keepSanitary: sanitary,
      keepWasher: washer,
      wallColor: m.color,
      wallProduct: m.productName,
      ceilingColor: m.ceiling,
      floor: floor === "oak" || !f ? null : f.floor,
    });
    useEditor.getState().set("leftTab", "katalog");
    close();
  };
  const livingFloors = FLOOR_PRESETS.filter((x) => x.id !== "iron");
  return (
    <Dialog
      open={open}
      onClose={close}
      title="Neue Einrichtung"
      subtitle="Leere Wohnung mit Bestand, Farbstimmung und Boden"
      icon={<FilePlus size={18} />}
      width="max-w-xl"
      footer={
        <>
          <button className="btn" onClick={close}>
            Abbrechen
          </button>
          <button className="btn-primary" onClick={create}>
            Wohnung anlegen
          </button>
        </>
      }
    >
      <div>
        <label className="block text-xs text-stone-600">
          Projektname
          <input className="field mt-1" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && create()} />
        </label>
        <div className="panel-title mt-4">Bestand übernehmen</div>
        <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-sm">
          <label className="flex items-center gap-1.5">
            <input type="checkbox" className="" checked={sanitary} onChange={(e) => setSanitary(e.target.checked)} /> Sanitärobjekte
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" className="" checked={washer} onChange={(e) => setWasher(e.target.checked)} /> Waschmaschine
          </label>
        </div>
        <p className="mt-1 text-[11px] text-stone-500">Die Einbauküche Alno 2060 (Walnuss dunkel, Naturstein) mit Sideboard ist fest eingebaut. Böden im Bestand: Eichendielen 1,90 m; HWR, Bad und Dusche/WC Feinsteinzeug 60 × 60 cm „Iron“.</p>
        <div className="panel-title mt-4">Farbstimmung Wände/Decken</div>
        <div className="mt-1 flex flex-wrap gap-1">
          {WALL_MOODS.map((m, i) => (
            <button key={m.label} className="chip" data-on={mood === i} onClick={() => setMood(i)}>
              <span className="mr-1 inline-block h-2.5 w-2.5 rounded-full border border-stone-300 align-middle" style={{ background: m.color }} />
              {m.label}
            </button>
          ))}
        </div>
        <div className="panel-title mt-4">Boden Wohnräume</div>
        <select className="field mt-1" value={floor} onChange={(e) => setFloor(e.target.value)}>
          {livingFloors.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
        <p className="mt-3 text-[11px] text-stone-500">
          Danach: Produkte aus dem Katalog in Plan oder 3D ziehen; Wände, Decken, Sockelleisten, Türen und Fensterrahmen unter „Gestaltung“ – je Raum, je Wand oder für die ganze Wohnung.
        </p>
      </div>
    </Dialog>
  );
}
