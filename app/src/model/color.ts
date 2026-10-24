// Farbabstand (CIELAB, ΔE 2000 vereinfacht als ΔE76 genügt hier), Farbfamilien und Materialgruppen für
// Katalogfilter, „Farbe beibehalten“ beim Tauschen und die Gruppierung von Ausführungen.
import type { CatalogItem, CatalogVariant, MaterialKey, Slot, SlotStyle } from "./types";

export type Lab = [number, number, number];

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const v = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.padEnd(6, "0").slice(0, 6);
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}

export function hexToLab(hex: string): Lab {
  const lin = (c: number) => {
    c /= 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = hexToRgb(hex).map(lin);
  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  const y = r * 0.2126 + g * 0.7152 + b * 0.0722;
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

export function deltaE(a: string, b: string): number {
  const p = hexToLab(a);
  const q = hexToLab(b);
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}

/** Bauteil, das den Gesamteindruck bestimmt (Bezug, Platte, Korpus, Rahmen …). */
export function primarySlot(slots: Partial<Record<Slot, SlotStyle>>): SlotStyle | undefined {
  return slots.main ?? slots.top ?? slots.frame ?? slots.shade ?? Object.values(slots)[0];
}

/** Variante eines Produkts, deren Hauptfarbe/-material dem Vorbild am nächsten kommt. */
export function closestVariant(c: CatalogItem, target: Partial<Record<Slot, SlotStyle>>): number {
  const t = primarySlot(target);
  if (!t || c.variants.length < 2) return 0;
  let best = 0;
  let bestD = Infinity;
  c.variants.forEach((v, i) => {
    const p = primarySlot(v.slots);
    if (!p) return;
    const d = deltaE(p.color, t.color) + (materialGroup(p.material) === materialGroup(t.material) ? 0 : 12);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

// ---------------------------------------------------------------- Farbfamilien
export const COLOR_FAMILIES: { id: string; label: string; swatch: string }[] = [
  { id: "weiss", label: "Weiß & Creme", swatch: "#f1ece2" },
  { id: "beige", label: "Beige & Sand", swatch: "#d6c4a4" },
  { id: "braun", label: "Braun & Cognac", swatch: "#7a5a43" },
  { id: "grau", label: "Grau", swatch: "#8f8f8b" },
  { id: "schwarz", label: "Schwarz & Anthrazit", swatch: "#262626" },
  { id: "gruen", label: "Grün & Oliv", swatch: "#6e7c5a" },
  { id: "blau", label: "Blau & Petrol", swatch: "#365a78" },
  { id: "rot", label: "Rot, Rosa & Terrakotta", swatch: "#b8653f" },
  { id: "gelb", label: "Gelb & Ocker", swatch: "#c9a43c" },
];

export function colorFamily(hex: string): string {
  const [L, a, b] = hexToLab(hex);
  const C = Math.hypot(a, b);
  const h = ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
  if (L < 22) return "schwarz";
  if (C < 9) return L > 84 ? "weiss" : L < 30 ? "schwarz" : "grau";
  if (L > 86 && C < 16) return "weiss";
  if (h < 50 || h >= 300) return "rot";
  if (h < 100) {
    if (C >= 45) return h < 56 ? "rot" : "gelb";
    return L >= 66 || (C < 14 && L >= 55) ? "beige" : "braun";
  }
  if (h < 190) return "gruen";
  return "blau";
}

// ---------------------------------------------------------------- Materialgruppen
export const MATERIAL_GROUPS: { id: string; label: string; keys: MaterialKey[] }[] = [
  { id: "boucle", label: "Bouclé & Teddy", keys: ["boucle", "boucleMel", "teddy", "fur"] },
  { id: "samt", label: "Samt & Cord", keys: ["velvet", "cord"] },
  { id: "stoff", label: "Webstoff & Leinen", keys: ["fabric", "melange", "chenille", "linen", "wool"] },
  { id: "leder", label: "Leder", keys: ["leather"] },
  { id: "holzhell", label: "Holz hell", keys: ["oak", "ash"] },
  { id: "holzdunkel", label: "Holz dunkel", keys: ["oakDark", "walnut", "burl", "mango"] },
  { id: "stein", label: "Stein & Keramik", keys: ["travertine", "marble", "marbleGreen", "marbleNoir", "stone", "ceramic"] },
  { id: "lack", label: "Lack & Kunststoff", keys: ["lacquer", "matte", "gloss", "plastic"] },
  { id: "metall", label: "Metall", keys: ["brass", "copper", "chrome", "steel", "blackMetal"] },
  { id: "glas", label: "Glas & Spiegel", keys: ["glass", "ribbedGlass", "opal", "mirror"] },
  { id: "natur", label: "Rattan & Papier", keys: ["rattan", "paper"] },
];
const GROUP_OF = new Map<MaterialKey, string>(MATERIAL_GROUPS.flatMap((g) => g.keys.map((k) => [k, g.id] as [MaterialKey, string])));

export function materialGroup(m: MaterialKey): string {
  return GROUP_OF.get(m) ?? "lack";
}

/** Farbfamilien und Materialgruppen, die eine Variante sichtbar prägen (alle Bauteile). */
export function variantTraits(v: CatalogVariant): { colors: Set<string>; materials: Set<string> } {
  const colors = new Set<string>();
  const materials = new Set<string>();
  for (const s of Object.values(v.slots)) {
    if (!s) continue;
    materials.add(materialGroup(s.material));
  }
  const p = primarySlot(v.slots);
  if (p) colors.add(colorFamily(p.color));
  return { colors, materials };
}

/** Index der ersten Variante, die Farbfamilie und Materialgruppe erfüllt (−1 = keine). */
export function matchVariant(c: CatalogItem, color: string, material: string): number {
  if (!color && !material) return 0;
  return c.variants.findIndex((v) => {
    const t = variantTraits(v);
    return (!color || t.colors.has(color)) && (!material || t.materials.has(material));
  });
}

/** CSS-Hintergrund, der Farbe und Materialcharakter eines Bauteils andeutet (Musterkarte). */
export function swatchBackground(s: SlotStyle): string {
  const c = s.color;
  switch (materialGroup(s.material)) {
    case "boucle":
      return `radial-gradient(circle at 30% 30%, rgba(255,255,255,.28) 0 1.2px, transparent 1.6px) 0 0/4px 4px, radial-gradient(circle at 70% 70%, rgba(0,0,0,.18) 0 1.2px, transparent 1.6px) 0 0/4px 4px, ${c}`;
    case "samt":
      return s.material === "cord"
        ? `repeating-linear-gradient(90deg, rgba(0,0,0,.16) 0 1.5px, transparent 1.5px 4px), ${c}`
        : `radial-gradient(circle at 35% 30%, rgba(255,255,255,.35), transparent 60%), ${c}`;
    case "stoff":
      return `repeating-linear-gradient(45deg, rgba(0,0,0,.07) 0 1px, transparent 1px 3px), repeating-linear-gradient(-45deg, rgba(255,255,255,.08) 0 1px, transparent 1px 3px), ${c}`;
    case "leder":
      return `radial-gradient(circle at 30% 25%, rgba(255,255,255,.3), transparent 55%), ${c}`;
    case "holzhell":
    case "holzdunkel":
      return `repeating-linear-gradient(100deg, rgba(0,0,0,.12) 0 1px, transparent 1px 5px, rgba(255,255,255,.08) 5px 6px, transparent 6px 9px), ${c}`;
    case "stein":
      return `linear-gradient(125deg, transparent 40%, rgba(0,0,0,.13) 42%, transparent 46%), linear-gradient(35deg, transparent 60%, rgba(0,0,0,.08) 62%, transparent 65%), ${c}`;
    case "metall":
      return `linear-gradient(135deg, rgba(255,255,255,.55), transparent 45%, rgba(0,0,0,.18) 80%), ${c}`;
    case "glas":
      return `linear-gradient(135deg, rgba(255,255,255,.7), rgba(255,255,255,.1) 50%, rgba(0,0,0,.08)), ${c}`;
    case "natur":
      return `repeating-linear-gradient(0deg, rgba(0,0,0,.14) 0 1px, transparent 1px 3px), repeating-linear-gradient(90deg, rgba(0,0,0,.1) 0 1px, transparent 1px 3px), ${c}`;
    default:
      return c;
  }
}
