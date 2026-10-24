import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { CameraControls, PointerLockControls } from "@react-three/drei";
import { EffectComposer, N8AO, SMAA, Bloom, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { apartment, wallFaces } from "../data";
import { useEditor, getCatalogItem, newItemFromCatalog } from "../store/project";
import type { PlacedItem } from "../model/types";
import { buildApartment } from "./apartment";
import { ItemMesh } from "./ItemMesh";
import { wallClipPlanes } from "./surfaces";
import { cutUniforms } from "./cutaway";
import { setNightGlow } from "./materials";
import { nearestFace, pointInPolygon, rotationForFace } from "../model/geometry";
import type { SnapGuide } from "../model/snap";
import { DND_TYPE, type CatalogDrop } from "../ui/dnd";
import { applyPlacementSnap, beginDrag, dragUpdate, isFlatFloorItem } from "../store/placement";
import { DEFAULT_SITE, sunDirection, sunPosition, sunTimes } from "./solar";
import { useView3D } from "./viewStore";
import { inFurniture } from "./views";
import { View3DPanel } from "../ui/View3DPanel";

const CEIL = apartment.ceilingHeight;
const CENTER = new THREE.Vector3((apartment.bounds[0] + apartment.bounds[2]) / 2, 0, (apartment.bounds[1] + apartment.bounds[3]) / 2);
const LAMP_CATS = new Set(["floorLamp", "tableLamp", "pendant", "ceilingLamp", "wallLamp"]);

/** Aktueller Sonnenstand aus Projekteinstellungen (bzw. laufender Tagesverlauf-Animation). */
function useSun() {
  const date = useEditor((s) => s.project.settings.sunDate);
  const time = useEditor((s) => s.project.settings.timeOfDay ?? 15);
  const north = useEditor((s) => s.project.settings.northDeg ?? 0);
  const lat = useEditor((s) => s.project.settings.latitude ?? DEFAULT_SITE.latitude);
  const lon = useEditor((s) => s.project.settings.longitude ?? DEFAULT_SITE.longitude);
  const anim = useView3D((s) => s.animTime);
  return useMemo(() => {
    const pos = sunPosition(date, anim ?? time, { latitude: lat, longitude: lon });
    const dir = sunDirection(pos, north);
    // Tageslichtanteil: 0 bei bürgerlicher Dämmerung (−6°), 1 ab 12° Sonnenhöhe
    const day = THREE.MathUtils.clamp((pos.elevation + 6) / 18, 0, 1);
    return { pos, dir, day };
  }, [date, time, north, lat, lon, anim]);
}

function Environment() {
  const { gl, scene } = useThree();
  const camera3d = useEditor((s) => s.camera3d);
  const night = useEditor((s) => s.night);
  const { day } = useSun();
  useEffect(() => {
    const pm = new THREE.PMREMGenerator(gl);
    const env = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.55;
    return () => {
      env.dispose();
      pm.dispose();
    };
  }, [gl, scene]);
  useEffect(() => {
    let tex: THREE.Texture | null = null;
    let cancelled = false;
    if (camera3d === "walk" && !night) {
      new RGBELoader().load(`${import.meta.env.BASE_URL}assets/hdri/sky_1k.hdr`, (t) => {
        if (cancelled) return t.dispose();
        t.mapping = THREE.EquirectangularReflectionMapping;
        tex = t;
        scene.background = t;
      });
    } else {
      scene.background = new THREE.Color(night ? "#1b1d22" : "#e9e7e2");
    }
    return () => {
      cancelled = true;
      tex?.dispose();
    };
  }, [camera3d, night, scene]);
  useEffect(() => {
    // Himmel/Umgebung folgen der Dämmerung
    const d = night ? 0 : day;
    scene.environmentIntensity = night ? 0.08 : 0.12 + 0.43 * d;
    scene.backgroundIntensity = 0.15 + 0.75 * d;
    setNightGlow(night ? 2.2 : 0);
  }, [night, scene, day]);
  return null;
}

const SHADOW_MAP = { hoch: 4096, mittel: 2048, niedrig: 1024 } as const;
const SUN_LOW = new THREE.Color("#ffad66");
const SUN_HIGH = new THREE.Color("#fff3e2");

function Sun() {
  const night = useEditor((s) => s.night);
  const quality = useEditor((s) => s.quality);
  const { pos: sp, dir, day } = useSun();
  const ref = useRef<THREE.DirectionalLight>(null);
  const { scene } = useThree();
  const target = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.copy(CENTER);
    return o;
  }, []);
  useEffect(() => {
    scene.add(target);
    return () => {
      scene.remove(target);
    };
  }, [scene, target]);
  useEffect(() => {
    if (ref.current) ref.current.target = target;
  }, [target]);
  // Schattenauflösung nach Qualitätsstufe (Schattenkarte neu anlegen)
  useEffect(() => {
    const l = ref.current;
    if (!l) return;
    l.shadow.mapSize.set(SHADOW_MAP[quality], SHADOW_MAP[quality]);
    l.shadow.map?.dispose();
    l.shadow.map = null as unknown as THREE.WebGLRenderTarget;
  }, [quality]);
  const el = sp.elevation;
  const pos = CENTER.clone().add(new THREE.Vector3(...dir).multiplyScalar(30));
  // Direktes Sonnenlicht blendet am Horizont ein und ist bei tiefer Sonne wärmer und schwächer
  const direct = night ? 0 : THREE.MathUtils.clamp((el + 1) / 7, 0, 1) * (0.45 + 0.55 * THREE.MathUtils.clamp(el / 35, 0, 1));
  const color = SUN_LOW.clone().lerp(SUN_HIGH, THREE.MathUtils.clamp(el / 30, 0, 1));
  const d = night ? 0 : day;
  return (
    <>
      <hemisphereLight args={["#f3f1ec", "#b9ad9c", night ? 0.05 : 0.08 + 0.47 * d]} />
      <ambientLight intensity={night ? 0.04 : 0.03 + 0.09 * d} />
      <directionalLight
        ref={ref}
        position={pos}
        intensity={3.4 * direct}
        color={color}
        castShadow={direct > 0}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
        shadow-camera-near={1}
        shadow-camera-far={70}
      />
    </>
  );
}

