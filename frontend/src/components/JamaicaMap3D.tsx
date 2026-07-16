"use client";

import {
  useRef,
  useState,
  useMemo,
  useEffect,
  Suspense,
  useCallback,
} from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import { ParishCourtCase, ParishSummary } from "@/lib/types";
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  MapPin,
  AlertTriangle,
  Home,
  Pill,
} from "lucide-react";

// ── Constants ─────────────────────────────────────────────────────────────────

const SVG_W = 1133.846;
const SVG_H = 545.658;
const MAP_SCALE = 12 / SVG_W; // ≈ 0.0106  →  map ≈ 12 units wide

// Maps SVG path/polygon IDs (from Parishes_geosort layer) to API parish names.
//
// Verified by computing bounding-box centroids for each element and matching
// them to the TT_Parishes text-label positions in the same SVG:
//
//   path73  centroid (714, 348) area=32,493 → St. Catherine  ← was wrongly "St. Ann"
//   path81  centroid (544, 407) area=41,819 → Clarendon      ← was wrongly "St. Ann"
//   path83  centroid (603, 187) area=34,192 → St. Ann        ✓
//   path69/71 centroid ~(660-670, 470-493) area<20 → KSAC coastal fragments
//
const PATH_TO_PARISH: Record<string, string> = {
  // ── Main parish bodies (area > 9 000 in SVG units) ──────────────────────
  path51:    "St. Thomas",
  path53:    "Portland",
  path57:    "St. Andrew",
  path63:    "St. Mary",
  path73:    "St. Catherine",  // CORRECTED — main St. Catherine body
  path79:    "Manchester",
  path81:    "Clarendon",      // CORRECTED — main Clarendon body
  path83:    "St. Ann",
  path87:    "Trelawny",
  path91:    "St. James",
  path93:    "Hanover",
  path95:    "Westmoreland",
  polygon89: "St. Elizabeth",  // main St. Elizabeth body

  // ── Secondary pieces: offshore islands and disconnected coastal fragments ─
  polygon55: "St. Andrew",    // small island off St. Andrew
  polygon61: "St. Andrew",    // Kingston/KSAC coastal area (→ St. Andrew)
  polygon65: "St. Catherine", // small fragment near St. Catherine coast
  path59:    "St. Andrew",    // tiny KSAC coastal fragment
  path67:    "St. Andrew",    // tiny KSAC coastal fragment
  path69:    "St. Andrew",    // tiny KSAC coastal fragment
  path71:    "St. Catherine", // tiny fragment south of Kingston
  path75:    "St. Catherine", // tiny coastal fragment
  path77:    "St. Catherine", // tiny coastal fragment
  path85:    "St. Elizabeth", // tiny fragment near St. Elizabeth
};

export type MapCategory = "all" | "violent" | "property" | "drugs";

// 5-step colour scales (light → dark)
const COLOR_SCALES: Record<MapCategory, string[]> = {
  all:      ["#bbf7d0", "#4ade80", "#009B3A", "#15803d", "#052e16"],
  violent:  ["#fee2e2", "#f87171", "#dc2626", "#991b1b", "#7f1d1d"],
  property: ["#dbeafe", "#93c5fd", "#2563eb", "#1d4ed8", "#1e3a8a"],
  drugs:    ["#fef3c7", "#fcd34d", "#d97706", "#b45309", "#78350f"],
};

// ── Offence categorisation ────────────────────────────────────────────────────
// Keywords derived from real scraped Jamaican court offence strings.
// Priority order: violent → drugs → property → other.

