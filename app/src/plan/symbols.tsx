import type { Archetype, PlacedItem } from "../model/types";

// Draufsicht-Symbole je Archetyp (lokales Koordinatensystem in cm, Ursprung = Mitte, Front = +y).

function tint(hex: string, f = 0.35): string {
  const h = hex.replace("#", "");
  const v = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  const r = (v >> 16) & 255, g = (v >> 8) & 255, b = v & 255;
  const m = (x: number) => Math.round(x + (255 - x) * f);
  return `rgb(${m(r)},${m(g)},${m(b)})`;
}

export function itemColors(it: PlacedItem) {
  const main = it.slots.main?.color ?? it.slots.top?.color ?? it.slots.frame?.color ?? "#c8c0b2";
  return { fill: tint(main, 0.15), stroke: "#4a443c", light: tint(main, 0.45) };
}

export function PlanSymbol({ it, arch }: { it: PlacedItem; arch: Archetype }) {
  const w = it.w * 100;
  const d = it.d * 100;
  const { fill, stroke, light } = itemColors(it);
  const sw = 0.8;
  const R = (x: number, y: number, ww: number, hh: number, rx = 2, f = fill, s = stroke, extra: Record<string, unknown> = {}) => (
    <rect x={x} y={y} width={Math.max(0.5, ww)} height={Math.max(0.5, hh)} rx={rx} fill={f} stroke={s} strokeWidth={sw} {...extra} />
  );
  const x0 = -w / 2, y0 = -d / 2;
  switch (arch) {
    case "sofa":
    case "sofaBed":
    case "sofaModular":
    case "armchairLounge":
    case "outdoorSofa": {
      const arm = Math.min(w * 0.18, Number(it.params?.armWidth ?? 0.2) * 100);
      const back = Math.min(d * 0.3, arch === "sofaModular" ? 25 : 20);
      const seats = Math.max(1, Math.round(Number(it.params?.seats ?? it.params?.modules ?? Math.max(1, Math.round(w / 90)))));
      const iw = w - 2 * arm;
      return (
        <g>
          {R(x0, y0, w, d, 8)}
          {R(x0 + arm, y0, iw, back, 4, light)}
          {R(x0, y0, arm, d, 6, light)}
          {R(x0 + w - arm, y0, arm, d, 6, light)}
          {Array.from({ length: seats }, (_, i) => <g key={i}>{R(x0 + arm + (iw / seats) * i + 1, y0 + back + 1, iw / seats - 2, d - back - 3, 5)}</g>)}
        </g>
      );
    }
    case "sofaCorner":
      return <g>{R(x0, y0, w, d * 0.45, 8)}{R(x0 + w * 0.6, y0, w * 0.4, d, 8)}{R(x0, y0, w, 20, 4, light)}</g>;
    case "sofaRound":
      return <g><path d={`M${x0},${y0 + d * 0.5} Q${x0},${y0} ${0},${y0} Q${-x0},${y0} ${-x0},${y0 + d * 0.5} Q${-x0},${-y0} 0,${-y0} Q${x0},${-y0} ${x0},${y0 + d * 0.5}Z`} fill={fill} stroke={stroke} strokeWidth={sw} /><path d={`M${x0 + 15},${y0 + d * 0.45} Q0,${y0 + 15} ${-x0 - 15},${y0 + d * 0.45}`} fill="none" stroke={stroke} strokeWidth={sw} /></g>;
    case "armchairRound":
    case "armchairShell":
    case "diningArmchair":
    case "armchairWing":
      return <g><rect x={x0} y={y0} width={w} height={d} rx={Math.min(w, d) * 0.42} fill={fill} stroke={stroke} strokeWidth={sw} /><rect x={x0 + w * 0.18} y={y0 + d * 0.22} width={w * 0.64} height={d * 0.62} rx={Math.min(w, d) * 0.25} fill={light} stroke={stroke} strokeWidth={sw * 0.7} /></g>;
    case "diningChair":
    case "cantilever":
    case "barStool":
    case "outdoorChair":
    case "officeChair":
      return <g>{R(x0, y0 + d * 0.15, w, d * 0.85, 6)}{R(x0 + 2, y0, w - 4, d * 0.18, 3, light)}</g>;
    case "pouf":
    case "sideRound":
    case "sideContainer":
    case "tableRound":
    case "tablePedestal":
    case "coffeeRound":
    case "outdoorTable":
    case "plantPot":
    case "vase":
    case "bowl":
    case "candles":
      return <ellipse cx={0} cy={0} rx={w / 2} ry={d / 2} fill={fill} stroke={stroke} strokeWidth={sw} />;
    case "tableOval":
      return <ellipse cx={0} cy={0} rx={w / 2} ry={d / 2} fill={fill} stroke={stroke} strokeWidth={sw} />;
    case "coffeeDuo": {
      const p = it.params ?? {};
      const a = { w: Number(p.a_w ?? 0.8) * 100, d: Number(p.a_d ?? 0.7) * 100, x: Number(p.a_x ?? -0.3) * 100, y: Number(p.a_y ?? 0) * 100 };
      const b = { w: Number(p.b_w ?? 0.7) * 100, d: Number(p.b_d ?? 0.53) * 100, x: Number(p.b_x ?? 0.3) * 100, y: Number(p.b_y ?? 0) * 100, r: Number(p.b_rot ?? 0) };
      return (
        <g>
          <rect x={a.x - a.w / 2} y={-a.y - a.d / 2} width={a.w} height={a.d} rx={12} fill={fill} stroke={stroke} strokeWidth={sw} />
          <g transform={`translate(${b.x},${-b.y}) rotate(${b.r})`}><rect x={-b.w / 2} y={-b.d / 2} width={b.w} height={b.d} rx={10} fill={light} stroke={stroke} strokeWidth={sw} /></g>
        </g>
      );
    }
    case "bed":
    case "bedWood": {
      const hb = Math.max(8, d - Number(it.params?.mattressL ?? 2) * 100 - 6);
      const mw = Math.min(w - 8, Number(it.params?.mattressW ?? 1.8) * 100);
      return (
        <g>
          {R(x0, y0, w, d, 4)}
          {R(x0, y0, w, hb, 3, light)}
          {R(-mw / 2, y0 + hb + 2, mw, d - hb - 6, 3, "#fbfaf7")}
          {R(-mw / 2 + 4, y0 + hb + 6, mw / 2 - 8, 40, 6, "#f1efe9")}
          {R(4, y0 + hb + 6, mw / 2 - 8, 40, 6, "#f1efe9")}
          <path d={`M${-mw / 2},${y0 + hb + 60} L${mw / 2},${y0 + hb + 60}`} stroke={stroke} strokeWidth={sw} />
          {R(-mw / 2 - 2, -y0 - 45, mw + 4, 38, 2, it.slots.accent?.color ?? "#d9cdb8")}
        </g>
      );
    }
    case "rugRect":
      return <rect x={x0} y={y0} width={w} height={d} rx={1} fill={fill} fillOpacity={0.55} stroke={stroke} strokeWidth={sw} strokeDasharray="4 3" />;
    case "rugRound":
      return <circle r={w / 2} fill={fill} fillOpacity={0.55} stroke={stroke} strokeWidth={sw} strokeDasharray="4 3" />;
    case "rugOrganic":
      return <ellipse rx={w / 2} ry={d / 2} fill={fill} fillOpacity={0.55} stroke={stroke} strokeWidth={sw} strokeDasharray="4 3" />;
    case "curtain": {
      const n = Math.max(6, Math.round(w / 6));
      let path = `M${x0},0`;
      for (let i = 1; i <= n; i++) path += ` Q${x0 + (w / n) * (i - 0.5)},${i % 2 ? -3 : 3} ${x0 + (w / n) * i},0`;
      return <g><line x1={x0} y1={-3} x2={-x0} y2={-3} stroke="#777" strokeWidth={1.2} /><path d={path} fill="none" stroke={stroke} strokeWidth={1} /></g>;
    }
    case "lampFloorShade":
    case "lampFloorGlobe":
    case "lampFloorArc":
    case "lampFloorTripod":
    case "lampTableMushroom":
    case "lampTableGlobe":
    case "lampTableShade":
    case "lampTableLayered":
    case "lampTask": {
      const r = Math.max(w, d) / 2;
      return <g><circle r={r} fill="#fff7e6" stroke="#b8703e" strokeWidth={sw} /><path d={`M${-r * 0.7},${-r * 0.7}L${r * 0.7},${r * 0.7}M${-r * 0.7},${r * 0.7}L${r * 0.7},${-r * 0.7}`} stroke="#b8703e" strokeWidth={sw} /></g>;
    }
    case "pendantGlobe":
    case "pendantDome":
    case "pendantCluster":
    case "pendantMirrorBall":
    case "ceilingDome":
    case "ceilingDisc": {
      const r = Math.max(w, d) / 2;
      return <g><circle r={r} fill="none" stroke="#8a6a4f" strokeWidth={sw} strokeDasharray="3 2" /><circle r={Math.min(4, r / 3)} fill="#8a6a4f" /></g>;
    }
    case "pendantLinear": {
      const n = Math.max(0, Number(it.params?.heads ?? 0));
      return (
        <g>
          {R(x0, y0, w, d, 2, "none", "#8a6a4f", { strokeDasharray: "3 2" })}
          {n >= 2 ? Array.from({ length: n }, (_, i) => <circle key={i} cx={x0 + (w / n) * (i + 0.5)} r={Math.min(d, w / n) * 0.35} fill="#8a6a4f" opacity={0.6} />) : <line x1={x0 + 4} x2={-x0 - 4} y1={0} y2={0} stroke="#8a6a4f" strokeWidth={1.5} />}
        </g>
      );
    }
    case "wallGlobe":
    case "wallSconce":
      return <g>{R(x0, y0, w, d, 4, "#fff7e6", "#b8703e")}</g>;
    case "plantTree":
    case "plantBush":
    case "glb": {
      const r = Math.max(w, d) / 2;
      const leaves = Array.from({ length: 7 }, (_, i) => {
        const a = (i / 7) * Math.PI * 2;
        return <ellipse key={i} cx={Math.cos(a) * r * 0.45} cy={Math.sin(a) * r * 0.45} rx={r * 0.45} ry={r * 0.22} transform={`rotate(${(a * 180) / Math.PI} ${Math.cos(a) * r * 0.45} ${Math.sin(a) * r * 0.45})`} fill="#a9bf98" stroke="#5b6e45" strokeWidth={0.5} />;
      });
      return <g>{leaves}<circle r={r * 0.2} fill="#8a7a62" /></g>;
    }
    case "wardrobe": {
      const n = Math.max(1, Math.round(Number(it.params?.doors ?? Math.round(w / 50))));
      return (
        <g>
          {R(x0, y0, w, d, 1)}
          {Array.from({ length: n - 1 }, (_, i) => <line key={i} x1={x0 + (w / n) * (i + 1)} y1={y0} x2={x0 + (w / n) * (i + 1)} y2={-y0} stroke={stroke} strokeWidth={0.5} />)}
          <line x1={x0} y1={-y0 - 2} x2={-x0} y2={-y0 - 2} stroke={stroke} strokeWidth={sw} />
          <path d={`M${x0 + 3},${y0 + 3}L${-x0 - 3},${-y0 - 4}M${x0 + 3},${-y0 - 4}L${-x0 - 3},${y0 + 3}`} stroke={stroke} strokeWidth={0.35} />
        </g>
      );
    }
    case "lamella": {
      const n = Math.floor(w / 4);
      return <g>{R(x0, y0, w, d, 0, "#2a2a2a", "#2a2a2a")}{Array.from({ length: n }, (_, i) => <rect key={i} x={x0 + i * 4} y={y0} width={2.7} height={d} fill={fill} />)}</g>;
    }
    case "art":
    case "artPair":
    case "mirrorRound":
    case "mirrorArch":
    case "mirrorRect":
    case "molding":
    case "panelWall":
    case "tv":
      return R(x0, y0, w, Math.max(d, 2), 0.5, fill, stroke);
    case "tvFrame": {
      if (!it.params?.stand) return R(x0, y0, w, Math.max(d, 2.5), 0.5, "#2a2a2a", "#111");
      const pd = 2.5;
      const span = (Number(it.params.standW) || it.w * 0.7) * 100;
      return (
        <g>
          {[-1, 1].map((sx) => <g key={sx}>{R(sx * (span / 2 - 3) - 3, y0, 6, d, 1, "#9a9a9a", "#555")}</g>)}
          {R(x0, -pd / 2, w, pd, 0.5, "#2a2a2a", "#111")}
        </g>
      );
    }
    case "kitchenRun":
      return (
        <g>
          {R(x0, y0, w, d, 1, "#e8e4dc")}
          {R(x0, y0, Number(it.params?.tallUnits ?? 1.2) * 100, d, 1, "#cfc6b8")}
          <rect x={x0 + w * Number(it.params?.sink ?? 0.55) - 25 + Number(it.params?.tallUnits ?? 1.2) * 45} y={y0 + 10} width={50} height={40} rx={4} fill="#fff" stroke={stroke} strokeWidth={sw} />
          {[0, 1, 2, 3].map((i) => <circle key={i} cx={x0 + Number(it.params?.tallUnits ?? 1.2) * 100 + (w - Number(it.params?.tallUnits ?? 1.2) * 100) * Number(it.params?.hob ?? 0.3) + (i % 2 ? 12 : -12)} cy={(i < 2 ? -10 : 10)} r={8} fill="none" stroke={stroke} strokeWidth={0.6} />)}
        </g>
      );
    case "bathtub":
      return <g>{R(x0, y0, w, d, 6, "#fff")}{R(x0 + 6, y0 + 6, w - 12, d - 12, 18, "#f3f6f7")}</g>;
    case "toilet":
      return <g>{R(x0, y0, w, 12, 2, "#fff")}<ellipse cx={0} cy={y0 + 12 + (d - 12) / 2} rx={w / 2} ry={(d - 12) / 2} fill="#fff" stroke={stroke} strokeWidth={sw} /></g>;
    case "washbasin":
      return <g>{R(x0, y0, w, d, 4, "#fff")}<ellipse cx={0} cy={2} rx={w * 0.35} ry={d * 0.3} fill="#f3f6f7" stroke={stroke} strokeWidth={0.5} /></g>;
    case "shower":
      return <g>{R(x0, y0, w, d, 1, "#f2f4f5")}<path d={`M${x0},${y0}L${-x0},${-y0}M${x0},${-y0}L${-x0},${y0}`} stroke="#aab" strokeWidth={0.5} /></g>;
    case "washer":
      return <g>{R(x0, y0, w, d, 3, "#fff")}<circle r={Math.min(w, d) * 0.3} fill="none" stroke={stroke} strokeWidth={sw} /></g>;
    case "cushion":
    case "throw":
      return R(x0, y0, w, d, 4, fill, stroke);
    default:
      return R(x0, y0, w, d, 2);
  }
}