/** Lichtfarbe einer Lampe (Farbtemperatur in Kelvin → RGB, Näherung nach Tanner Helland). */
export function kelvinColor(k: number): THREE.Color {
  const t = k / 100;
  const r = t <= 66 ? 255 : 329.7 * Math.pow(t - 60, -0.1332);
  const g = t <= 66 ? 99.47 * Math.log(t) - 161.12 : 288.12 * Math.pow(t - 60, -0.0755);
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.52 * Math.log(t - 10) - 305.04;
  const c = (v: number) => THREE.MathUtils.clamp(v, 0, 255) / 255;
  return new THREE.Color().setRGB(c(r), c(g), c(b), THREE.SRGBColorSpace);
}

const LAMP_LIMIT = { hoch: 24, mittel: 12, niedrig: 6 } as const;

/**
 * Abendlicht: Lichtquellen an den Lichtpunkten der Leuchtenmodelle (Lumen aus dem Modell),
 * die hellsten zuerst. Leuchten ohne Lichtpunkt (z. B. importierte Modelle) erhalten einen Ersatzpunkt.
 */
function LampLights() {
  const items = useEditor((s) => s.project.items);
  const night = useEditor((s) => s.night);
  const quality = useEditor((s) => s.quality);
  const kelvin = useEditor((s) => s.project.settings.lampKelvin ?? 2900);
  const scene = useThree((s) => s.scene);
  const [lights, setLights] = useState<{ key: string; p: [number, number, number]; lumen: number; down: boolean }[]>([]);
  useEffect(() => {
    if (!night) {
      setLights([]);
      return;
    }
    const id = requestAnimationFrame(() => {
      scene.updateMatrixWorld();
      const out: { key: string; p: [number, number, number]; lumen: number; down: boolean }[] = [];
      const seen = new Set<string>();
      scene.traverse((o) => {
        const L = o.userData.light as { lumen: number; kind: string } | undefined;
        const itemId = o.userData.itemId as string | undefined;
        if (!L || !itemId || itemId === "ghost") return;
        const v = o.getWorldPosition(new THREE.Vector3());
        seen.add(itemId);
        out.push({ key: `${itemId}:${out.length}`, p: [v.x, v.y - (L.kind === "down" ? 0.05 : 0), v.z], lumen: L.lumen, down: L.kind === "down" });
      });
      for (const i of items) {
        if (i.hidden || seen.has(i.id) || !LAMP_CATS.has(getCatalogItem(i.catalogId)?.category ?? "")) continue;
        const cat = getCatalogItem(i.catalogId)!.category;
        const y = cat === "ceilingLamp" ? i.elev - 0.05 : cat === "pendant" ? i.elev + i.h * 0.3 : i.elev + i.h * 0.7;
        out.push({ key: i.id, p: [i.x, y, i.y], lumen: cat === "ceilingLamp" || cat === "pendant" ? 1200 : 600, down: false });
      }
      out.sort((a, b) => b.lumen - a.lumen);
      setLights(out.slice(0, LAMP_LIMIT[quality]));
    });
    return () => cancelAnimationFrame(id);
  }, [night, items, scene, quality]);
  // Teilweiser Weißabgleich wie beim Auge: 2700 K wirkt warm, aber nicht orange
  const color = useMemo(() => kelvinColor(kelvin).lerp(new THREE.Color("#ffffff"), 0.45), [kelvin]);
  if (!night) return null;
  // Lichtstrom → Lichtstärke (Lumen / 4π), auf die Belichtung der Szene skaliert
  return (
    <>
      {lights.map((l) => (
        <pointLight key={l.key} position={l.p} intensity={(l.lumen / (4 * Math.PI)) * 0.023 * (l.down ? 1.3 : 1)} distance={l.lumen > 1000 ? 7 : 4.5} decay={1.6} color={color} />
      ))}
    </>
  );
}