const VIOLENT_KW = [
  "murder", "attempted murder", "manslaughter",
  // assault variants
  // "ass ob" catches "Ass OB Harm" (no periods); "o b harm" catches "O.B Harm" after period→space
  "assault", "ass ob", "ob harm", "o b harm", "bodily harm",
  "wounding", "unlawful wounding", "wounding with intent",
  "shooting", "stabbing", "arson",
  "robbery", "rape",
  // "indecent" removed (too broad — matches "Indecent Language"); use specific forms
  "indecent assault", "gross indecen",
  "sexual", "grievous",
  "gun", "firearm", "ammunition",
  "threat", "threatening", "stone throwing", "abduction",
  "weapon", "prohibited weapon",
  "buggery",
  "sex with",
  "cruelty",        // "Cruelty to Child"
  "causing death",  // "Causing Death by Dangerous Driving"
  // dotted abbreviations after period→space transform:
  // "G.S.A" → "g s a", "G.B.H.W.I" → "g b h w i", "S.I.W.P.U.S" → "s i w p u s"
  "g s a", "g b h", "s i w p u s",
];

const DRUG_KW = [
  "ganja", "cannabis", "cocaine", "crack",
  "dangerous drug", "controlled substance",
  "possession of ganja", "possession of cocaine",
  "drug trafficking", "trafficking", "traffick",
  "cultivation",
  // "conspiracy" removed — too broad (matches "Conspiracy to larceny motor vehicle")
  "export of", "import of",
];

const PROPERTY_KW = [
  "larceny", "praedial larceny",
  "theft", "stealing", "receiving stolen",
  "burglary", "housebreaking", "breaking",
  "fraud", "forgery", "obtaining", "false pretences",
  // "mal dest" catches "Mal.Dest.of.Property" / "Mal Dest of Property"
  // "ma dest" catches "Ma. Dest. Of Property" (different abbreviation style)
  "malicious destruction", "malicious", "mal dest", "ma dest",
  "toll evasion",
  "embezzlement", "forged", "uttering", "counterfeit",
  // ID-info variants: "POSSESSION OF ID INFORMATION", "Poss of ID Info", "Knowingly Poss. Identity Info."
  "identity information", "id information", "id info", "identity info",
  "access device",  // "Poss of Access Device" (identity fraud instrument)
];

function categorise(offence: string | null): "violent" | "property" | "drugs" | "other" {
  if (!offence) return "other";
  // Normalise: lowercase, collapse whitespace, strip full-stops from abbreviations
  const o = offence.toLowerCase().replace(/\./g, " ").replace(/\s{2,}/g, " ").trim();
  if (VIOLENT_KW.some((k) => o.includes(k)))  return "violent";
  if (DRUG_KW.some((k)    => o.includes(k)))  return "drugs";
  if (PROPERTY_KW.some((k) => o.includes(k))) return "property";
  return "other";
}

// ── Parish name normalisation ─────────────────────────────────────────────────
// Converts "Saint Andrew", "St Andrew", "ST. ANDREW" → "St. Andrew" so that
// SVG path labels, API summary names, and case parish fields all compare equal.

