"use client";

import {
  useRef,
  useState,
  useEffect,
  useMemo,
  useCallback,
  Suspense,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import * as THREE from "three";
import { useRouter } from "next/navigation";
import { Judge, JudgeConnection, Judgment, CourtSitting } from "@/lib/types";
import { apiClient } from "@/lib/api";
import {
  Search,
  X,
  ExternalLink,
  Users,
  FileText,
  Calendar,
  Loader2,
  Globe,
  Sparkles,
  Link2,
} from "lucide-react";

/* ── Court colour palette ── */

const courtColor = (court: string | null | undefined): string => {
  const c = (court ?? "").toLowerCase();
  if (c.includes("appeal")) return "#FED100";
  if (c.includes("supreme")) return "#009B3A";
  return "#6b7280";
};

const COURT_COLORS: Record<string, string> = {
  "Court of Appeal": "#FED100",
  "Supreme Court": "#009B3A",
};

const LS_VIEW_KEY = "cw-constellation-view";
const LS_CONNECTIONS_KEY = "cw-constellation-connections";

/* ── Chief Justice detection ── */

const isSykesJudge = (name: string): boolean => {
  const n = name.toLowerCase();
  return n.includes("sykes") || n.includes("chief justice");
};

const SYKES_MULTIPLIER = 1.8;

/* ── Star sizing helpers (must mirror the size formula in ConstellationScene) ── */

function computeStarSizes(judges: Judge[]): Map<number, number> {
  const maxCases = Math.max(1, ...judges.map((j) => j.total_cases ?? 1));
  const m = new Map<number, number>();
  for (const j of judges) {
    const base = 1.0 + ((j.total_cases ?? 1) / maxCases) * 1.2;
    m.set(j.id, isSykesJudge(j.name) ? base * SYKES_MULTIPLIER : base);
  }
  return m;
}

// Outer-point radius of a star with the given size value.
const starRadius = (size: number) => 0.5 * size;

// Minimum centre-to-centre distance that avoids visual overlap.
const minClearance = (ra: number, rb: number) => Math.max(0.7, ra + rb + 0.25);

/* ── Random constellation positions (scatter view) ── */

function computePositions(
  judges: Judge[],
): Map<number, [number, number, number]> {
  const map = new Map<number, [number, number, number]>();
  const sizes = computeStarSizes(judges);
  const placed: Array<{ pos: [number, number, number]; r: number }> = [];

  // Sykes anchors first so every other star's collision check respects his radius.
  const sorted = [...judges].sort((a, b) => {
    if (isSykesJudge(a.name)) return -1;
    if (isSykesJudge(b.name)) return 1;
    return 0;
  });

  for (const judge of sorted) {
    const ra = starRadius(sizes.get(judge.id) ?? 1.0);
    const isSykes = isSykesJudge(judge.name);

    let s = (judge.id * 2654435761) >>> 0;
    if (s === 0) s = 1;
    const rand = () => {
      s ^= s << 13;
      s ^= s >>> 17;
      s ^= s << 5;
      return (s >>> 0) / 0xffffffff;
    };

    let best: [number, number, number] = [0, 0, 0];
    let bestClearance = -Infinity;

    for (let attempt = 0; attempt < 128; attempt++) {
      let x: number, y: number, z: number;

      if (isSykes) {
        // Sykes placed within 1.5 units of centre for visual dominance.
        const r = rand() * 1.5;
        const theta = rand() * Math.PI * 2;
        const phi = Math.acos(2 * rand() - 1); // uniform spherical
        x = r * Math.sin(phi) * Math.cos(theta);
        y = r * Math.cos(phi);
        z = r * Math.sin(phi) * Math.sin(theta);
      } else {
        // All others use the wider equatorial shell.
        const r = 2.0 + rand() * 4.0;
        const theta = rand() * Math.PI * 2;
        const phi = Math.PI / 4 + rand() * (Math.PI / 2);
        x = r * Math.sin(phi) * Math.cos(theta);
        y = r * Math.cos(phi);
        z = r * Math.sin(phi) * Math.sin(theta);
      }

      let clearance = Infinity;
      for (const p of placed) {
        const d = Math.hypot(p.pos[0] - x, p.pos[1] - y, p.pos[2] - z);
        clearance = Math.min(clearance, d - minClearance(ra, p.r));
      }
      if (placed.length === 0) clearance = Infinity;

      if (clearance > bestClearance) {
        bestClearance = clearance;
        best = [x, y, z];
        if (clearance >= 0) break;
      }
    }

    placed.push({ pos: best, r: ra });
    map.set(judge.id, best);
  }

  return map;
}

/* ── Galactic ring positions ── */

// Minimum ring radius so that N uniformly-spaced stars of maxStarRadius never overlap.
function minRingRadius(N: number, maxStarRadius: number): number {
  if (N <= 1) return 0;
  const chord = Math.max(0.7, 2 * maxStarRadius + 0.25);
  return chord / (2 * Math.sin(Math.PI / N));
}

function computeGalacticPositions(
  judges: Judge[],
): Map<number, [number, number, number]> {
  const map = new Map<number, [number, number, number]>();
  if (judges.length === 0) return map;

  const sizes = computeStarSizes(judges);
  const rOf = (j: Judge) => starRadius(sizes.get(j.id) ?? 1.0);

  // Deterministic ±0.3 vertical offset per judge.
  const yOff = (j: Judge): number => {
    let s = (j.id * 2654435761) >>> 0;
    if (s === 0) s = 1;
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) / 0xffffffff - 0.5) * 0.6;
  };

  // Sykes anchors the exact centre; all rings orbit him.
  const sykesJudge = judges.find((j) => isSykesJudge(j.name));
  if (sykesJudge) {
    map.set(sykesJudge.id, [0, 0, 0]);
  }
  const sykesR = sykesJudge ? rOf(sykesJudge) : 0;

  // All non-Sykes judges are distributed across rings.
  const rest = judges.filter((j) => !isSykesJudge(j.name));

  const supreme = rest.filter((j) =>
    (j.court ?? "").toLowerCase().includes("supreme"),
  );
  const appeal = rest.filter((j) =>
    (j.court ?? "").toLowerCase().includes("appeal"),
  );
  const other = rest.filter(
    (j) =>
      !(j.court ?? "").toLowerCase().includes("supreme") &&
      !(j.court ?? "").toLowerCase().includes("appeal"),
  );

  // Place a group on one or two concentric sub-rings as needed.
  // baseR  – preferred ring radius (the "tier" anchor)
  // prevEdgeR – outer edge of the previous tier; this ring must clear it
  // Returns the outer edge (ringR + maxStarR) of the outermost sub-ring placed.
  const placeGroup = (
    group: Judge[],
    baseR: number,
    prevEdgeR: number,
  ): number => {
    if (group.length === 0) return prevEdgeR;

    const maxR = Math.max(...group.map(rOf));
    const N = group.length;

    const singleR = Math.max(
      baseR,
      prevEdgeR + maxR + 0.25, // inter-ring gap: clear previous tier
      minRingRadius(N, maxR), // intra-ring gap: stars fit around the circle
    );

    // If a single ring would balloon past 2.5× the anchor, split into two sub-rings.
    if (singleR > baseR * 2.5 && N > 4) {
      const half = Math.ceil(N / 2);
      const inner = group.slice(0, half);
      const outer = group.slice(half);

      const innerMaxR = Math.max(...inner.map(rOf));
      const innerR = Math.max(
        baseR,
        prevEdgeR + innerMaxR + 0.25,
        minRingRadius(inner.length, innerMaxR),
      );
      inner.forEach((judge, i) => {
        const angle = (i / inner.length) * Math.PI * 2;
        map.set(judge.id, [
          innerR * Math.cos(angle),
          yOff(judge),
          innerR * Math.sin(angle),
        ]);
      });

      const outerMaxR = Math.max(...outer.map(rOf));
      const outerR = Math.max(
        baseR * 1.4,
        innerR + innerMaxR + outerMaxR + 0.25,
        minRingRadius(outer.length, outerMaxR),
      );
      outer.forEach((judge, i) => {
        const angle = (i / outer.length) * Math.PI * 2;
        map.set(judge.id, [
          outerR * Math.cos(angle),
          yOff(judge),
          outerR * Math.sin(angle),
        ]);
      });

      return outerR + outerMaxR;
    }

    // Single ring.
    group.forEach((judge, i) => {
      const angle = (i / N) * Math.PI * 2;
      map.set(judge.id, [
        singleR * Math.cos(angle),
        yOff(judge),
        singleR * Math.sin(angle),
      ]);
    });
    return singleR + maxR;
  };

  // Innermost ring must clear Sykes' radius; then chain outward.
  const sykesEdge = sykesR + 0.25;
  const coreEdge = placeGroup(supreme, 1.5, sykesEdge);
  const innerEdge = placeGroup(appeal, 2.8, coreEdge);
  placeGroup(other, 4.2, innerEdge);

  return map;
}