const unclippedDepth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });

/**
 * Unsichtbare Geschossdecke, die nur Schatten wirft: Auch bei ausgeblendeter Decke fällt
 * Sonnenlicht dann ausschließlich durch Fenster und Balkontüren in die Wohnung.
 */
const shadowRoof = (() => {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  const polys = [...apartment.rooms.filter((r) => !r.outdoor).map((r) => r.polygon), ...apartment.walls, apartment.shaft];
  for (const poly of polys) {
    if (!poly || poly.length < 3) continue;
    const shape = new THREE.Shape(poly.map(([x, y]) => new THREE.Vector2(x, -y)));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.2, bevelEnabled: false });
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, CEIL + 0.005, 0);
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    m.raycast = () => {};
    g.add(m);
  }
  return g;
})();

function ApartmentModel() {
  const rooms = useEditor((s) => s.project.rooms);
  const walls = useEditor((s) => s.project.walls);
  const doors = useEditor((s) => s.project.settings.doorsOpen);
  const ausbau = useEditor((s) => `${s.project.settings.doorColor}|${s.project.settings.doorStyle}|${s.project.settings.handleFinish}|${s.project.settings.windowFrameColor}`);
  const interior = useView3D((s) => s.interior);
  const showCeiling = useEditor((s) => s.showCeiling || s.camera3d === "walk") || interior;
  const realDaylight = useView3D((s) => s.realDaylight);
  const selectedFace = useEditor((s) => s.selectedFace);
  const built = useMemo(() => {
    const b = buildApartment({ ...useEditor.getState().project, rooms, walls, settings: { ...useEditor.getState().project.settings, doorsOpen: doors } });
    // Schatten immer von raumhohen Wänden: Schnitt/Kappung gilt nur für die Darstellung
    b.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.castShadow && !Array.isArray(m.material) && m.material.clippingPlanes?.length) m.customDepthMaterial = unclippedDepth;
    });
    return b;
  }, [rooms, walls, doors, ausbau]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    built.group.traverse((o) => {
      if (o.userData.ceiling) o.visible = showCeiling;
    });
  }, [built, showCeiling]);
  const highlight = useMemo(() => {
    if (!selectedFace) return null;
    const f = wallFaces.find((x) => x.id === selectedFace);
    if (!f) return null;
    const g = new THREE.BufferGeometry();
    const off = 0.02;
    const pts = [
      [f.a[0] + f.n[0] * off, 0.02, f.a[1] + f.n[1] * off],
      [f.b[0] + f.n[0] * off, 0.02, f.b[1] + f.n[1] * off],
      [f.b[0] + f.n[0] * off, CEIL - 0.02, f.b[1] + f.n[1] * off],
      [f.a[0] + f.n[0] * off, CEIL - 0.02, f.a[1] + f.n[1] * off],
    ];
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts.flat(), 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    return g;
  }, [selectedFace]);
  const onDown = useCallback((e: ThreeEvent<PointerEvent>) => {
    const st = useEditor.getState();
    if (st.placing || st.camera3d === "walk") return;
    const obj = e.object;
    if (e.button !== 0) return;
    if (obj.userData.faceId) {
      e.stopPropagation();
      st.selectFace(obj.userData.faceId);
      st.selectRoom(obj.userData.faceId.split(":")[0]);
    } else if (obj.userData.roomId) {
      st.select([]);
      st.selectFace(null);
      st.selectRoom(obj.userData.roomId);
    }
  }, []);
  return (
    <group onPointerDown={onDown}>
      <primitive object={built.group} />
      {realDaylight && <primitive object={shadowRoof} />}
      {highlight && (
        <mesh geometry={highlight} renderOrder={5}>
          <meshBasicMaterial color="#2563eb" transparent opacity={0.16} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

/** Ziehen von Objekten im 3D (Boden-/Wand-/Deckenebene). */
function useDrag(controls: React.RefObject<CameraControls | null>) {
  const { camera, gl } = useThree();
  return useCallback(
    (e: ThreeEvent<PointerEvent>, item: PlacedItem) => {
      // Nur die linke Taste wählt/verschiebt; rechte und mittlere Taste bewegen immer die Ansicht
      if (e.button !== 0) return;
      const st = useEditor.getState();
      if (st.placing) return;
      e.stopPropagation();
      const additive = e.nativeEvent.shiftKey || e.nativeEvent.ctrlKey || e.nativeEvent.metaKey;
      const wasSelected = st.selection.includes(item.id);
      if (!wasSelected || additive) st.select([item.id], additive);
      if (st.camera3d === "walk" || item.locked) return;
      // Großflächige, flache Objekte (Teppiche) erst nach der Auswahl verschieben – sonst würde
      // jedes Drehen der Ansicht über dem Teppich ihn mitziehen
      if (!wasSelected && isFlatFloorItem(item)) return;
      const ids = useEditor.getState().selection.filter((id) => !useEditor.getState().project.items.find((i) => i.id === id)?.locked);
      const ds = beginDrag(ids, useEditor.getState().project.items);
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(item.mount === "floor" ? item.elev : item.elev));
      const ray = new THREE.Raycaster();
      const ndc = new THREE.Vector2();
      const hit = (ev: PointerEvent) => {
        const r = gl.domElement.getBoundingClientRect();
        ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
        ray.setFromCamera(ndc, camera);
        const p = new THREE.Vector3();
        return ray.ray.intersectPlane(plane, p) ? p : null;
      };
      const p0 = hit(e.nativeEvent);
      if (!p0) return;
      let moved = false;
      const sx = e.nativeEvent.clientX, sy = e.nativeEvent.clientY;
      if (controls.current) controls.current.enabled = false;
      const move = (ev: PointerEvent) => {
        const p = hit(ev);
        if (!p) return;
        let dx = p.x - p0.x;
        let dy = p.z - p0.z;
        // Erst ab 4 px Mausweg verschieben (Klick bleibt Klick)
        if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 4) return;
        if (!moved) {
          useEditor.getState().commit("Verschieben");
          moved = true;
        }
        const snapOn = useEditor.getState().project.settings.snap && !ev.altKey;
        if (snapOn) {
          const g = useEditor.getState().project.settings.gridSize || 0.05;
          dx = Math.round(dx / g) * g;
          dy = Math.round(dy / g) * g;
        }
        const st = useEditor.getState();
        const u = dragUpdate(ds, dx, dy, snapOn, st.project.items);
        st.updateItems(u.ids, u.apply, { commit: false });
        st.set("snapGuides", u.guides);
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        if (controls.current) controls.current.enabled = true;
        if (useEditor.getState().snapGuides.length) useEditor.getState().set("snapGuides", []);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [camera, gl, controls],
  );
}

function Items({ controls }: { controls: React.RefObject<CameraControls | null> }) {
  const items = useEditor((s) => s.project.items);
  const selection = useEditor((s) => s.selection);
  const hoverId = useEditor((s) => s.hoverId);
  const setHover = useEditor((s) => s.setHover);
  const onDown = useDrag(controls);
  const sel = useMemo(() => new Set(selection), [selection]);
  const wallMode = useEffectiveWallMode();
  const cut = wallMode === "full" || wallMode === "auto" ? null : wallMode === "cut" ? 1.3 : 0.14;
  const onDouble = (e: ThreeEvent<MouseEvent>) => {
    const id = e.object.userData.itemId as string | undefined;
    const it = id && useEditor.getState().project.items.find((i) => i.id === id);
    if (!it) return;
    e.stopPropagation();
    useEditor.getState().requestFocus(it.x, it.y);
  };
  return (
    <group onDoubleClick={onDouble}>
      {items.map((it) => (
        <ItemMesh key={it.id} item={it} selected={sel.has(it.id)} hovered={hoverId === it.id} onDown={onDown} onOver={setHover} cut={cut} />
      ))}
    </group>
  );
}

function PlacementGhost() {
  const placing = useEditor((s) => s.placing);
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: CENTER.x, y: CENTER.z });
  const { gl, camera } = useThree();
  // Drag & Drop aus dem Katalog: Bodenpunkt unter dem Mauszeiger
  useEffect(() => {
    const el = gl.domElement;
    const ray = new THREE.Raycaster();
    const floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = (e: DragEvent) => {
      const r = el.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
      const p = new THREE.Vector3();
      return ray.ray.intersectPlane(floor, p) ? p : null;
    };
    const over = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes(DND_TYPE)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      const p = hit(e);
      if (p) setPos({ x: p.x, y: p.z });
    };
    const drop = (e: DragEvent) => {
      const raw = e.dataTransfer?.getData(DND_TYPE);
      if (!raw) return;
      e.preventDefault();
      const p = hit(e);
      const { catalogId, variant } = JSON.parse(raw) as CatalogDrop;
      if (p) useEditor.getState().addFromCatalog(catalogId, variant, p.x, p.z);
      useEditor.getState().set("placing", null);
    };
    el.addEventListener("dragover", over);
    el.addEventListener("drop", drop);
    return () => {
      el.removeEventListener("dragover", over);
      el.removeEventListener("drop", drop);
    };
  }, [gl, camera]);
  const ghost = useMemo(() => {
    if (!placing) return null;
    const c = getCatalogItem(placing.catalogId);
    if (!c) return null;
    const it = newItemFromCatalog(c, placing.variant, pos.x, pos.y, 8);
    it.id = "ghost";
    if (c.mount === "floor") {
      const nf = nearestFace(wallFaces, pos.x, pos.y, Math.max(it.d, 0.5));
      if (nf) it.rot = rotationForFace(nf.face);
    }
    const st = useEditor.getState();
    const guides = applyPlacementSnap(it, st.project.items, it.rot, st.project.settings.snap);
    return { it, guides };
  }, [placing, pos]);
  // Geometrie nur bei Produktwechsel neu aufbauen, Lage über die Gruppe
  const shape = useMemo(() => (ghost ? { ...ghost.it, x: 0, y: 0, rot: 0, elev: 0 } : null), [placing]); // eslint-disable-line react-hooks/exhaustive-deps
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    if (!placing) return;
    setPos({ x: e.point.x, y: e.point.z });
  };
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (!placing) return;
    e.stopPropagation();
    useEditor.getState().addFromCatalog(placing.catalogId, placing.variant, e.point.x, e.point.z);
    if (!e.nativeEvent.shiftKey) useEditor.getState().set("placing", null);
  };
  if (!ghost || !shape) return null;
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[CENTER.x, 0.003, CENTER.z]} onPointerMove={onMove} onClick={onClick}>
        <planeGeometry args={[60, 60]} />
        <meshBasicMaterial visible={false} />
      </mesh>
      <group position={[ghost.it.x, ghost.it.elev, ghost.it.y]} rotation={[0, (-ghost.it.rot * Math.PI) / 180, 0]}>
        <ItemMesh item={shape} selected hovered={false} />
      </group>
      <SnapGuides3D extra={ghost.guides} />
    </>
  );
}