function normalizeParish(name: string): string {
  return name
    .trim()
    .replace(/\bSaint[-\s]+/i, "St. ")   // "Saint Andrew", "Saint-Catherine" → "St. …"
    .replace(/\bSt\.?[-\s]+/i, "St. ");  // "St Ann", "St. Ann", "St-Ann" → "St. Ann"
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface ParishStats {
  total:    number;
  violent:  number;
  property: number;
  drugs:    number;
  other:    number;
}

interface ShapeEntry {
  id:     string;
  parish: string;
  shapes: THREE.Shape[];
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function interpolateColor(hex: string): THREE.Color {
  return new THREE.Color(hex);
}

function colorForCount(
  count:    number,
  maxCount: number,
  category: MapCategory
): THREE.Color {
  const scale = COLOR_SCALES[category];
  if (maxCount === 0) return interpolateColor(scale[0]);
  const t = Math.min(count / maxCount, 1);
  const idx = Math.floor(t * (scale.length - 1));
  const lo = scale[Math.min(idx, scale.length - 1)];
  const hi = scale[Math.min(idx + 1, scale.length - 1)];
  const frac = t * (scale.length - 1) - idx;
  return new THREE.Color(lo).lerp(new THREE.Color(hi), frac);
}

function extrudeDepthFor(count: number, maxCount: number): number {
  if (maxCount === 0) return 0.05;
  return 0.05 + (count / maxCount) * 0.4;
}

function transformGeometry(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const cx = SVG_W / 2;
  const cy = SVG_H / 2;
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const arr = pos.array as Float32Array;
  for (let i = 0; i < arr.length; i += 3) {
    arr[i]     = (arr[i] - cx) * MAP_SCALE;
    arr[i + 1] = -(arr[i + 1] - cy) * MAP_SCALE;
    // arr[i+2] = extrusion depth, keep as-is
  }
  pos.needsUpdate = true;
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  geo.computeVertexNormals();
  return geo;
}

function getCategoryCount(stats: ParishStats, category: MapCategory): number {
  if (category === "all")      return stats.total;
  if (category === "violent")  return stats.violent;
  if (category === "property") return stats.property;
  if (category === "drugs")    return stats.drugs;
  return stats.total;
}

// ── Parish 3D mesh ────────────────────────────────────────────────────────────

interface ParishMeshProps {
  entry:          ShapeEntry;
  stats:          ParishStats;
  maxCount:       number;
  category:       MapCategory;
  rank:           number;
  isSelected:     boolean;
  onHover:        (parish: string | null) => void;
  onClick:        (parish: string) => void;
  hoveredParish:  string | null;
}

function ParishMesh({
  entry,
  stats,
  maxCount,
  category,
  rank,
  isSelected,
  onHover,
  onClick,
  hoveredParish,
}: ParishMeshProps) {
  const meshRef   = useRef<THREE.Mesh>(null);
  const matRef    = useRef<THREE.MeshStandardMaterial>(null);

  const isHovered = hoveredParish === entry.parish;
  const count     = getCategoryCount(stats, category);
  const depth     = extrudeDepthFor(count, maxCount);

  const geometry = useMemo(() => {
    const geo = new THREE.ExtrudeGeometry(entry.shapes, {
      depth,
      bevelEnabled: false,
      steps: 1,
    });
    return transformGeometry(geo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry.shapes, depth]);

  // Target values for smooth lerp
  const targetY         = useRef(0);
  const targetEmissive  = useRef(0);
  const currentColor    = useRef(colorForCount(count, maxCount, category).clone());
  const targetColor     = useRef(colorForCount(count, maxCount, category).clone());

  // Update targets when props change
  useEffect(() => {
    targetY.current       = isHovered ? 0.1 : 0;
    targetEmissive.current = isHovered ? 0.35 : isSelected ? 0.2 : 0;
  }, [isHovered, isSelected]);

  useEffect(() => {
    targetColor.current.copy(colorForCount(count, maxCount, category));
  }, [count, maxCount, category]);

  useFrame((_, delta) => {
    if (!meshRef.current || !matRef.current) return;
    const speed = delta * 4;
    meshRef.current.position.y = THREE.MathUtils.lerp(
      meshRef.current.position.y,
      targetY.current,
      speed
    );
    matRef.current.emissiveIntensity = THREE.MathUtils.lerp(
      matRef.current.emissiveIntensity,
      targetEmissive.current,
      speed
    );
    currentColor.current.lerp(targetColor.current, delta * 2);
    matRef.current.color.copy(currentColor.current);
  });

  const goldBorder = isSelected && !isHovered;

  return (
    <group>
      <mesh
        ref={meshRef}
        geometry={geometry}
        onPointerOver={(e) => { e.stopPropagation(); onHover(entry.parish); }}
        onPointerOut={(e)  => { e.stopPropagation(); onHover(null); }}
        onClick={(e)       => { e.stopPropagation(); onClick(entry.parish); }}
      >
        <meshStandardMaterial
          ref={matRef}
          color={currentColor.current}
          metalness={0.3}
          roughness={0.7}
          emissive={isSelected ? new THREE.Color("#FED100") : new THREE.Color("#ffffff")}
          emissiveIntensity={isSelected ? 0.2 : 0}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Gold outline wire for selected parish */}
      {goldBorder && (
        <mesh geometry={geometry} renderOrder={1}>
          <meshBasicMaterial color="#FED100" wireframe side={THREE.BackSide} />
        </mesh>
      )}

      {/* Hover tooltip */}
      {isHovered && (
        <Html
          position={[0, 0.08, depth + 0.06]}
          style={{ pointerEvents: "none", transform: "translate(-50%, -100%)" }}
          distanceFactor={10}
        >
          <div
            style={{
              background: "rgba(10,10,10,0.92)",
              border: "1px solid rgba(205,127,50,0.4)",
              borderRadius: 10,
              padding: "8px 12px",
              minWidth: 140,
              textAlign: "left",
              backdropFilter: "blur(8px)",
              boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
            }}
          >
            <p style={{ color: "#FED100", fontWeight: 700, fontSize: 13, margin: 0 }}>
              {entry.parish}
            </p>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, margin: "2px 0 0" }}>
              Rank #{rank} · {count.toLocaleString()} case{count !== 1 ? "s" : ""}
            </p>
          </div>
        </Html>
      )}
    </group>
  );
}