/* ── Star shape (5-pointed) ── */

function makeStarShape(outer: number, inner: number): THREE.Shape {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    const r = i % 2 === 0 ? outer : inner;
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  s.closePath();
  return s;
}

/* ── 8-pointed star shape (Chief Justice only) ── */

function makeOctaStarShape(outer: number, inner: number): THREE.Shape {
  const s = new THREE.Shape();
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI) / 8 - Math.PI / 2;
    const r = i % 2 === 0 ? outer : inner;
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  s.closePath();
  return s;
}

/* ── Particle field ── */

function ParticleField() {
  const geo = useMemo(() => {
    const count = 1400;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i++) pos[i] = (Math.random() - 0.5) * 45;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);

  useEffect(() => () => geo.dispose(), [geo]);

  return (
    <points geometry={geo}>
      <pointsMaterial
        color="#FED100"
        size={0.055}
        transparent
        opacity={0.32}
        sizeAttenuation
      />
    </points>
  );
}

/* ── Nebula backdrop ── */

function Nebula() {
  return (
    <>
      <mesh scale={[20, 14, 20]}>
        <sphereGeometry args={[1, 12, 12]} />
        <meshBasicMaterial
          color="#001409"
          transparent
          opacity={0.7}
          side={THREE.BackSide}
        />
      </mesh>
      <mesh position={[-1.5, 1, -7]}>
        <sphereGeometry args={[5, 8, 8]} />
        <meshBasicMaterial color="#002a10" transparent opacity={0.18} />
      </mesh>
      <mesh position={[3, -1, -5]}>
        <sphereGeometry args={[3.5, 8, 8]} />
        <meshBasicMaterial color="#1a0e00" transparent opacity={0.12} />
      </mesh>
    </>
  );
}