/** Grüne Hilfslinien des Wandfangs am Wandfuß. */
function SnapGuides3D({ extra }: { extra?: SnapGuide[] }) {
  const guides = useEditor((s) => s.snapGuides);
  const all = extra ? [...guides, ...extra] : guides;
  const geo = useMemo(() => {
    if (!all.length) return null;
    const pts: number[] = [];
    for (const g of all) for (const y of [0.012, 0.6, 1.2]) pts.push(g.a[0], y, g.a[1], g.b[0], y, g.b[1]);
    const gg = new THREE.BufferGeometry();
    gg.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return gg;
  }, [all]);
  useEffect(() => () => geo?.dispose(), [geo]);
  if (!geo) return null;
  return (
    <lineSegments geometry={geo} renderOrder={998}>
      <lineBasicMaterial color="#16a34a" depthTest={false} transparent opacity={0.9} />
    </lineSegments>
  );
}


/** Wanddarstellung unter Berücksichtigung von Rundgang und Innenansicht (dort immer raumhoch). */
function useEffectiveWallMode() {
  const wallMode = useEditor((s) => s.wallMode);
  const camera3d = useEditor((s) => s.camera3d);
  const interior = useView3D((s) => s.interior);
  return camera3d === "walk" || interior ? "full" : wallMode;
}