// ── Map Scene ─────────────────────────────────────────────────────────────────

interface MapSceneProps {
  shapeEntries:  ShapeEntry[];
  parishStats:   Record<string, ParishStats>;
  sortedParishes: string[];
  category:      MapCategory;
  selectedParish: string | null;
  onParishClick: (parish: string) => void;
}

function MapScene({
  shapeEntries,
  parishStats,
  sortedParishes,
  category,
  selectedParish,
  onParishClick,
}: MapSceneProps) {
  const [hoveredParish, setHoveredParish] = useState<string | null>(null);

  const maxCount = useMemo(() => {
    return Math.max(
      1,
      ...Object.values(parishStats).map((s) => getCategoryCount(s, category))
    );
  }, [parishStats, category]);

  const rankMap = useMemo(() => {
    const m: Record<string, number> = {};
    sortedParishes.forEach((p, i) => { m[p] = i + 1; });
    return m;
  }, [sortedParishes]);

  return (
    <>
      <color attach="background" args={["#0a0a0a"]} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[6, 10, 8]} intensity={1.2} castShadow />
      <pointLight position={[-8, 4, 4]} intensity={0.3} color="#1a0a00" />
      <pointLight position={[0, 8, 2]} intensity={0.2} color="#009B3A" />

      <Suspense fallback={null}>
        {shapeEntries.map((entry) => {
          const normParish = normalizeParish(entry.parish);
          const stats = parishStats[normParish] ?? {
            total: 0, violent: 0, property: 0, drugs: 0, other: 0,
          };
          return (
            <ParishMesh
              key={entry.id}
              entry={entry}
              stats={stats}
              maxCount={maxCount}
              category={category}
              rank={rankMap[normParish] ?? 14}
              isSelected={
                selectedParish !== null &&
                normalizeParish(selectedParish) === normParish
              }
              hoveredParish={hoveredParish}
              onHover={setHoveredParish}
              onClick={onParishClick}
            />
          );
        })}
      </Suspense>

      <OrbitControls
        enablePan={false}
        enableZoom
        minDistance={1.5}
        maxDistance={5}
        autoRotate
        autoRotateSpeed={0.2}
        minPolarAngle={Math.PI / 8}
        maxPolarAngle={Math.PI / 2.1}
        makeDefault
      />
    </>
  );
}

// ── WebGL Fallback ────────────────────────────────────────────────────────────

