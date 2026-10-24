// Bodenbeläge im 2D-Plan: echte Farbe des Belags und ein maßstäbliches Fugen-/Dielenbild je Raum.
import type { FloorFinish } from "../model/types";

/** Farbe aufhellen (f > 1) oder abdunkeln (f < 1). */
export function shadeHex(hex: string, f: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(f >= 1 ? v + (255 - v) * (f - 1) : v * f)));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => ch(v).toString(16).padStart(2, "0")).join("")}`;
}

/** Plan-Farbe des Belags: leicht entsättigt aufgehellt, damit Möbel und Wände klar davor stehen. */
export function floorTone(f: FloorFinish | undefined): string {
  if (!f?.color) return "#ece6db";
  return shadeHex(f.color, 1.14);
}

/** Muster eines Belags (Einheit cm, im Raum um `angle` gedreht). */
export function FloorPattern({ id, f, cx, cy }: { id: string; f: FloorFinish; cx: number; cy: number }) {
  const base = floorTone(f);
  const line = shadeHex(base, 0.86);
  const alt = shadeHex(base, 0.955);
  const rot = `rotate(${f.angle ?? 0} ${cx} ${cy})`;
  const sw = 0.55;
  switch (f.kind) {
    case "planks":
    case "deck": {
      const L = (f.plankLength ?? (f.kind === "deck" ? 2.4 : 1.9)) * 100;
      const W = (f.plankWidth ?? (f.kind === "deck" ? 0.14 : 0.19)) * 100;
      return (
        <pattern id={id} width={L} height={W * 3} patternUnits="userSpaceOnUse" patternTransform={rot}>
          <rect width={L} height={W * 3} fill={base} />
          <rect y={W} width={L} height={W} fill={alt} />
          <path d={`M0 ${W}H${L}M0 ${2 * W}H${L}M0 ${3 * W}H${L}M${L * 0.62} 0V${W}M${L * 0.18} ${W}V${2 * W}M${L * 0.84} ${2 * W}V${3 * W}`} stroke={line} strokeWidth={sw} fill="none" />
        </pattern>
      );
    }
    case "herringbone":
    case "chevron": {
      // Zickzack-Reihen; Fischgrät zusätzlich mit versetzten Stoßfugen
      const W = (f.plankWidth ?? 0.09) * 100;
      const L = (f.plankLength ?? 0.6) * 100;
      const a = L * Math.SQRT1_2;
      const h = W * Math.SQRT2;
      const herr = f.kind === "herringbone";
      // Zickzack unter 45°, Reihenabstand h; Reihen oberhalb ragen in die Kachel hinein
      const n = Math.ceil(a / h) + 1;
      const rows = Array.from({ length: n + 1 }, (_, k) => h - k * h);
      return (
        <pattern id={id} width={2 * a} height={h} patternUnits="userSpaceOnUse" patternTransform={rot}>
          <rect width={2 * a} height={h} fill={base} />
          <path d={rows.map((y) => `M0 ${y}L${a} ${y + a}L${2 * a} ${y}`).join("")} stroke={line} strokeWidth={sw} fill="none" />
          <path d={`M${a} 0V${h}`} stroke={line} strokeWidth={sw} fill="none" />
          {herr && <path d={`M0 0V${h}M${2 * a} 0V${h}`} stroke={line} strokeWidth={sw * 0.7} fill="none" opacity={0.6} />}
        </pattern>
      );
    }
    case "tiles": {
      const T = (f.tileSize ?? 0.6) * 100;
      return (
        <pattern id={id} width={T} height={T} patternUnits="userSpaceOnUse" patternTransform={rot}>
          <rect width={T} height={T} fill={base} />
          <path d={`M${T} 0H0V${T}`} stroke={line} strokeWidth={0.7} fill="none" />
        </pattern>
      );
    }
    case "stone": {
      const T = (f.tileSize ?? 0.8) * 100;
      const H = T / 2;
      return (
        <pattern id={id} width={T} height={H * 2} patternUnits="userSpaceOnUse" patternTransform={rot}>
          <rect width={T} height={H * 2} fill={base} />
          <rect y={H} width={T} height={H} fill={alt} />
          <path d={`M0 0H${T}M0 ${H}H${T}M0 0V${H}M${T / 2} ${H}V${2 * H}`} stroke={line} strokeWidth={0.7} fill="none" />
        </pattern>
      );
    }
    case "terrazzo": {
      const chip = f.color2 ? shadeHex(f.color2, 1.1) : shadeHex(base, 0.7);
      return (
        <pattern id={id} width={24} height={24} patternUnits="userSpaceOnUse">
          <rect width={24} height={24} fill={base} />
          {[
            [3, 4, 1.3],
            [14, 2, 0.8],
            [19, 11, 1.5],
            [8, 15, 1],
            [21, 21, 0.7],
            [2, 20, 0.9],
            [12, 9, 0.6],
          ].map(([x, y, r], i) => (
            <circle key={i} cx={x} cy={y} r={r} fill={i % 2 ? chip : line} opacity={0.75} />
          ))}
        </pattern>
      );
    }
    case "carpet":
      return (
        <pattern id={id} width={6} height={6} patternUnits="userSpaceOnUse">
          <rect width={6} height={6} fill={base} />
          <circle cx={1.5} cy={1.5} r={0.5} fill={line} opacity={0.5} />
          <circle cx={4.5} cy={4.5} r={0.5} fill={line} opacity={0.5} />
        </pattern>
      );
    case "microcement":
    default:
      return (
        <pattern id={id} width={80} height={80} patternUnits="userSpaceOnUse">
          <rect width={80} height={80} fill={base} />
          <circle cx={20} cy={24} r={18} fill={alt} opacity={0.6} />
          <circle cx={60} cy={58} r={22} fill={alt} opacity={0.5} />
        </pattern>
      );
  }
}