function WalkMovement() {
  const { camera } = useThree();
  const keys = useRef<Record<string, boolean>>({});
  useEffect(() => {
    const d = (e: KeyboardEvent) => (keys.current[e.code] = true);
    const u = (e: KeyboardEvent) => (keys.current[e.code] = false);
    window.addEventListener("keydown", d);
    window.addEventListener("keyup", u);
    return () => {
      window.removeEventListener("keydown", d);
      window.removeEventListener("keyup", u);
    };
  }, []);
  useFrame((_, dt) => {
    const eye = useView3D.getState().eyeHeight;
    camera.position.y += (eye - camera.position.y) * Math.min(1, dt * 8);
    const k = keys.current;
    const speed = (k.ShiftLeft ? 2.6 : 1.4) * Math.min(dt, 0.05);
    const f = new THREE.Vector3();
    camera.getWorldDirection(f);
    f.y = 0;
    f.normalize();
    const r = new THREE.Vector3(-f.z, 0, f.x);
    const mv = new THREE.Vector3();
    if (k.KeyW || k.ArrowUp) mv.add(f);
    if (k.KeyS || k.ArrowDown) mv.sub(f);
    if (k.KeyD || k.ArrowRight) mv.add(r);
    if (k.KeyA || k.ArrowLeft) mv.sub(r);
    if (mv.lengthSq() === 0) return;
    mv.normalize().multiplyScalar(speed);
    const nx = camera.position.x + mv.x;
    const nz = camera.position.z + mv.z;
    // Wände und höhere Möbel versperren den Weg (Teppiche, Hocker u. Ä. nicht)
    const items = useEditor.getState().project.items;
    const blocked = (x: number, z: number) => apartment.walls.some((w) => pointInPolygon(x, z, w)) || inFurniture(x, z, items, 0.12);
    const wasFree = !inFurniture(camera.position.x, camera.position.z, items, 0.12);
    const bx = (x: number, z: number) => (wasFree ? blocked(x, z) : apartment.walls.some((w) => pointInPolygon(x, z, w)));
    if (!bx(nx, camera.position.z) && !bx(nx + Math.sign(mv.x) * 0.2, camera.position.z)) camera.position.x = nx;
    if (!bx(camera.position.x, nz) && !bx(camera.position.x, nz + Math.sign(mv.z) * 0.2)) camera.position.z = nz;
  });
  return null;
}