/* ── Connecting edge between two judges ── */

function ConstellationEdge({
  posA,
  posB,
}: {
  posA: [number, number, number];
  posB: [number, number, number];
}) {
  const lineObj = useMemo(() => {
    // Slight upward arc at the midpoint keeps the curve above star bodies
    // without wandering away from the endpoints.
    const mid = new THREE.Vector3(
      (posA[0] + posB[0]) / 2,
      (posA[1] + posB[1]) / 2 + 0.35,
      (posA[2] + posB[2]) / 2,
    );
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(...posA),
      mid,
      new THREE.Vector3(...posB),
    );
    const pts = curve.getPoints(20);
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({
      color: "#FED100",
      transparent: true,
      opacity: 0.2,
    });
    return new THREE.Line(geo, mat);
  }, [posA, posB]);

  useEffect(
    () => () => {
      lineObj.geometry.dispose();
      (lineObj.material as THREE.Material).dispose();
    },
    [lineObj],
  );

  return <primitive object={lineObj} />;
}

/* ── Reusable scratch vector (avoids per-frame allocation) ── */
const _lerpTarget = new THREE.Vector3();

/* ── Individual judge star ── */

interface StarProps {
  judge: Judge;
  scatterPosition: [number, number, number];
  galacticPosition: [number, number, number];
  isGalactic: boolean;
  size: number;
  color: string;
  isSelected: boolean;
  isSearchMatch: boolean;
  isSearchActive: boolean;
  onSelect: (judge: Judge | null) => void;
}

function JudgeStar({
  judge,
  scatterPosition,
  galacticPosition,
  isGalactic,
  size,
  color,
  isSelected,
  isSearchMatch,
  isSearchActive,
  onSelect,
}: StarProps) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  // Initialise at the correct starting position to avoid jarring teleport on mount.
  const currentPos = useRef(
    isGalactic
      ? new THREE.Vector3(...galacticPosition)
      : new THREE.Vector3(...scatterPosition),
  );
  const phase = judge.id * 1.37;
  const [hovered, setHovered] = useState(false);
  const isSykes = isSykesJudge(judge.name);

  const geom = useMemo(() => {
    // Sykes gets an 8-pointed star with sharper points and deeper extrusion.
    const shape = isSykes
      ? makeOctaStarShape(0.5 * size, 0.15 * size)
      : makeStarShape(0.5 * size, 0.22 * size);
    return new THREE.ExtrudeGeometry(shape, {
      depth: isSykes ? 0.22 * size : 0.12 * size,
      bevelEnabled: true,
      bevelSize: 0.025 * size,
      bevelThickness: 0.025 * size,
      bevelSegments: 3,
    });
  }, [size, isSykes]);

  useEffect(() => () => geom.dispose(), [geom]);

  useFrame(({ clock }, delta) => {
    if (!groupRef.current || !meshRef.current || !matRef.current) return;

    // Smooth lerp toward target — exp-decay gives a natural ease-out over ~1.5 s.
    const target = isGalactic ? galacticPosition : scatterPosition;
    _lerpTarget.set(target[0], target[1], target[2]);
    currentPos.current.lerp(_lerpTarget, 1 - Math.exp(-delta * 2.5));

    groupRef.current.position.x = currentPos.current.x;
    groupRef.current.position.y = currentPos.current.y;
    groupRef.current.position.z = currentPos.current.z;

    // Float effect on the mesh relative to the group.
    meshRef.current.position.y =
      Math.sin(clock.elapsedTime * 0.65 + phase) * 0.085;

    meshRef.current.rotation.y +=
      delta * (isSelected ? 2.2 : hovered ? 1.1 : 0.42);

    const dimmed = isSearchActive && !isSearchMatch;
    const targetOpacity = dimmed ? 0.1 : 1.0;
    const baseEmissive = isSykes ? 0.12 : 0.08; // Sykes glows 50% brighter
    const targetEmissive = dimmed
      ? 0.0
      : isSelected
        ? 0.55 + Math.sin(clock.elapsedTime * 3.2) * 0.28
        : hovered
          ? 0.28
          : baseEmissive;

    matRef.current.opacity += (targetOpacity - matRef.current.opacity) * 0.08;
    matRef.current.emissiveIntensity +=
      (targetEmissive - matRef.current.emissiveIntensity) * 0.08;
    matRef.current.transparent = matRef.current.opacity < 0.98;
  });

  return (
    <group ref={groupRef} position={scatterPosition}>
      <mesh
        ref={meshRef}
        geometry={geom}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(isSelected ? null : judge);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = "pointer";
          setHovered(true);
        }}
        onPointerOut={() => {
          document.body.style.cursor = "auto";
          setHovered(false);
        }}
      >
        <meshStandardMaterial
          ref={matRef}
          color={color}
          emissive={color}
          emissiveIntensity={isSykes ? 0.12 : 0.08}
          metalness={0.65}
          roughness={0.18}
        />
      </mesh>

      {/* Sykes has a permanent outer glow; other stars only glow when selected */}
      {(isSykes || isSelected) && (
        <mesh>
          <sphereGeometry args={[size * (isSykes ? 1.2 : 0.95), 12, 12]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={isSykes ? 0.09 : 0.06}
          />
        </mesh>
      )}

      {hovered && !isSelected && (
        <Html
          position={[0, 0.5 * size + 0.35, 0]}
          center
          style={{ pointerEvents: "none" }}
        >
          <div
            style={{
              background: "rgba(13,13,26,0.92)",
              border: `1px solid ${color}40`,
              borderRadius: 7,
              padding: "3px 9px",
              fontSize: 11,
              fontWeight: 600,
              color: "rgba(255,255,255,0.88)",
              whiteSpace: "nowrap",
              letterSpacing: "0.01em",
              boxShadow: `0 2px 12px rgba(0,0,0,0.5), 0 0 8px ${color}20`,
            }}
          >
            {isSykes ? "Chief Justice Bryan Sykes" : judge.name}
          </div>
        </Html>
      )}
    </group>
  );
}

