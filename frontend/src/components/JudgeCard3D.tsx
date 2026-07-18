"use client";

import { useRef, useState, Suspense, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Card } from "@/components/ui/card";
import { Judge } from "@/lib/types";
import { Scale, Building2 } from "lucide-react";
import * as THREE from "three";

/* ── 3D gavel model (handle + head + gold accent ring) ── */
function GavelModel({ speed }: { speed: number }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * speed;
    }
  });

  return (
    <group ref={groupRef} position={[0, 0.1, 0]}>
      {/* Handle */}
      <mesh rotation={[0, 0, Math.PI / 5]}>
        <cylinderGeometry args={[0.07, 0.1, 1.9, 24]} />
        <meshStandardMaterial color="#4a2810" roughness={0.45} metalness={0.1} />
      </mesh>

      {/* Head */}
      <mesh position={[0.52, 0.62, 0]} rotation={[0, 0, Math.PI / 5]}>
        <cylinderGeometry args={[0.21, 0.21, 0.52, 32]} />
        <meshStandardMaterial color="#2e1808" roughness={0.35} metalness={0.15} />
      </mesh>

      {/* Gold collar ring */}
      <mesh position={[0.33, 0.36, 0]} rotation={[Math.PI / 2 + Math.PI / 5, 0, 0]}>
        <torusGeometry args={[0.095, 0.022, 16, 48]} />
        <meshStandardMaterial
          color="#FED100"
          roughness={0.08}
          metalness={0.95}
          emissive="#FED100"
          emissiveIntensity={0.15}
        />
      </mesh>

      {/* Second gold ring */}
      <mesh position={[0.72, 0.88, 0]} rotation={[Math.PI / 2 + Math.PI / 5, 0, 0]}>
        <torusGeometry args={[0.095, 0.022, 16, 48]} />
        <meshStandardMaterial
          color="#FED100"
          roughness={0.08}
          metalness={0.95}
          emissive="#FED100"
          emissiveIntensity={0.15}
        />
      </mesh>
    </group>
  );
}

function Scene({ isHovered }: { isHovered: boolean }) {
  const speed = isHovered ? 2.8 : 0.65;

  return (
    <>
      <color attach="background" args={["#050510"]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[4, 5, 4]} intensity={1.1} color="#ffffff" />
      <pointLight position={[-4, -2, -3]} intensity={0.4} color="#1a0a00" />
      <pointLight
        position={[0, 2, 3]}
        intensity={isHovered ? 1.0 : 0.35}
        color="#009B3A"
      />
      <pointLight
        position={[2, -1, 2]}
        intensity={isHovered ? 0.5 : 0.1}
        color="#FED100"
      />
      <GavelModel speed={speed} />
      <OrbitControls enableZoom={false} enablePan={false} enableRotate={false} />
    </>
  );
}

/* ── Static fallback when WebGL is unavailable ── */
function StaticFallback() {
  return (
    <div className="h-[200px] w-full flex items-center justify-center bg-gradient-to-br from-[#06060f] to-[#0d1020]">
      <Scale className="h-16 w-16 text-[#009B3A]/25" />
    </div>
  );
}

/* ── Main export ── */
interface JudgeCard3DProps {
  judge: Judge;
  onClick?: () => void;
}

export default function JudgeCard3D({ judge, onClick }: JudgeCard3DProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [webglSupported, setWebglSupported] = useState(true);

  useEffect(() => {
    try {
      const canvas = document.createElement("canvas");
      const ctx =
        canvas.getContext("webgl") ||
        (canvas.getContext("experimental-webgl") as WebGLRenderingContext | null);
      if (!ctx) setWebglSupported(false);
    } catch {
      setWebglSupported(false);
    }
  }, []);

  return (
    <Card
      className="group relative bg-black/25 border-white/[0.07] overflow-hidden cursor-pointer transition-all duration-300 hover:border-[#009B3A]/40"
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Canvas area */}
      <div className="relative h-[200px] overflow-hidden bg-[#050510]">
        {/* Hover green wash */}
        <div
          className={`pointer-events-none absolute inset-0 z-10 transition-opacity duration-400 bg-gradient-to-b from-[#009B3A]/[0.06] to-transparent ${
            isHovered ? "opacity-100" : "opacity-0"
          }`}
        />

        {webglSupported ? (
          <Suspense fallback={<StaticFallback />}>
            <Canvas camera={{ position: [0, 0.5, 4], fov: 48 }} style={{ height: "200px" }}>
              <Scene isHovered={isHovered} />
            </Canvas>
          </Suspense>
        ) : (
          <StaticFallback />
        )}
      </div>

      {/* Info */}
      <div className="px-4 py-3.5 border-t border-white/[0.06]">
        <p className="text-[13px] font-semibold text-white/85 group-hover:text-white transition-colors leading-tight">
          {judge.name}
        </p>
        {judge.court && (
          <div className="flex items-center gap-1.5 mt-1.5">
            <Building2 className="h-3 w-3 text-[#009B3A]/60 shrink-0" />
            <span className="text-[11px] text-white/45 truncate">{judge.court}</span>
          </div>
        )}
      </div>

      {/* Animated bottom bar */}
      <div
        className={`absolute bottom-0 left-0 h-[1.5px] transition-all duration-500 ease-out bg-gradient-to-r from-[#009B3A] to-[#FED100] ${
          isHovered ? "w-full" : "w-0"
        }`}
      />
    </Card>
  );
}