function MapFallback2D({ summary }: { summary: ParishSummary[] }) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 p-4">
      {summary.map((p) => (
        <div
          key={p.name}
          className="rounded-xl border border-[#CD7F32]/20 bg-[#CD7F32]/5 p-3 text-center"
        >
          <p className="text-[11px] text-[#CD7F32]/70 font-semibold truncate">{p.name}</p>
          <p className="text-lg font-bold text-white">{p.total_cases}</p>
        </div>
      ))}
    </div>
  );
}

// ── Legend ────────────────────────────────────────────────────────────────────

function MapLegend({
  category,
  maxCount,
}: {
  category: MapCategory;
  maxCount: number;
}) {
  const scale = COLOR_SCALES[category];
  const step  = maxCount > 0 ? Math.ceil(maxCount / (scale.length - 1)) : 1;

  return (
    <div className="flex items-center gap-3 mt-3 px-2 flex-wrap">
      <span className="text-[10px] text-white/60 uppercase tracking-widest shrink-0">
        Cases
      </span>
      <div className="flex items-center gap-1 flex-1 min-w-0">
        {scale.map((hex, i) => (
          <div key={hex} className="flex flex-col items-center gap-0.5 flex-1">
            <div
              className="w-full h-3 rounded-sm"
              style={{ background: hex }}
            />
            <span className="text-[9px] text-white/60 tabular-nums">
              {i === 0 ? "0" : `${(i * step).toLocaleString()}`}
            </span>
          </div>
        ))}
        <span className="text-[9px] text-white/60 tabular-nums ml-1">
          {maxCount > 0 ? `${maxCount.toLocaleString()}+` : ""}
        </span>
      </div>
    </div>
  );
}

// ── Parish Leaderboard ────────────────────────────────────────────────────────

type LeaderboardCol = "total" | "violent" | "property" | "drugs";

function pct(n: number, total: number): string {
  if (total === 0) return "0%";
  return `${Math.round((n / total) * 100)}%`;
}