/* ── Camera controller — re-targets OrbitControls on judge selection ── */

function CameraController({
  targetPos,
  orbitRef,
}: {
  targetPos: THREE.Vector3 | null;
  orbitRef: React.RefObject<any>;
}) {
  useEffect(() => {
    if (!orbitRef.current) return;
    if (targetPos) {
      orbitRef.current.target.lerp(targetPos, 1);
      orbitRef.current.update();
    } else {
      orbitRef.current.target.set(0, 0, 0);
      orbitRef.current.update();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetPos]);

  return null;
}

/* ── Main 3-D scene (rendered inside Canvas) ── */

interface SceneProps {
  judges: Judge[];
  connections: JudgeConnection[];
  scatterPositions: Map<number, [number, number, number]>;
  galacticPositions: Map<number, [number, number, number]>;
  isGalactic: boolean;
  showConnections: boolean;
  selectedJudge: Judge | null;
  onSelect: (j: Judge | null) => void;
  searchQuery: string;
}

function ConstellationScene({
  judges,
  connections,
  scatterPositions,
  galacticPositions,
  isGalactic,
  showConnections,
  selectedJudge,
  onSelect,
  searchQuery,
}: SceneProps) {
  const orbitRef = useRef<any>(null);
  const { camera } = useThree();

  useEffect(() => {
    camera.position.set(0, 2.5, 10);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cameraTarget = useMemo(() => {
    if (!selectedJudge) return null;
    const pos = isGalactic
      ? galacticPositions.get(selectedJudge.id)
      : scatterPositions.get(selectedJudge.id);
    if (!pos) return null;
    return new THREE.Vector3(pos[0], pos[1], pos[2]);
  }, [selectedJudge, isGalactic, scatterPositions, galacticPositions]);

  const sizes = useMemo(() => computeStarSizes(judges), [judges]);

  const isSearchActive = searchQuery.trim().length > 0;
  const searchLower = searchQuery.toLowerCase();

  return (
    <>
      <color attach="background" args={["#050510"]} />
      <ambientLight intensity={0.22} />
      <directionalLight position={[5, 8, 5]} intensity={0.9} color="#ffffff" />
      <directionalLight
        position={[-6, -4, -6]}
        intensity={0.35}
        color="#FED100"
      />
      <pointLight position={[0, 4, 0]} intensity={0.55} color="#009B3A" />

      <Nebula />
      <ParticleField />

      {/* Edges rendered only when the user has opted in */}
      {showConnections &&
        connections.map((conn, i) => {
          const posA = scatterPositions.get(conn.judge_a_id);
          const posB = scatterPositions.get(conn.judge_b_id);
          if (!posA || !posB) return null;
          return <ConstellationEdge key={i} posA={posA} posB={posB} />;
        })}

      {judges.map((judge) => {
        const scatter = scatterPositions.get(judge.id);
        const galactic = galacticPositions.get(judge.id);
        if (!scatter || !galactic) return null;
        const size = sizes.get(judge.id) ?? 1.0;
        const isMatch =
          !isSearchActive ||
          judge.name.toLowerCase().includes(searchLower) ||
          (judge.court ?? "").toLowerCase().includes(searchLower);

        return (
          <JudgeStar
            key={judge.id}
            judge={judge}
            scatterPosition={scatter}
            galacticPosition={galactic}
            isGalactic={isGalactic}
            size={size}
            color={courtColor(judge.court)}
            isSelected={selectedJudge?.id === judge.id}
            isSearchMatch={isMatch}
            isSearchActive={isSearchActive}
            onSelect={onSelect}
          />
        );
      })}

      <CameraController targetPos={cameraTarget} orbitRef={orbitRef} />

      <OrbitControls
        ref={orbitRef}
        enablePan={false}
        enableZoom
        autoRotate={!selectedJudge}
        autoRotateSpeed={0.28}
        enableDamping
        dampingFactor={0.06}
        minDistance={3}
        maxDistance={18}
        minPolarAngle={Math.PI * 0.2}
        maxPolarAngle={Math.PI * 0.8}
      />
    </>
  );
}

/* ── Desktop info card ── */

function JudgeInfoCard({
  judge,
  judgments,
  sittings,
  dataLoading,
  onClose,
}: {
  judge: Judge;
  judgments: Judgment[];
  sittings: CourtSitting[];
  dataLoading: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const color = courtColor(judge.court);
  const today = new Date().toISOString().split("T")[0];
  const recentJudgments = judgments.slice(0, 3);
  const upcomingSittings = sittings
    .filter((s) => (s.event_date ?? "") >= today)
    .sort((a, b) => (a.event_date ?? "").localeCompare(b.event_date ?? ""))
    .slice(0, 3);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div
      className="absolute bottom-6 right-6 z-20 w-[260px] rounded-2xl border bg-[#0d0d1a]/96 backdrop-blur-xl shadow-2xl overflow-hidden flex flex-col"
      style={{
        borderColor: `${color}35`,
        maxHeight: "70%",
        opacity: mounted ? 1 : 0,
        transform: mounted
          ? "translateY(0) scale(1)"
          : "translateY(10px) scale(0.97)",
        transition:
          "opacity 0.22s ease, transform 0.22s cubic-bezier(0.4,0,0.2,1)",
      }}
    >
      <div
        className="h-[2px] w-full shrink-0"
        style={{
          background: `linear-gradient(to right, ${color}, transparent)`,
        }}
      />

      <div className="p-4 shrink-0">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold text-white leading-snug">
              {judge.name}
            </p>
            {judge.court && (
              <p className="mt-0.5 text-[10px] font-medium" style={{ color }}>
                {judge.court}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-0.5 text-white/50 hover:text-white/60 transition-colors shrink-0"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {judge.total_cases !== undefined && (
          <div className="flex items-center gap-1.5">
            <Users className="h-3 w-3 text-white/55" />
            <span className="text-[11px] text-white/45">
              {judge.total_cases} case{judge.total_cases !== 1 ? "s" : ""} on
              record
            </span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-3 space-y-4 min-h-0">
        {dataLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-white/50" />
          </div>
        ) : (
          <>
            {recentJudgments.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <FileText className="h-3 w-3 text-[#009B3A]/70" />
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/60">
                    Recent Judgments
                  </p>
                </div>
                <div className="space-y-1.5">
                  {recentJudgments.map((j) => (
                    <button
                      key={j.id}
                      onClick={() => router.push(`/cases/${j.id}`)}
                      className="w-full text-left rounded-lg bg-white/[0.04] hover:bg-white/[0.08] active:bg-white/[0.11] px-2.5 py-2 transition-colors"
                    >
                      <p className="text-[11px] text-white/75 leading-snug line-clamp-2">
                        {j.title}
                      </p>
                      {j.date && (
                        <p className="mt-0.5 text-[10px] text-white/60">
                          {new Date(`${j.date}T00:00:00`).toLocaleDateString(
                            "en-JM",
                            { month: "short", year: "numeric" },
                          )}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {upcomingSittings.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Calendar className="h-3 w-3 text-[#FED100]/70" />
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/60">
                    Upcoming Sittings
                  </p>
                </div>
                <div className="space-y-1.5">
                  {upcomingSittings.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => router.push(`/cases/sittings/${s.id}`)}
                      className="w-full text-left rounded-lg bg-white/[0.04] hover:bg-white/[0.08] active:bg-white/[0.11] px-2.5 py-2 transition-colors"
                    >
                      <p className="text-[11px] text-white/75 leading-snug line-clamp-1">
                        {s.title || s.case_number || "Sitting"}
                      </p>
                      {s.event_date && (
                        <p className="mt-0.5 text-[10px] text-white/60">
                          {new Date(
                            `${s.event_date}T00:00:00`,
                          ).toLocaleDateString("en-JM", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {recentJudgments.length === 0 && upcomingSittings.length === 0 && (
              <p className="text-[11px] text-white/55 text-center py-2">
                No recent activity
              </p>
            )}
          </>
        )}
      </div>

      <div className="px-4 pb-4 pt-2 shrink-0">
        <button
          onClick={() => router.push(`/judges/${judge.id}`)}
          className="group flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#009B3A]/30 bg-[#009B3A]/12 px-3 py-2 text-[11px] font-semibold text-[#009B3A] hover:bg-[#009B3A]/20 hover:shadow-[0_0_18px_rgba(0,155,58,0.28)] transition-all duration-200"
        >
          View Full Profile
          <ExternalLink className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-px group-hover:-translate-y-px" />
        </button>
      </div>
    </div>
  );
}

/* ── Mobile bottom sheet ── */

function MobileSheet({
  judge,
  judgments,
  sittings,
  dataLoading,
  onClose,
}: {
  judge: Judge;
  judgments: Judgment[];
  sittings: CourtSitting[];
  dataLoading: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const color = courtColor(judge.court);
  const touchStartY = useRef(0);
  const [dragY, setDragY] = useState(0);
  const today = new Date().toISOString().split("T")[0];
  const recentJudgments = judgments.slice(0, 3);
  const upcomingSittings = sittings
    .filter((s) => (s.event_date ?? "") >= today)
    .sort((a, b) => (a.event_date ?? "").localeCompare(b.event_date ?? ""))
    .slice(0, 3);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    const d = e.touches[0].clientY - touchStartY.current;
    if (d > 0) setDragY(d);
  };
  const handleTouchEnd = () => {
    if (dragY > 90) onClose();
    setDragY(0);
  };

  return (
    <div
      className="md:hidden fixed bottom-0 inset-x-0 z-[70] rounded-t-2xl border-t bg-[#0d0d1a] shadow-[0_-8px_48px_rgba(0,0,0,0.6)] flex flex-col"
      style={{
        borderColor: `${color}30`,
        maxHeight: "70vh",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        transform: `translateY(${dragY}px)`,
        transition: dragY > 0 ? "none" : "transform 0.3s ease",
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="mx-auto mt-2.5 mb-1 h-1 w-10 rounded-full bg-white/[0.12] shrink-0" />

      <div className="shrink-0" style={{ borderTop: `2px solid ${color}30` }}>
        <div
          className="h-[3px] w-1/2"
          style={{
            background: `linear-gradient(to right, ${color}, transparent)`,
          }}
        />
      </div>

      <div className="px-5 pt-4 pb-2 shrink-0">
        <div className="flex items-start justify-between gap-3 mb-1">
          <div>
            <p className="text-[15px] font-bold text-white leading-snug">
              {judge.name}
            </p>
            {judge.court && (
              <p className="mt-1 text-[12px] font-medium" style={{ color }}>
                {judge.court}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/50 hover:text-white/60"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {judge.total_cases !== undefined && (
          <p className="text-[12px] text-white/70">
            {judge.total_cases} case{judge.total_cases !== 1 ? "s" : ""} on
            record
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-2 space-y-4 min-h-0">
        {dataLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-white/50" />
          </div>
        ) : (
          <>
            {recentJudgments.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <FileText className="h-3.5 w-3.5 text-[#009B3A]/70" />
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-white/60">
                    Recent Judgments
                  </p>
                </div>
                <div className="space-y-2">
                  {recentJudgments.map((j) => (
                    <button
                      key={j.id}
                      onClick={() => router.push(`/cases/${j.id}`)}
                      className="w-full text-left rounded-xl bg-white/[0.04] hover:bg-white/[0.07] active:bg-white/[0.1] px-3 py-2.5 transition-colors"
                    >
                      <p className="text-[13px] text-white/80 leading-snug line-clamp-2">
                        {j.title}
                      </p>
                      {j.date && (
                        <p className="mt-1 text-[11px] text-white/60">
                          {new Date(`${j.date}T00:00:00`).toLocaleDateString(
                            "en-JM",
                            { month: "short", year: "numeric" },
                          )}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {upcomingSittings.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Calendar className="h-3.5 w-3.5 text-[#FED100]/70" />
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-white/60">
                    Upcoming Sittings
                  </p>
                </div>
                <div className="space-y-2">
                  {upcomingSittings.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => router.push(`/cases/sittings/${s.id}`)}
                      className="w-full text-left rounded-xl bg-white/[0.04] hover:bg-white/[0.07] active:bg-white/[0.1] px-3 py-2.5 transition-colors"
                    >
                      <p className="text-[13px] text-white/80 leading-snug line-clamp-1">
                        {s.title || s.case_number || "Sitting"}
                      </p>
                      {s.event_date && (
                        <p className="mt-1 text-[11px] text-white/60">
                          {new Date(
                            `${s.event_date}T00:00:00`,
                          ).toLocaleDateString("en-JM", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {recentJudgments.length === 0 && upcomingSittings.length === 0 && (
              <p className="text-[13px] text-white/55 text-center py-2">
                No recent activity
              </p>
            )}
          </>
        )}
      </div>

      <div className="px-5 pb-4 pt-2 shrink-0">
        <button
          onClick={() => router.push(`/judges/${judge.id}`)}
          className="group flex w-full min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[#009B3A]/30 bg-[#009B3A]/12 px-4 py-3 text-[13px] font-semibold text-[#009B3A] hover:bg-[#009B3A]/20 active:bg-[#009B3A]/25 transition-all duration-200"
        >
          View Full Profile
          <ExternalLink className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-px group-hover:-translate-y-px" />
        </button>
      </div>
    </div>
  );
}

/* ── WebGL fallback ── */

function StaticFallback({ judges }: { judges: Judge[] }) {
  const router = useRouter();
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 py-4">
      {judges.map((j) => {
        const color = courtColor(j.court);
        return (
          <button
            key={j.id}
            onClick={() => router.push(`/judges/${j.id}`)}
            className="flex items-center gap-4 rounded-2xl border border-white/[0.07] bg-[#0d0d1a] p-5 text-left hover:border-[#009B3A]/30 transition-colors"
          >
            <div
              className="h-10 w-10 shrink-0 rounded-xl flex items-center justify-center text-lg"
              style={{
                background: `${color}18`,
                border: `1px solid ${color}35`,
              }}
            >
              ⭐
            </div>
            <div>
              <p className="text-[13px] font-semibold text-white leading-snug">
                {j.name}
              </p>
              {j.court && (
                <p className="mt-1 text-[11px]" style={{ color }}>
                  {j.court}
                </p>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* ── Legend ── */

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-4 px-5 py-3">
      {Object.entries(COURT_COLORS).map(([court, color]) => (
        <div key={court} className="flex items-center gap-1.5">
          <div
            className="h-2.5 w-2.5 rounded-sm"
            style={{ background: color }}
          />
          <span className="text-[10px] text-white/70">{court}</span>
        </div>
      ))}
      <span className="ml-auto text-[10px] text-white/50">Size = caseload</span>
    </div>
  );
}

/* ── View toggle pill ── */

function ViewToggle({
  isGalactic,
  onToggle,
}: {
  isGalactic: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      aria-pressed={isGalactic}
      aria-label={
        isGalactic ? "Switch to Scatter View" : "Switch to Galactic View"
      }
      className={[
        "flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2.5 text-[13px] font-medium",
        "transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#009B3A]/50",
        isGalactic
          ? "border-[#009B3A]/50 bg-[#009B3A]/10 text-[#009B3A] shadow-[0_0_20px_rgba(0,155,58,0.18)]"
          : "border-white/[0.1] bg-white/[0.05] text-white/55 hover:border-white/20 hover:text-white/80",
      ].join(" ")}
    >
      {isGalactic ? (
        <Globe className="h-4 w-4 shrink-0" />
      ) : (
        <Sparkles className="h-4 w-4 shrink-0" />
      )}
      <span className="hidden sm:block whitespace-nowrap">
        {isGalactic ? "Galactic View" : "Scatter View"}
      </span>
    </button>
  );
}

/* ── Connections toggle pill ── */

function ConnectionsToggle({
  showConnections,
  onToggle,
}: {
  showConnections: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      aria-pressed={showConnections}
      aria-label={showConnections ? "Hide connections" : "Show connections"}
      className={[
        "flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2.5 text-[13px] font-medium",
        "transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FED100]/50",
        showConnections
          ? "border-[#FED100]/50 bg-[#FED100]/10 text-[#FED100] shadow-[0_0_20px_rgba(254,209,0,0.15)]"
          : "border-white/[0.1] bg-white/[0.05] text-white/55 hover:border-white/20 hover:text-white/80",
      ].join(" ")}
    >
      <Link2 className="h-4 w-4 shrink-0" />
      <span className="hidden sm:block whitespace-nowrap">
        {showConnections ? "Hide Connections" : "Show Connections"}
      </span>
    </button>
  );
}

/* ── Main export ── */

interface Props {
  judges: Judge[];
  connections: JudgeConnection[];
}

export default function JudicialConstellation({ judges, connections }: Props) {
  const filteredJudges = useMemo(
    () =>
      judges.filter((j) => !(j.court ?? "").toLowerCase().includes("parish")),
    [judges],
  );

  // Persist view preference across sessions.
  const [isGalactic, setIsGalactic] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(LS_VIEW_KEY) === "galactic";
  });

  // Connections default OFF; opt-in persisted.
  const [showConnections, setShowConnections] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(LS_CONNECTIONS_KEY) === "on";
  });

  const [selectedJudge, setSelectedJudge] = useState<Judge | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [webglOk, setWebglOk] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [judgeJudgments, setJudgeJudgments] = useState<Judgment[]>([]);
  const [judgeSittings, setJudgeSittings] = useState<CourtSitting[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const autoSelectedRef = useRef(false);

  useEffect(() => {
    try {
      const canvas = document.createElement("canvas");
      const ctx =
        canvas.getContext("webgl") ??
        (canvas.getContext(
          "experimental-webgl",
        ) as WebGLRenderingContext | null);
      if (!ctx) setWebglOk(false);
    } catch {
      setWebglOk(false);
    }
    setIsMobile(window.innerWidth < 768);
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const handleToggleView = useCallback(() => {
    setIsGalactic((prev) => {
      const next = !prev;
      localStorage.setItem(LS_VIEW_KEY, next ? "galactic" : "scatter");
      return next;
    });
  }, []);

  const handleToggleConnections = useCallback(() => {
    setShowConnections((prev) => {
      const next = !prev;
      localStorage.setItem(LS_CONNECTIONS_KEY, next ? "on" : "off");
      return next;
    });
  }, []);

  /* Fetch judge-specific data whenever selection changes */
  useEffect(() => {
    if (!selectedJudge) {
      setJudgeJudgments([]);
      setJudgeSittings([]);
      return;
    }
    setDataLoading(true);
    Promise.allSettled([
      apiClient.getJudgments({ judge: selectedJudge.name }),
      apiClient.getCourtSittings({ judge: selectedJudge.name }),
    ])
      .then(([jRes, sRes]) => {
        setJudgeJudgments(
          jRes.status === "fulfilled" ? jRes.value.judgments : [],
        );
        setJudgeSittings(
          sRes.status === "fulfilled" ? sRes.value.sittings : [],
        );
      })
      .finally(() => setDataLoading(false));
  }, [selectedJudge]);

  /* Auto-select when search narrows to exactly 1 judge */
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      if (autoSelectedRef.current) {
        setSelectedJudge(null);
        autoSelectedRef.current = false;
      }
      return;
    }
    const ql = q.toLowerCase();
    const matches = filteredJudges.filter(
      (j) =>
        j.name.toLowerCase().includes(ql) ||
        (j.court ?? "").toLowerCase().includes(ql),
    );
    if (matches.length === 1) {
      autoSelectedRef.current = true;
      setSelectedJudge(matches[0]);
    }
  }, [searchQuery, filteredJudges]);

  const scatterPositions = useMemo(
    () => computePositions(filteredJudges),
    [filteredJudges],
  );

  const galacticPositions = useMemo(
    () => computeGalacticPositions(filteredJudges),
    [filteredJudges],
  );

  const handleSelect = useCallback((judge: Judge | null) => {
    autoSelectedRef.current = false;
    setSelectedJudge(judge);
    document.body.style.cursor = "auto";
  }, []);

  const handleCanvasClick = useCallback(() => {
    autoSelectedRef.current = false;
    setSelectedJudge(null);
  }, []);

  const clearSelection = useCallback(() => {
    autoSelectedRef.current = false;
    setSelectedJudge(null);
  }, []);

  if (!webglOk) {
    return (
      <div>
        <StaticFallback judges={filteredJudges} />
      </div>
    );
  }

  return (
    <div
      className="dark flex flex-col"
      style={{
        height: "calc(100vh - 8rem)",
        colorScheme: "dark",
        background: "#050510",
      }}
    >
      {/* Search bar + view toggle */}
      <div className="px-1 pb-4 shrink-0 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/60 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by judge name or court…"
            className="w-full rounded-xl border border-white/[0.1] bg-white/[0.05] pl-10 pr-10 py-2.5 text-[13px] text-white placeholder-white/25 focus:outline-none focus:border-[#009B3A]/50 focus:ring-1 focus:ring-[#009B3A]/25 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white/60"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <ViewToggle isGalactic={isGalactic} onToggle={handleToggleView} />
        <ConnectionsToggle
          showConnections={showConnections}
          onToggle={handleToggleConnections}
        />
      </div>

      {/* Canvas container */}
      <div className="relative flex-1 rounded-2xl overflow-hidden border border-white/[0.05]">
        <Canvas
          camera={{ position: [0, 2.5, 10], fov: 50 }}
          onPointerMissed={handleCanvasClick}
          gl={{ antialias: true, powerPreference: "high-performance" }}
          dpr={[1, 1.5]}
        >
          <Suspense fallback={null}>
            <ConstellationScene
              judges={filteredJudges}
              connections={connections}
              scatterPositions={scatterPositions}
              galacticPositions={galacticPositions}
              isGalactic={isGalactic}
              showConnections={showConnections}
              selectedJudge={selectedJudge}
              onSelect={handleSelect}
              searchQuery={searchQuery}
            />
          </Suspense>
        </Canvas>

        {selectedJudge && !isMobile && (
          <JudgeInfoCard
            key={selectedJudge.id}
            judge={selectedJudge}
            judgments={judgeJudgments}
            sittings={judgeSittings}
            dataLoading={dataLoading}
            onClose={clearSelection}
          />
        )}

        {!selectedJudge && filteredJudges.length > 0 && (
          <p className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] text-white/50 whitespace-nowrap">
            Tap a star to explore · Drag to rotate
          </p>
        )}
      </div>

      <Legend />

      {selectedJudge && isMobile && (
        <>
          <div
            className="md:hidden fixed inset-0 z-[65] bg-black/40"
            onClick={clearSelection}
          />
          <MobileSheet
            key={selectedJudge.id}
            judge={selectedJudge}
            judgments={judgeJudgments}
            sittings={judgeSittings}
            dataLoading={dataLoading}
            onClose={clearSelection}
          />
        </>
      )}
    </div>
  );
}
