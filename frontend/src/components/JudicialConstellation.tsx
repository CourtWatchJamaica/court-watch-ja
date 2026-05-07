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
import { Search, X, ExternalLink, Users, FileText, Calendar, Loader2 } from "lucide-react";

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

/* ── Random constellation positions ── */

function computePositions(
  judges: Judge[],
): Map<number, [number, number, number]> {
  const map = new Map<number, [number, number, number]>();
  const placed: [number, number, number][] = [];
  const MIN_DIST = 0.7;

  for (const judge of judges) {
    // XOR-shift RNG seeded per judge ID — deterministic, never zero
    let s = (judge.id * 2654435761) >>> 0;
    if (s === 0) s = 1;
    const rand = () => {
      s ^= s << 13;
      s ^= s >>> 17;
      s ^= s << 5;
      return (s >>> 0) / 0xffffffff;
    };

    let best: [number, number, number] = [0, 0, 0];
    let bestMinDist = -Infinity;

    for (let attempt = 0; attempt < 64; attempt++) {
      const r     = 2.5 + rand() * 2.0;
      const theta = rand() * Math.PI * 2;
      // phi biased toward equatorial plane: π/4 … 3π/4
      const phi   = Math.PI / 4 + rand() * (Math.PI / 2);

      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.cos(phi);
      const z = r * Math.sin(phi) * Math.sin(theta);
      const candidate: [number, number, number] = [x, y, z];

      const minD =
        placed.length === 0
          ? Infinity
          : Math.min(
              ...placed.map((p) =>
                Math.hypot(p[0] - x, p[1] - y, p[2] - z),
              ),
            );

      if (minD >= MIN_DIST) {
        best = candidate;
        break;
      }
      if (minD > bestMinDist) {
        bestMinDist = minD;
        best = candidate;
      }
    }

    placed.push(best);
    map.set(judge.id, best);
  }

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
    const mid = new THREE.Vector3(
      (posA[0] + posB[0]) / 2,
      (posA[1] + posB[1]) / 2 + 0.45,
      (posA[2] + posB[2]) / 2,
    );
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(...posA),
      mid,
      new THREE.Vector3(...posB),
    );
    const pts = curve.getPoints(14);
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({
      color: "#FED100",
      transparent: true,
      opacity: 0.16,
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

/* ── Individual judge star ── */

interface StarProps {
  judge: Judge;
  position: [number, number, number];
  size: number;
  color: string;
  isSelected: boolean;
  isSearchMatch: boolean;
  isSearchActive: boolean;
  onSelect: (judge: Judge | null) => void;
}

function JudgeStar({
  judge,
  position,
  size,
  color,
  isSelected,
  isSearchMatch,
  isSearchActive,
  onSelect,
}: StarProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const baseY = position[1];
  const phase = judge.id * 1.37;
  const [hovered, setHovered] = useState(false);

  const geom = useMemo(() => {
    const shape = makeStarShape(0.5 * size, 0.22 * size);
    return new THREE.ExtrudeGeometry(shape, {
      depth: 0.12 * size,
      bevelEnabled: true,
      bevelSize: 0.025 * size,
      bevelThickness: 0.025 * size,
      bevelSegments: 3,
    });
  }, [size]);

  useEffect(() => () => geom.dispose(), [geom]);

  useFrame(({ clock }, delta) => {
    if (!meshRef.current || !matRef.current) return;

    meshRef.current.rotation.y += delta * (isSelected ? 2.2 : hovered ? 1.1 : 0.42);
    meshRef.current.position.y =
      baseY + Math.sin(clock.elapsedTime * 0.65 + phase) * 0.085;

    const dimmed = isSearchActive && !isSearchMatch;
    const targetOpacity = dimmed ? 0.1 : 1.0;
    const targetEmissive = dimmed
      ? 0.0
      : isSelected
        ? 0.55 + Math.sin(clock.elapsedTime * 3.2) * 0.28
        : hovered
          ? 0.28
          : 0.08;

    matRef.current.opacity += (targetOpacity - matRef.current.opacity) * 0.08;
    matRef.current.emissiveIntensity +=
      (targetEmissive - matRef.current.emissiveIntensity) * 0.08;
    matRef.current.transparent = matRef.current.opacity < 0.98;
  });

  return (
    <group position={[position[0], baseY, position[2]]}>
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
          emissiveIntensity={0.08}
          metalness={0.65}
          roughness={0.18}
        />
      </mesh>

      {isSelected && (
        <mesh>
          <sphereGeometry args={[size * 0.95, 12, 12]} />
          <meshBasicMaterial color={color} transparent opacity={0.06} />
        </mesh>
      )}

      {/* Own suggestion #1: floating name label on hover */}
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
            {judge.name}
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
  positions: Map<number, [number, number, number]>;
  selectedJudge: Judge | null;
  onSelect: (j: Judge | null) => void;
  searchQuery: string;
}

function ConstellationScene({
  judges,
  connections,
  positions,
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
    const pos = positions.get(selectedJudge.id);
    if (!pos) return null;
    return new THREE.Vector3(pos[0], pos[1], pos[2]);
  }, [selectedJudge, positions]);

  const maxCases = useMemo(
    () => Math.max(1, ...judges.map((j) => j.total_cases ?? 1)),
    [judges],
  );

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

      {connections.map((conn, i) => {
        const posA = positions.get(conn.judge_a_id);
        const posB = positions.get(conn.judge_b_id);
        if (!posA || !posB) return null;
        return <ConstellationEdge key={i} posA={posA} posB={posB} />;
      })}

      {judges.map((judge) => {
        const pos = positions.get(judge.id);
        if (!pos) return null;
        const size = 1.0 + ((judge.total_cases ?? 1) / maxCases) * 1.2;
        const isMatch =
          !isSearchActive ||
          judge.name.toLowerCase().includes(searchLower) ||
          (judge.court ?? "").toLowerCase().includes(searchLower);

        return (
          <JudgeStar
            key={judge.id}
            judge={judge}
            position={pos}
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

  /* Own suggestion #2: slide-in entry animation */
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
        transform: mounted ? "translateY(0) scale(1)" : "translateY(10px) scale(0.97)",
        transition: "opacity 0.22s ease, transform 0.22s cubic-bezier(0.4,0,0.2,1)",
      }}
    >
      {/* Accent stripe */}
      <div
        className="h-[2px] w-full shrink-0"
        style={{ background: `linear-gradient(to right, ${color}, transparent)` }}
      />

      {/* Header */}
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
            className="rounded-md p-0.5 text-white/30 hover:text-white/60 transition-colors shrink-0"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {judge.total_cases !== undefined && (
          <div className="flex items-center gap-1.5">
            <Users className="h-3 w-3 text-white/25" />
            <span className="text-[11px] text-white/45">
              {judge.total_cases} case{judge.total_cases !== 1 ? "s" : ""} on record
            </span>
          </div>
        )}
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-4 pb-3 space-y-4 min-h-0">
        {dataLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-white/20" />
          </div>
        ) : (
          <>
            {recentJudgments.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <FileText className="h-3 w-3 text-[#009B3A]/70" />
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/30">
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
                        <p className="mt-0.5 text-[10px] text-white/30">
                          {new Date(`${j.date}T00:00:00`).toLocaleDateString("en-JM", {
                            month: "short",
                            year: "numeric",
                          })}
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
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/30">
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
                        <p className="mt-0.5 text-[10px] text-white/30">
                          {new Date(`${s.event_date}T00:00:00`).toLocaleDateString("en-JM", {
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
              <p className="text-[11px] text-white/25 text-center py-2">
                No recent activity
              </p>
            )}
          </>
        )}
      </div>

      {/* Footer — View Full Profile with glow + arrow shift */}
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
          style={{ background: `linear-gradient(to right, ${color}, transparent)` }}
        />
      </div>

      {/* Header */}
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
            className="rounded-lg p-1.5 text-white/30 hover:text-white/60"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {judge.total_cases !== undefined && (
          <p className="text-[12px] text-white/40">
            {judge.total_cases} case{judge.total_cases !== 1 ? "s" : ""} on record
          </p>
        )}
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-5 pb-2 space-y-4 min-h-0">
        {dataLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-white/20" />
          </div>
        ) : (
          <>
            {recentJudgments.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <FileText className="h-3.5 w-3.5 text-[#009B3A]/70" />
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-white/30">
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
                        <p className="mt-1 text-[11px] text-white/30">
                          {new Date(`${j.date}T00:00:00`).toLocaleDateString("en-JM", {
                            month: "short",
                            year: "numeric",
                          })}
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
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-white/30">
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
                        <p className="mt-1 text-[11px] text-white/30">
                          {new Date(`${s.event_date}T00:00:00`).toLocaleDateString("en-JM", {
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
              <p className="text-[13px] text-white/25 text-center py-2">
                No recent activity
              </p>
            )}
          </>
        )}
      </div>

      {/* Footer — 44px min tap target + arrow shift */}
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
          <span className="text-[10px] text-white/40">{court}</span>
        </div>
      ))}
      <span className="ml-auto text-[10px] text-white/20">Size = caseload</span>
    </div>
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
      judges.filter(
        (j) => !(j.court ?? "").toLowerCase().includes("parish"),
      ),
    [judges],
  );
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

  /* Fetch judge-specific data whenever selection changes */
  useEffect(() => {
    if (!selectedJudge) {
      setJudgeJudgments([]);
      setJudgeSittings([]);
      return;
    }
    setDataLoading(true);
    Promise.allSettled([
      apiClient.getJudgments(undefined, undefined, selectedJudge.name),
      apiClient.getCourtSittings({ judge: selectedJudge.name }),
    ])
      .then(([jRes, sRes]) => {
        setJudgeJudgments(jRes.status === "fulfilled" ? jRes.value.judgments : []);
        setJudgeSittings(sRes.status === "fulfilled" ? sRes.value.sittings : []);
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

  const positions = useMemo(() => computePositions(filteredJudges), [filteredJudges]);

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
      style={{ height: "calc(100vh - 8rem)", colorScheme: "dark", background: "#050510" }}
    >
      {/* Search bar */}
      <div className="px-1 pb-4 shrink-0">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30 pointer-events-none" />
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
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
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
              positions={positions}
              selectedJudge={selectedJudge}
              onSelect={handleSelect}
              searchQuery={searchQuery}
            />
          </Suspense>
        </Canvas>

        {/* Desktop info overlay — key forces remount + re-animates on judge change */}
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

        {/* Hint text */}
        {!selectedJudge && filteredJudges.length > 0 && (
          <p className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] text-white/20 whitespace-nowrap">
            Tap a star to explore · Drag to rotate
          </p>
        )}
      </div>

      {/* Legend */}
      <Legend />

      {/* Mobile bottom sheet */}
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
