import { memo, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { isCutAway } from "./cutaway";
import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";
import type { PlacedItem } from "../model/types";
import { getCatalogItem } from "../store/project";
import { buildFurniture } from "./furniture";
import { apartment } from "../data";

interface Props {
  item: PlacedItem;
  selected: boolean;
  hovered: boolean;
  onDown?: (e: ThreeEvent<PointerEvent>, item: PlacedItem) => void;
  onOver?: (id: string | null) => void;
  /** Schnitthöhe der Wände (null = raumhoch) */
  cut?: number | null;
}

// Auswahlrahmen nie treffen (Linien hätten sonst eine Treffer-Toleranz von 1 m)
const noRaycast = () => {};
const selMat = new THREE.LineBasicMaterial({ color: "#2563eb", depthTest: false, transparent: true, opacity: 0.95 });
const hovMat = new THREE.LineBasicMaterial({ color: "#60a5fa", depthTest: false, transparent: true, opacity: 0.6 });

function ItemMeshImpl({ item, selected, hovered, onDown, onOver, cut = null }: Props) {
  const cat = getCatalogItem(item.catalogId);
  const archetype = cat?.archetype ?? "box";
  const ceilingGap = item.mount === "ceiling" && archetype.startsWith("pendant") ? Math.max(0, apartment.ceilingHeight - item.elev - item.h) : 0;
  const slotsKey = JSON.stringify(item.slots);
  const paramsKey = JSON.stringify(item.params ?? {});
  const obj = useMemo(
    () =>
      buildFurniture({
        archetype,
        w: item.w,
        d: item.d,
        h: item.h,
        slots: item.slots,
        params: { ...(item.params ?? {}), ceilingGap, name: cat?.name ?? "" },
        model: cat?.model,
        seedKey: item.id,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [archetype, item.w, item.d, item.h, slotsKey, paramsKey, ceilingGap, cat?.model, item.id],
  );
  useEffect(() => {
    obj.traverse((o) => {
      o.userData.itemId = item.id;
    });
    return () => {
      obj.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh && m.geometry) m.geometry.dispose();
      });
    };
  }, [obj, item.id]);

  // Wandmodus „Auto“: Wandobjekte und Vorhänge an gekappten Wänden bleiben sichtbar; sieht man sie
  // von hinten (Kamera jenseits der Wand), werden sie durchscheinend, damit der Blick frei bleibt.
  const ghostable = (archetype === "curtain" || item.mount === "wall") && item.id !== "ghost";
  const ghost = useRef<{ on: boolean; orig: Map<THREE.Mesh, THREE.Material | THREE.Material[]> }>({ on: false, orig: new Map() });
  const frame = useRef(Math.floor(Math.random() * 8));
  useFrame(({ camera }) => {
    if (!ghostable || frame.current++ % 8) return;
    const r = (item.rot * Math.PI) / 180;
    const back = item.d / 2 + 0.12;
    const behind = -Math.sin(r) * (camera.position.x - item.x) + Math.cos(r) * (camera.position.z - item.y) < 0;
    const on = !selected && behind && isCutAway(item.x + Math.sin(r) * back, 1.5, item.y - Math.cos(r) * back);
    const g = ghost.current;
    if (on === g.on) return;
    g.on = on;
    obj.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      if (on) {
        g.orig.set(m, m.material);
        const conv = (x: THREE.Material) => {
          const c = x.clone();
          c.transparent = true;
          c.opacity = 0.28;
          c.depthWrite = false;
          return c;
        };
        m.material = Array.isArray(m.material) ? m.material.map(conv) : conv(m.material);
        m.castShadow = false;
      } else if (g.orig.has(m)) {
        const cur = m.material;
        (Array.isArray(cur) ? cur : [cur]).forEach((x) => x.dispose());
        m.material = g.orig.get(m)!;
        m.castShadow = true;
      }
    });
    if (!on) g.orig.clear();
  });
  useEffect(() => {
    ghost.current = { on: false, orig: new Map() };
  }, [obj]);

  const box = useMemo(() => {
    const g = new THREE.EdgesGeometry(new THREE.BoxGeometry(item.w + 0.02, item.h + 0.02, item.d + 0.02));
    g.translate(0, item.h / 2, 0);
    return g;
  }, [item.w, item.h, item.d]);

  if (item.hidden) return null;
  // Bei geschnittenen Wänden würden Wandobjekte und Vorhänge frei im Raum schweben
  if (cut != null && !selected && (item.mount === "wall" || archetype === "curtain") && item.elev + item.h > cut + 0.05) return null;
  return (
    <group
      position={[item.x, item.elev, item.y]}
      rotation={[0, (-item.rot * Math.PI) / 180, 0]}
      onPointerDown={onDown ? (e) => onDown(e, item) : undefined}
      onPointerOver={onOver ? (e) => (e.stopPropagation(), onOver(item.id)) : undefined}
      onPointerOut={onOver ? () => onOver(null) : undefined}
    >
      <primitive object={obj} />
      {(selected || hovered) && <lineSegments geometry={box} material={selected ? selMat : hovMat} renderOrder={999} raycast={noRaycast} />}
    </group>
  );
}

export const ItemMesh = memo(ItemMeshImpl);