function CameraRig({ controls }: { controls: React.RefObject<CameraControls | null> }) {
  const camera3d = useEditor((s) => s.camera3d);
  const focus = useEditor((s) => s.focusRequest);
  const selectedRoom = useEditor((s) => s.selectedRoom);
  const fovOrbit = useView3D((s) => s.fovOrbit);
  const fovWalk = useView3D((s) => s.fovWalk);
  const goto = useView3D((s) => s.goto);
  const { camera, invalidate } = useThree();
  /** Bildwinkel stammt aus einer angesprungenen Ansicht (bei Übersicht zurücksetzen). */
  const fovFromView = useRef(false);
  const gotoPending = () => {
    const g = useView3D.getState().goto;
    return !!g && performance.now() - g.t < 800;
  };
  useEffect(() => {
    const c = camera as THREE.PerspectiveCamera;
    c.fov = camera3d === "walk" ? fovWalk : fovOrbit;
    c.updateProjectionMatrix();
    invalidate();
  }, [camera, camera3d, fovOrbit, fovWalk, invalidate]);
  // Rundgang: Start im gewählten Raum
  useEffect(() => {
    if (camera3d !== "walk" || gotoPending()) return;
    const eye = useView3D.getState().eyeHeight;
    const room = apartment.rooms.find((r) => r.id === (selectedRoom ?? "13.01")) ?? apartment.rooms[0];
    const cx = room.polygon.reduce((s, p) => s + p[0], 0) / room.polygon.length;
    const cy = room.polygon.reduce((s, p) => s + p[1], 0) / room.polygon.length;
    // Startblick: Richtung mit der längsten freien Sichtachse, Standpunkt etwas zurückgesetzt
    const free = (dx: number, dy: number) => {
      let t = 0;
      while (t < 12) {
        const x = cx + dx * (t + 0.1), y = cy + dy * (t + 0.1);
        if (apartment.walls.some((w) => pointInPolygon(x, y, w)) || !apartment.rooms.some((r) => pointInPolygon(x, y, r.polygon))) break;
        t += 0.1;
      }
      return t;
    };
    let best = { a: 0, d: -1 };
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2;
      const d = free(Math.cos(a), Math.sin(a));
      if (d > best.d) best = { a, d };
    }
    const dx = Math.cos(best.a), dy = Math.sin(best.a);
    const items = useEditor.getState().project.items.filter((i) => i.mount === "floor" && !i.hidden && i.h > 0.3);
    const inItem = (x: number, y: number) => items.some((i) => Math.hypot(x - i.x, y - i.y) < Math.max(i.w, i.d) / 2 + 0.6);
    let backD = Math.max(0, free(-dx, -dy) - 0.5) * 0.7;
    while (backD > 0 && inItem(cx - dx * backD, cy - dy * backD)) backD -= 0.1;
    backD = Math.max(0, backD);
    const px = cx - dx * backD, py = cy - dy * backD;
    camera.position.set(px, eye, py);
    camera.lookAt(px + dx * 4, eye - 0.27, py + dy * 4);
  }, [camera3d, camera, selectedRoom]);
  // Modell- und Draufsicht (nur beim Umschalten, nicht bei jeder Raumauswahl)
  useEffect(() => {
    const c = controls.current;
    if (camera3d === "walk" || !c || gotoPending()) return;
    if (fovFromView.current) {
      fovFromView.current = false;
      useView3D.getState().set("fovOrbit", 42);
    }
    if (camera3d === "top") {
      c.setLookAt(CENTER.x, 26, CENTER.z + 0.01, CENTER.x, 0, CENTER.z, true);
    } else {
      c.setLookAt(CENTER.x + 9, 13, CENTER.z + 13, CENTER.x, 0, CENTER.z, true);
    }
  }, [camera3d, controls]);
  // Gespeicherte Ansicht oder Raumansicht anspringen
  useEffect(() => {
    if (!goto) return;
    const [px, py, pz] = goto.pos;
    const [tx, ty, tz] = goto.target;
    if (useEditor.getState().camera3d === "walk") {
      camera.position.set(px, useView3D.getState().eyeHeight, pz);
      camera.lookAt(tx, ty, tz);
      return;
    }
    const c = controls.current;
    if (!c) return;
    if (goto.fov) {
      fovFromView.current = true;
      useView3D.getState().set("fovOrbit", goto.fov);
    }
    c.setLookAt(px, py, pz, tx, ty, tz, true);
  }, [goto, controls, camera]);
  useEffect(() => {
    const w = (globalThis as unknown as { __we13?: Record<string, unknown> }).__we13;
    if (w) w.controls = controls.current;
  });
  useEffect(() => {
    if (!focus || !controls.current || camera3d === "walk") return;
    controls.current.setLookAt(focus.x + 3.2, 3.6, focus.y + 3.6, focus.x, 0.6, focus.y, true);
  }, [focus, controls, camera3d]);
  return null;
}

