import { Suspense, useCallback, useEffect, useMemo, useRef } from "react";
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
import { setNightGlow } from "./materials";
import { nearestFace, pointInPolygon, rotationForFace, segmentDistance } from "../model/geometry";

const CEIL = apartment.ceilingHeight;
const CENTER = new THREE.Vector3((apartment.bounds[0] + apartment.bounds[2]) / 2, 0, (apartment.bounds[1] + apartment.bounds[3]) / 2);
const LAMP_CATS = new Set(["floorLamp", "tableLamp", "pendant", "ceilingLamp", "wallLamp"]);

function Environment() {
  const { gl, scene } = useThree();
  const camera3d = useEditor((s) => s.camera3d);
  const night = useEditor((s) => s.night);
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
        scene.backgroundIntensity = 0.9;
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
    scene.environmentIntensity = night ? 0.08 : 0.55;
    setNightGlow(night ? 2.2 : 0);
  }, [night, scene]);
  return null;
}

function Sun() {
  const t = useEditor((s) => s.project.settings.timeOfDay ?? 15);
  const night = useEditor((s) => s.night);
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
  const ha = ((t - 12.5) * 15 * Math.PI) / 180;
  const el = Math.max(0.08, (34 * Math.PI) / 180 * Math.cos(ha * 0.9));
  const az = ha;
  const dir = new THREE.Vector3(-Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
  const pos = CENTER.clone().add(dir.multiplyScalar(30));
  useEffect(() => {
    if (ref.current) ref.current.target = target;
  }, [target]);
  const warm = new THREE.Color().setHSL(0.09, 0.6, Math.min(0.97, 0.75 + el * 0.4));
  return (
    <>
      <hemisphereLight args={["#f3f1ec", "#b9ad9c", night ? 0.05 : 0.55]} />
      <ambientLight intensity={night ? 0.04 : 0.12} />
      <directionalLight
        ref={ref}
        position={pos}
        intensity={night ? 0 : 3.2}
        color={warm}
        castShadow
        shadow-mapSize={[4096, 4096]}
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

function LampLights() {
  const items = useEditor((s) => s.project.items);
  const night = useEditor((s) => s.night);
  if (!night) return null;
  const lamps = items.filter((i) => !i.hidden && LAMP_CATS.has(getCatalogItem(i.catalogId)?.category ?? "")).slice(0, 28);
  return (
    <>
      {lamps.map((i) => {
        const cat = getCatalogItem(i.catalogId)!.category;
        const y = cat === "ceilingLamp" ? i.elev - 0.05 : cat === "pendant" ? i.elev + i.h * 0.3 : i.elev + i.h * 0.7;
        const intensity = cat === "ceilingLamp" || cat === "pendant" ? 2.4 : cat === "floorLamp" ? 1.8 : 0.9;
        return <pointLight key={i.id} position={[i.x, y, i.y]} intensity={intensity} distance={cat === "tableLamp" ? 3.2 : 6} decay={1.6} color="#ffd9a8" />;
      })}
    </>
  );
}

function ApartmentModel() {
  const rooms = useEditor((s) => s.project.rooms);
  const walls = useEditor((s) => s.project.walls);
  const doors = useEditor((s) => s.project.settings.doorsOpen);
  const showCeiling = useEditor((s) => s.showCeiling || s.camera3d === "walk");
  const selectedFace = useEditor((s) => s.selectedFace);
  const built = useMemo(() => {
    return buildApartment({ ...useEditor.getState().project, rooms, walls, settings: { ...useEditor.getState().project.settings, doorsOpen: doors } });
  }, [rooms, walls, doors]);
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
      e.stopPropagation();
      const st = useEditor.getState();
      if (st.placing) return;
      const additive = e.nativeEvent.shiftKey || e.nativeEvent.ctrlKey || e.nativeEvent.metaKey;
      if (!st.selection.includes(item.id) || additive) st.select([item.id], additive);
      if (st.camera3d === "walk" || item.locked || e.button !== 0) return;
      const ids = useEditor.getState().selection.filter((id) => !useEditor.getState().project.items.find((i) => i.id === id)?.locked);
      const start = new Map(useEditor.getState().project.items.filter((i) => ids.includes(i.id)).map((i) => [i.id, { x: i.x, y: i.y, rot: i.rot }]));
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
      if (controls.current) controls.current.enabled = false;
      const move = (ev: PointerEvent) => {
        const p = hit(ev);
        if (!p) return;
        let dx = p.x - p0.x;
        let dy = p.z - p0.z;
        if (!moved && Math.hypot(dx, dy) < 0.01) return;
        if (!moved) {
          useEditor.getState().commit();
          moved = true;
        }
        const snap = useEditor.getState().project.settings.snap;
        if (snap && !ev.altKey) {
          const g = useEditor.getState().project.settings.gridSize || 0.05;
          dx = Math.round(dx / g) * g;
          dy = Math.round(dy / g) * g;
        }
        useEditor.getState().updateItems(
          ids,
          (it) => {
            const s0 = start.get(it.id)!;
            it.x = s0.x + dx;
            it.y = s0.y + dy;
            if (it.mount === "wall" && ids.length === 1) {
              const nf = nearestFace(wallFaces, it.x, it.y, 1.2);
              if (nf) {
                const q = segmentDistance([it.x, it.y], nf.face.a, nf.face.b).q;
                it.rot = rotationForFace(nf.face);
                it.x = q[0] + nf.face.n[0] * (it.d / 2 + 0.002);
                it.y = q[1] + nf.face.n[1] * (it.d / 2 + 0.002);
              }
            }
          },
          { commit: false },
        );
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        if (controls.current) controls.current.enabled = true;
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
  const wallMode = useEditor((s) => s.wallMode);
  const camera3d = useEditor((s) => s.camera3d);
  const cut = camera3d === "walk" || wallMode === "full" ? null : wallMode === "cut" ? 1.3 : 0.14;
  return (
    <>
      {items.map((it) => (
        <ItemMesh key={it.id} item={it} selected={sel.has(it.id)} hovered={hoverId === it.id} onDown={onDown} onOver={setHover} cut={cut} />
      ))}
    </>
  );
}

function PlacementGhost() {
  const placing = useEditor((s) => s.placing);
  const ghostRef = useRef<{ x: number; y: number }>({ x: CENTER.x, y: CENTER.z });
  const item = useMemo(() => {
    if (!placing) return null;
    const c = getCatalogItem(placing.catalogId);
    if (!c) return null;
    const it = newItemFromCatalog(c, placing.variant, ghostRef.current.x, ghostRef.current.y, 8);
    it.id = "ghost";
    return it;
  }, [placing]);
  const groupRef = useRef<THREE.Group>(null);
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    if (!item || !groupRef.current) return;
    ghostRef.current = { x: e.point.x, y: e.point.z };
    groupRef.current.position.set(e.point.x - item.x, 0, e.point.z - item.y);
  };
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (!placing) return;
    e.stopPropagation();
    useEditor.getState().addFromCatalog(placing.catalogId, placing.variant, e.point.x, e.point.z);
    if (!e.nativeEvent.shiftKey) useEditor.getState().set("placing", null);
  };
  if (!item) return null;
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[CENTER.x, 0.003, CENTER.z]} onPointerMove={onMove} onClick={onClick}>
        <planeGeometry args={[60, 60]} />
        <meshBasicMaterial visible={false} />
      </mesh>
      <group ref={groupRef}>
        <ItemMesh item={item} selected hovered={false} />
      </group>
    </>
  );
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
    const blocked = (x: number, z: number) => apartment.walls.some((w) => pointInPolygon(x, z, w));
    if (!blocked(nx, camera.position.z) && !blocked(nx + Math.sign(mv.x) * 0.2, camera.position.z)) camera.position.x = nx;
    if (!blocked(camera.position.x, nz) && !blocked(camera.position.x, nz + Math.sign(mv.z) * 0.2)) camera.position.z = nz;
    camera.position.y = 1.62;
  });
  return null;
}