function ParishLeaderboard({
  summary,
  parishStats,
  selectedParish,
  onSelect,
}: {
  summary:        ParishSummary[];
  parishStats:    Record<string, ParishStats>;
  selectedParish: string | null;
  onSelect:       (p: string) => void;
}) {
  const [sortCol, setSortCol]   = useState<LeaderboardCol>("total");
  const [sortAsc, setSortAsc]   = useState(false);

  const sorted = useMemo(() => {
    return [...summary].sort((a, b) => {
      const sa = parishStats[normalizeParish(a.name)] ?? { total: 0, violent: 0, property: 0, drugs: 0, other: 0 };
      const sb = parishStats[normalizeParish(b.name)] ?? { total: 0, violent: 0, property: 0, drugs: 0, other: 0 };
      const va = sa[sortCol];
      const vb = sb[sortCol];
      return sortAsc ? va - vb : vb - va;
    });
  }, [summary, parishStats, sortCol, sortAsc]);

  function handleSort(col: LeaderboardCol) {
    if (col === sortCol) setSortAsc((a) => !a);
    else { setSortCol(col); setSortAsc(false); }
  }

  function SortIcon({ col }: { col: LeaderboardCol }) {
    if (col !== sortCol) return <ChevronsUpDown className="h-3 w-3 opacity-30" />;
    return sortAsc
      ? <ChevronUp className="h-3 w-3 text-[#CD7F32]" />
      : <ChevronDown className="h-3 w-3 text-[#CD7F32]" />;
  }

  const thCls =
    "px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-white/60 cursor-pointer hover:text-white/60 transition-colors select-none whitespace-nowrap";

  return (
    <div className="mt-6 overflow-x-auto rounded-2xl border border-white/[0.06]">
      <table className="w-full min-w-[540px] text-sm">
        <thead>
          <tr className="border-b border-white/[0.06] bg-white/[0.02]">
            <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-white/60 w-10">
              #
            </th>
            <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-white/60">
              Parish
            </th>
            <th className={thCls} onClick={() => handleSort("total")}>
              <span className="flex items-center gap-1">
                Total <SortIcon col="total" />
              </span>
            </th>
            <th className={thCls} onClick={() => handleSort("violent")}>
              <span className="flex items-center gap-1 text-red-400/70">
                Violent % <SortIcon col="violent" />
              </span>
            </th>
            <th className={thCls} onClick={() => handleSort("property")}>
              <span className="flex items-center gap-1 text-blue-400/70">
                Property % <SortIcon col="property" />
              </span>
            </th>
            <th className={thCls} onClick={() => handleSort("drugs")}>
              <span className="flex items-center gap-1 text-amber-400/70">
                Drugs % <SortIcon col="drugs" />
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((p, i) => {
            const s = parishStats[normalizeParish(p.name)] ?? { total: 0, violent: 0, property: 0, drugs: 0, other: 0 };
            const active =
              selectedParish !== null &&
              normalizeParish(selectedParish) === normalizeParish(p.name);
            return (
              <tr
                key={p.name}
                onClick={() => onSelect(p.name)}
                className={`border-b border-white/[0.04] last:border-0 cursor-pointer transition-colors hover:bg-white/[0.04] ${
                  active ? "bg-[#CD7F32]/[0.07]" : ""
                }`}
                style={active ? { borderLeft: "2px solid #FED100" } : {}}
              >
                <td className="px-3 py-2.5 text-white/60 tabular-nums text-xs">{i + 1}</td>
                <td className={`px-3 py-2.5 font-medium text-[13px] ${active ? "text-[#FED100]" : "text-white/80"}`}>
                  {p.name}
                </td>
                <td className="px-3 py-2.5 text-white/70 tabular-nums text-[13px] font-semibold">
                  {s.total.toLocaleString()}
                </td>
                <td className="px-3 py-2.5 text-red-400/70 tabular-nums text-[12px]">
                  {pct(s.violent, s.total)}
                </td>
                <td className="px-3 py-2.5 text-blue-400/70 tabular-nums text-[12px]">
                  {pct(s.property, s.total)}
                </td>
                <td className="px-3 py-2.5 text-amber-400/70 tabular-nums text-[12px]">
                  {pct(s.drugs, s.total)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Top Offences ──────────────────────────────────────────────────────────────

function TopOffences({ cases }: { cases: ParishCourtCase[] }) {
  const offences = useMemo(() => {
    const countMap: Record<string, { count: number; parishes: Record<string, number> }> = {};
    for (const c of cases) {
      if (!c.offence) continue;
      const key = c.offence.trim();
      if (!countMap[key]) countMap[key] = { count: 0, parishes: {} };
      countMap[key].count += 1;
      countMap[key].parishes[c.parish] = (countMap[key].parishes[c.parish] ?? 0) + 1;
    }
    const total = cases.length;
    return Object.entries(countMap)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([offence, data]) => {
        const topParish = Object.entries(data.parishes).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
        return {
          offence,
          count: data.count,
          pct: total > 0 ? Math.round((data.count / total) * 100) : 0,
          topParish,
        };
      });
  }, [cases]);

  if (offences.length === 0) return null;

  return (
    <div className="mt-6 overflow-x-auto rounded-2xl border border-white/[0.06]">
      <table className="w-full min-w-[460px] text-sm">
        <thead>
          <tr className="border-b border-white/[0.06] bg-white/[0.02]">
            {["Offence", "Count", "% of Total", "Most Affected Parish"].map((h) => (
              <th
                key={h}
                className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-white/60 whitespace-nowrap"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {offences.map((row, i) => (
            <tr
              key={row.offence}
              className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.03] transition-colors"
            >
              <td className="px-3 py-2.5 text-white/80 text-[13px] max-w-[220px] truncate">
                <span className="text-[#CD7F32]/50 tabular-nums mr-2">{i + 1}.</span>
                {row.offence}
              </td>
              <td className="px-3 py-2.5 text-white/70 tabular-nums text-[13px] font-semibold">
                {row.count.toLocaleString()}
              </td>
              <td className="px-3 py-2.5 text-[#CD7F32]/70 tabular-nums text-[12px]">
                {row.pct}%
              </td>
              <td className="px-3 py-2.5 text-white/70 text-[12px] whitespace-nowrap">
                {row.topParish}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Category Toggle ───────────────────────────────────────────────────────────

const CAT_OPTIONS: { id: MapCategory; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "all",      label: "All Cases",      Icon: MapPin },
  { id: "violent",  label: "Violent Crime",  Icon: AlertTriangle },
  { id: "property", label: "Property Crime", Icon: Home },
  { id: "drugs",    label: "Drug Offences",  Icon: Pill },
];

const CAT_ACTIVE_COLORS: Record<MapCategory, string> = {
  all:      "bg-[#009B3A]/20 border-[#009B3A]/40 text-[#4ade80]",
  violent:  "bg-red-500/15 border-red-500/40 text-red-400",
  property: "bg-blue-500/15 border-blue-500/40 text-blue-400",
  drugs:    "bg-amber-500/15 border-amber-500/40 text-amber-400",
};

// ── Skeleton ──────────────────────────────────────────────────────────────────

function CanvasSkeleton({ mobile }: { mobile: boolean }) {
  return (
    <div
      className={`w-full rounded-2xl bg-white/[0.03] border border-white/[0.05] animate-pulse flex items-center justify-center ${
        mobile ? "h-[350px]" : "h-[450px]"
      }`}
    >
      <p className="text-white/15 text-xs">Loading map…</p>
    </div>
  );
}

// ── Main Export ───────────────────────────────────────────────────────────────

interface JamaicaMap3DProps {
  summary:        ParishSummary[];
  analyticsCases: ParishCourtCase[];
  selectedParish: string | null;
  onParishClick:  (parish: string) => void;
}

export default function JamaicaMap3D({
  summary,
  analyticsCases,
  selectedParish,
  onParishClick,
}: JamaicaMap3DProps) {
  const [mapCategory, setMapCategory] = useState<MapCategory>("all");
  const [shapeEntries, setShapeEntries] = useState<ShapeEntry[]>([]);
  const [svgLoading, setSvgLoading]     = useState(true);
  const [webglOk, setWebglOk]           = useState(true);

  // Check WebGL availability
  useEffect(() => {
    try {
      const c = document.createElement("canvas");
      const ctx =
        c.getContext("webgl") ||
        (c.getContext("experimental-webgl") as WebGLRenderingContext | null);
      if (!ctx) setWebglOk(false);
    } catch {
      setWebglOk(false);
    }
  }, []);

  // Load + parse SVG once
  useEffect(() => {
    if (!webglOk) return;
    fetch("/images/jamaica-parishes.svg")
      .then((r) => r.text())
      .then((text) => {
        const loader = new SVGLoader();
        const data   = loader.parse(text);

        const entries: ShapeEntry[] = [];
        for (const path of data.paths) {
          const node = path.userData?.node as Element | undefined;
          if (!node) continue;
          const id       = node.id;
          const parentId = (node.parentNode as Element | null)?.id;
          if (parentId !== "Parishes_geosort") continue;
          const parish = PATH_TO_PARISH[id];
          if (!parish) continue;

          // Use static helper to get shapes from path
          const shapes = (SVGLoader as unknown as { createShapes: (p: typeof path) => THREE.Shape[] }).createShapes(path);
          if (shapes.length > 0) {
            entries.push({ id, parish, shapes });
          }
        }
        setShapeEntries(entries);
      })
      .catch(() => {})
      .finally(() => setSvgLoading(false));
  }, [webglOk]);

  // Compute per-parish stats from analyticsCases.
  // All keys are normalised so "Saint Andrew" and "St. Andrew" merge into the same bucket.
  const parishStats = useMemo<Record<string, ParishStats>>(() => {
    const map: Record<string, ParishStats> = {};
    for (const c of analyticsCases) {
      const key = normalizeParish(c.parish);
      if (!map[key]) map[key] = { total: 0, violent: 0, property: 0, drugs: 0, other: 0 };
      const cat = categorise(c.offence);
      map[key].total += 1;
      map[key][cat]  += 1;
    }
    // Seed any parishes present in summary but absent from analyticsCases
    for (const s of summary) {
      const key = normalizeParish(s.name);
      if (!map[key]) {
        map[key] = { total: s.total_cases, violent: 0, property: 0, drugs: 0, other: s.total_cases };
      }
    }
    return map;
  }, [analyticsCases, summary]);

  const maxCount = useMemo(
    () => Math.max(1, ...Object.values(parishStats).map((s) => getCategoryCount(s, mapCategory))),
    [parishStats, mapCategory]
  );

  // Keys in parishStats are already normalised; use them directly for the rank map.
  const sortedParishes = useMemo(
    () =>
      Object.entries(parishStats)
        .sort((a, b) => getCategoryCount(b[1], mapCategory) - getCategoryCount(a[1], mapCategory))
        .map(([name]) => name),  // already normalised
    [parishStats, mapCategory]
  );

  const handleParishClick = useCallback(
    (parish: string) => {
      onParishClick(parish);
    },
    [onParishClick]
  );

  if (!webglOk) {
    return (
      <div className="space-y-4">
        <MapFallback2D summary={summary} />
        <ParishLeaderboard
          summary={summary}
          parishStats={parishStats}
          selectedParish={selectedParish}
          onSelect={onParishClick}
        />
        <TopOffences cases={analyticsCases} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Category toggle */}
      <div className="flex flex-wrap gap-2">
        {CAT_OPTIONS.map(({ id, label, Icon }) => {
          const active = mapCategory === id;
          return (
            <button
              key={id}
              onClick={() => setMapCategory(id)}
              className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all duration-200 ${
                active
                  ? CAT_ACTIVE_COLORS[id]
                  : "border-white/[0.08] text-white/70 hover:text-white/90 hover:border-white/20"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          );
        })}
      </div>

      {/* 3D Canvas */}
      {svgLoading ? (
        <>
          <CanvasSkeleton mobile={false} />
        </>
      ) : (
        <div className="relative rounded-2xl overflow-hidden border border-white/[0.06]">
          <div className="h-[350px] md:h-[450px]">
            <Canvas
              camera={{ position: [0, 2, 7], fov: 52 }}
              dpr={[1, 1.5]}
              gl={{ powerPreference: "high-performance", antialias: true }}
            >
              <MapScene
                shapeEntries={shapeEntries}
                parishStats={parishStats}
                sortedParishes={sortedParishes}
                category={mapCategory}
                selectedParish={selectedParish}
                onParishClick={handleParishClick}
              />
            </Canvas>
          </div>
          <p className="absolute bottom-2 right-3 text-[10px] text-white/15 pointer-events-none">
            Drag · Pinch to zoom
          </p>
        </div>
      )}

      {/* Legend */}
      {!svgLoading && <MapLegend category={mapCategory} maxCount={maxCount} />}

      {/* Parish Leaderboard */}
      <div>
        <h3 className="text-xs font-semibold text-white/60 uppercase tracking-widest mb-2">
          Parish Leaderboard
        </h3>
        <ParishLeaderboard
          summary={summary}
          parishStats={parishStats}
          selectedParish={selectedParish}
          onSelect={onParishClick}
        />
      </div>

      {/* Top Offences */}
      {analyticsCases.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-white/60 uppercase tracking-widest mb-2">
            Top 10 Offences
          </h3>
          <TopOffences cases={analyticsCases} />
        </div>
      )}
    </div>
  );
}