/** Erkennt Innenansichten (Kamera unter der Decke innerhalb der Wohnung). */
function InteriorWatch() {
  const camera3d = useEditor((s) => s.camera3d);
  useFrame(({ camera }) => {
    const p = camera.position;
    const inside = camera3d !== "walk" && p.y < CEIL - 0.02 && apartment.rooms.some((r) => !r.outdoor && pointInPolygon(p.x, p.z, r.polygon));
    if (inside !== useView3D.getState().interior) useView3D.getState().set("interior", inside);
  });
  return null;
}

function ClipControl() {
  const wallMode = useEffectiveWallMode();
  useEffect(() => {
    wallClipPlanes[0].constant = wallMode === "full" || wallMode === "auto" ? 100 : wallMode === "cut" ? 1.3 : 0.14;
    cutUniforms.uCutOn.value = wallMode === "auto" ? 1 : 0;
  }, [wallMode]);
  // Automatischer Wandschnitt folgt der Kamera
  useFrame(({ camera }) => {
    cutUniforms.uCutCam.value.copy(camera.position);
  });
  return null;
}

/** Tagesverlauf abspielen: Sonnenaufgang bis -untergang in etwa 18 Sekunden. */
function SunAnimator() {
  const playing = useView3D((s) => s.sunPlaying);
  const date = useEditor((s) => s.project.settings.sunDate);
  const lat = useEditor((s) => s.project.settings.latitude ?? DEFAULT_SITE.latitude);
  const lon = useEditor((s) => s.project.settings.longitude ?? DEFAULT_SITE.longitude);
  const span = useMemo(() => {
    const t = sunTimes(date, { latitude: lat, longitude: lon });
    return t ? { from: t.rise - 0.3, to: t.set + 0.3 } : { from: 6, to: 20 };
  }, [date, lat, lon]);
  useFrame((_, dt) => {
    if (!playing) return;
    const v = useView3D.getState();
    let t = (v.animTime ?? useEditor.getState().project.settings.timeOfDay ?? span.from) + Math.min(dt, 0.1) * ((span.to - span.from) / 18);
    if (t > span.to || t < span.from) t = span.from;
    v.set("animTime", t);
  });
  return null;
}

/**
 * Rendern nur bei Änderungen (statt dauerhaft 60 Bilder/s): Projekt- und Ansichtsänderungen,
 * Kamerabewegung (CameraControls meldet sich selbst) sowie ein langsamer Takt für nachladende Texturen.
 */
function RenderOnDemand() {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const u1 = useEditor.subscribe(() => invalidate());
    const u2 = useView3D.subscribe(() => invalidate());
    const iv = setInterval(() => invalidate(), 1000);
    return () => {
      u1();
      u2();
      clearInterval(iv);
    };
  }, [invalidate]);
  return null;
}

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