function CameraRig({ controls }: { controls: React.RefObject<CameraControls | null> }) {
  const camera3d = useEditor((s) => s.camera3d);
  const focus = useEditor((s) => s.focusRequest);
  const selectedRoom = useEditor((s) => s.selectedRoom);
  const { camera } = useThree();
  useEffect(() => {
    const c = controls.current;
    if (camera3d === "walk") {
      const room = apartment.rooms.find((r) => r.id === (selectedRoom ?? "13.01")) ?? apartment.rooms[0];
      const cx = room.polygon.reduce((s, p) => s + p[0], 0) / room.polygon.length;
      const cy = room.polygon.reduce((s, p) => s + p[1], 0) / room.polygon.length;
      camera.position.set(cx, 1.62, cy);
      camera.lookAt(cx + 1, 1.5, cy - 0.3);
      return;
    }
    if (!c) return;
    if (camera3d === "top") {
      c.setLookAt(CENTER.x, 26, CENTER.z + 0.01, CENTER.x, 0, CENTER.z, true);
    } else {
      c.setLookAt(CENTER.x + 9, 13, CENTER.z + 13, CENTER.x, 0, CENTER.z, true);
    }
  }, [camera3d, camera, controls, selectedRoom]);
  useEffect(() => {
    if (!focus || !controls.current || camera3d === "walk") return;
    controls.current.setLookAt(focus.x + 3.2, 3.6, focus.y + 3.6, focus.x, 0.6, focus.y, true);
  }, [focus, controls, camera3d]);
  return null;
}

