import { memo, useEffect, useMemo } from "react";
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
}

const selMat = new THREE.LineBasicMaterial({ color: "#2563eb", depthTest: false, transparent: true, opacity: 0.95 });
const hovMat = new THREE.LineBasicMaterial({ color: "#60a5fa", depthTest: false, transparent: true, opacity: 0.6 });

function ItemMeshImpl({ item, selected, hovered, onDown, onOver }: Props) {
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

  const box = useMemo(() => {
    const g = new THREE.EdgesGeometry(new THREE.BoxGeometry(item.w + 0.02, item.h + 0.02, item.d + 0.02));
    g.translate(0, item.h / 2, 0);
    return g;
  }, [item.w, item.h, item.d]);

  if (item.hidden) return null;
  return (
    <group
      position={[item.x, item.elev, item.y]}
      rotation={[0, (-item.rot * Math.PI) / 180, 0]}
      onPointerDown={onDown ? (e) => onDown(e, item) : undefined}
      onPointerOver={onOver ? (e) => (e.stopPropagation(), onOver(item.id)) : undefined}
      onPointerOut={onOver ? () => onOver(null) : undefined}
    >
      <primitive object={obj} />
      {(selected || hovered) && <lineSegments geometry={box} material={selected ? selMat : hovMat} renderOrder={999} />}
    </group>
  );
}

export const ItemMesh = memo(ItemMeshImpl);
