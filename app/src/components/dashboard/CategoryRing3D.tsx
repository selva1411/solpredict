"use client";

import React, { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";

const CATEGORY_COLORS: Record<string, string> = {
  Crypto: "#ffd89c",
  Sports: "#a1d494",
  Politics: "#ffb4ab",
  Tech: "#e5e2e1",
  Other: "#9e8e78",
};

interface Segment {
  name: string;
  value: number;
  percentage: number;
}

interface RingProps {
  segments: Segment[];
}

function CategoryRing({ segments }: RingProps) {
  const groupRef = useRef<THREE.Group>(null);
  const active = segments.filter((s) => s.percentage > 0);

  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = clock.getElapsedTime() * 0.25;
      groupRef.current.rotation.x = Math.sin(clock.getElapsedTime() * 0.3) * 0.12;
    }
  });

  const arcs = useMemo(() => {
    return active.reduce<Array<Segment & { startAngle: number; endAngle: number }>>((acc, seg) => {
      const start = acc.length > 0 ? acc[acc.length - 1].endAngle : 0;
      const end = start + (seg.percentage / 100) * Math.PI * 2;
      return [...acc, { ...seg, startAngle: start, endAngle: end }];
    }, []);
  }, [active]);

  if (active.length === 0) return null;

  return (
    <group ref={groupRef}>
      {arcs.map((seg, i) => {
        const mid = (seg.startAngle + seg.endAngle) / 2;
        const radius = 1.35;
        return (
          <group key={seg.name}>
            <mesh rotation={[Math.PI / 2, 0, seg.startAngle]}>
              <torusGeometry
                args={[radius, 0.14, 8, 32, Math.max(seg.endAngle - seg.startAngle, 0.05)]}
              />
              <meshStandardMaterial
                color={CATEGORY_COLORS[seg.name] ?? "#9e8e78"}
                emissive={CATEGORY_COLORS[seg.name] ?? "#9e8e78"}
                emissiveIntensity={0.2}
                metalness={0.7}
                roughness={0.25}
              />
            </mesh>
            <Text
              position={[Math.cos(mid) * 0.5, Math.sin(mid) * 0.5 + 0.1, 0.3]}
              fontSize={0.12}
              color="#e5e2e1"
              anchorX="center"
              anchorY="middle"
            >
              {seg.percentage}%
            </Text>
          </group>
        );
      })}

      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.85, 0.06, 8, 48]} />
        <meshStandardMaterial color="#0d0d0d" metalness={0.9} roughness={0.15} />
      </mesh>
    </group>
  );
}

interface CategoryRing3DProps {
  segments: Segment[];
  total: number;
}

export function CategoryRing3D({ segments, total }: CategoryRing3DProps) {
  if (total === 0) {
    return (
      <div className="py-12 text-center text-[#d6c4ac] text-xs font-mono">
        No active exposure detected.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative h-48 w-full rounded border border-[#9e8e78]/40 bg-[#0d0d0d] overflow-hidden">
        <Suspense fallback={<div className="w-full h-full animate-pulse bg-white/5" />}>
          <Canvas camera={{ position: [0, 2.2, 3.2], fov: 42 }} gl={{ antialias: true }}>
            <ambientLight intensity={0.8} />
            <pointLight position={[3, 4, 3]} intensity={2} color="#ffd89c" />
            <pointLight position={[-2, 1, 2]} intensity={1} color="#ffffff" />
            <CategoryRing segments={segments} />
          </Canvas>
        </Suspense>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center font-mono">
            <div className="text-[9px] uppercase tracking-widest text-[#d6c4ac] font-bold">Total</div>
            <div className="text-sm font-bold text-[#ffd89c]">{total.toFixed(2)} SOL</div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {segments
          .filter((s) => s.value > 0)
          .map((item) => (
            <div key={item.name} className="space-y-1.5 font-mono">
              <div className="flex justify-between text-xs text-[#d6c4ac]">
                <span className="text-[#e5e2e1] font-bold flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded"
                    style={{ backgroundColor: CATEGORY_COLORS[item.name] ?? "#9e8e78" }}
                  />
                  {item.name}
                </span>
                <span>
                  {item.value.toFixed(2)} SOL ({item.percentage}%)
                </span>
              </div>
              <div className="h-2.5 bg-[#0d0d0d] border border-[#9e8e78]/40 rounded overflow-hidden">
                <div
                  className="h-full transition-all duration-700 ease-out"
                  style={{
                    width: `${item.percentage}%`,
                    backgroundColor: CATEGORY_COLORS[item.name] ?? "#9e8e78",
                  }}
                />
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