function ClipControl() {
  const wallMode = useEditor((s) => s.wallMode);
  const camera3d = useEditor((s) => s.camera3d);
  useEffect(() => {
    wallClipPlanes[0].constant = camera3d === "walk" || wallMode === "full" ? 100 : wallMode === "cut" ? 1.3 : 0.14;
  }, [wallMode, camera3d]);
  return null;
}

function Effects() {
  const quality = useEditor((s) => s.quality);
  const night = useEditor((s) => s.night);
  if (quality === "niedrig") return null;
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <N8AO aoRadius={0.45} distanceFalloff={0.6} intensity={quality === "hoch" ? 2.2 : 1.6} quality={quality === "hoch" ? "high" : "medium"} halfRes={quality !== "hoch"} />
      <Bloom intensity={night ? 0.55 : 0.08} luminanceThreshold={night ? 0.85 : 0.98} mipmapBlur />
      <ToneMapping mode={ToneMappingMode.AGX} />
      <SMAA />
    </EffectComposer>
  );
}

export function Scene3D() {
  const camera3d = useEditor((s) => s.camera3d);
  const controls = useRef<CameraControls | null>(null);
  return (
    <Canvas
      shadows={{ type: THREE.PCFSoftShadowMap }}
      dpr={[1, 2]}
      gl={{ antialias: false, preserveDrawingBuffer: true, powerPreference: "high-performance", localClippingEnabled: true } as never}
      camera={{ fov: camera3d === "walk" ? 70 : 42, near: 0.05, far: 200, position: [CENTER.x + 9, 13, CENTER.z + 13] }}
      onCreated={({ gl, scene }) => {
        gl.localClippingEnabled = true;
        (window as unknown as Record<string, unknown>).__we13 = { gl, scene };
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
        <ClipControl />
        {camera3d === "walk" ? (
          <>
            <PointerLockControls makeDefault />
            <WalkMovement />
          </>
        ) : (
          <CameraControls ref={controls} makeDefault minDistance={1} maxDistance={60} maxPolarAngle={Math.PI / 2.05} dollySpeed={0.6} smoothTime={0.2} />
        )}
        <CameraRig controls={controls} />
        <Effects />
      </Suspense>
    </Canvas>
  );
}