/** Kamera auslesen und Fotos in hoher Auflösung aufnehmen (für die Ansichtsleiste). */
function SceneApi({ controls }: { controls: React.RefObject<CameraControls | null> }) {
  const get = useThree((s) => s.get);
  useEffect(() => {
    useView3D.getState().set("api", {
      getView() {
        const { camera } = get();
        const cam = camera as THREE.PerspectiveCamera;
        const c = controls.current;
        if (useEditor.getState().camera3d === "walk" || !c) {
          const d = cam.getWorldDirection(new THREE.Vector3());
          return { pos: cam.position.toArray(), target: cam.position.clone().addScaledVector(d, 3).toArray(), fov: cam.fov };
        }
        return { pos: c.getPosition(new THREE.Vector3()).toArray(), target: c.getTarget(new THREE.Vector3()).toArray(), fov: cam.fov };
      },
      async capture(width) {
        const { gl, size, viewport, setDpr, invalidate } = get();
        const prev = viewport.dpr;
        const ed = useEditor.getState();
        const keep = { selection: ed.selection, selectedFace: ed.selectedFace };
        // Ohne Auswahlrahmen, Hover und Hilfslinien
        useEditor.setState({ selection: [], hoverId: null, selectedFace: null, snapGuides: [] });
        setDpr(Math.min(width / size.width, 8192 / Math.max(size.width, size.height)));
        try {
          for (let i = 0; i < 5; i++) {
            invalidate();
            await nextFrame();
          }
          return gl.domElement.toDataURL("image/png");
        } catch {
          return null;
        } finally {
          setDpr(prev);
          useEditor.setState(keep);
          invalidate();
        }
      },
    });
    return () => useView3D.getState().set("api", null);
  }, [get, controls]);
  return null;
}

function Effects() {
  const quality = useEditor((s) => s.quality);
  const night = useEditor((s) => s.night);
  const gl = useThree((s) => s.gl);
  // Ohne Nachbearbeitung übernimmt der Renderer das Tonemapping
  useEffect(() => {
    gl.toneMapping = quality === "niedrig" ? THREE.NeutralToneMapping : THREE.NoToneMapping;
  }, [gl, quality]);
  if (quality === "niedrig") return null;
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <N8AO aoRadius={0.45} distanceFalloff={0.6} intensity={quality === "hoch" ? 2.2 : 1.6} quality={quality === "hoch" ? "high" : "medium"} halfRes={quality !== "hoch"} />
      <Bloom intensity={night ? 0.55 : 0.08} luminanceThreshold={night ? 0.85 : 0.98} mipmapBlur />
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      <SMAA />
    </EffectComposer>
  );
}

export function Scene3D() {
  const camera3d = useEditor((s) => s.camera3d);
  const quality = useEditor((s) => s.quality);
  const sunPlaying = useView3D((s) => s.sunPlaying);
  const controls = useRef<CameraControls | null>(null);
  return (
    <>
      <Canvas
        shadows={{ type: THREE.PCFSoftShadowMap }}
        dpr={quality === "niedrig" ? 1 : [1, 2]}
        frameloop={camera3d === "walk" || sunPlaying ? "always" : "demand"}
        gl={{ antialias: false, preserveDrawingBuffer: true, powerPreference: "high-performance", localClippingEnabled: true } as never}
        camera={{ fov: camera3d === "walk" ? 70 : 42, near: 0.05, far: 200, position: [CENTER.x + 9, 13, CENTER.z + 13] }}
        onCreated={({ gl, scene, camera }) => {
          gl.localClippingEnabled = true;
          (window as unknown as Record<string, unknown>).__we13 = { gl, scene, camera };
          gl.toneMapping = THREE.NoToneMapping;
        }}
        onPointerMissed={() => {
          const st = useEditor.getState();
          if (!st.placing) {
            st.select([]);
            st.selectFace(null);
          }
        }}
      >
        <Suspense fallback={null}>
          <Environment />
          <Sun />
          <LampLights />
          <ApartmentModel />
          <Items controls={controls} />
          <PlacementGhost />
          <SnapGuides3D />
          <ClipControl />
          <InteriorWatch />
          <SunAnimator />
          <RenderOnDemand />
          <SceneApi controls={controls} />
          {camera3d === "walk" ? (
            <>
              <PointerLockControls makeDefault />
              <WalkMovement />
            </>
          ) : (
            <CameraControls
              ref={controls}
              makeDefault
              minDistance={0.3}
              maxDistance={60}
              maxPolarAngle={Math.PI / 2.05}
              dollySpeed={0.6}
              smoothTime={0.2}
              // links drehen, rechts und Mitte verschieben (wie im Plan), Rad zoomt zum Mauszeiger
              mouseButtons={{ left: 1, middle: 2, right: 2, wheel: 16 }}
              dollyToCursor
            />
          )}
          <CameraRig controls={controls} />
          <Effects />
        </Suspense>
      </Canvas>
      <View3DPanel />
    </>
  );
}
