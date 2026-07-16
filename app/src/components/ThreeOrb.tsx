"use client";

import React, { Suspense, useRef, useState, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, MeshDistortMaterial } from "@react-three/drei";
import * as THREE from "three";

interface DynamicOrbProps {
  yesProbability: number;
}

function DynamicOrb({ yesProbability }: DynamicOrbProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  // Map probability to color:
  // YES (>50%) = green (#a1d494)
  // NO (<50%) = red (#ffb4ab)
  // 50% = gold (#ffd89c)
  const getColor = (prob: number) => {
    if (prob > 50) {
      const ratio = (prob - 50) / 50;
      return new THREE.Color("#ffd89c").lerp(new THREE.Color("#a1d494"), ratio);
    } else {
      const ratio = (50 - prob) / 50;
      return new THREE.Color("#ffd89c").lerp(new THREE.Color("#ffb4ab"), ratio);
    }
  };

  const color = getColor(yesProbability);

  // Distort factor and pulse speed increase with probability extremity (e.g. 95% or 5%)
  const extremeness = Math.abs(yesProbability - 50) / 50;
  const speed = 1.8 + extremeness * 3.5;
  const distort = 0.18 + extremeness * 0.22;

  useFrame(({ clock }) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = clock.getElapsedTime() * 0.35;
      meshRef.current.rotation.x = Math.sin(clock.getElapsedTime() * 0.5) * 0.15;
    }
  });

  return (
    <Float speed={1.5} rotationIntensity={0.35} floatIntensity={1.0}>
      <mesh ref={meshRef}>
        <icosahedronGeometry args={[1.1, 2]} />
        <MeshDistortMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.2}
          roughness={0.3}
          metalness={0.8}
          distort={distort}
          speed={speed}
        />
      </mesh>
    </Float>
  );
}

export function ThreeOrb({ yesProbability }: { yesProbability: number }) {
  const [webglSupported, setWebglSupported] = useState<boolean>(true);

  useEffect(() => {
    try {
      const canvas = document.createElement("canvas");
      const support = !!(
        window.WebGLRenderingContext &&
        (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
      );
      setWebglSupported(support);
    } catch (e) {
      setWebglSupported(false);
    }
  }, []);

  const getCssColor = (prob: number) => {
    if (prob > 50) {
      return "#a1d494";
    } else if (prob < 50) {
      return "#ffb4ab";
    }
    return "#ffd89c";
  };

  const cssColor = getCssColor(yesProbability);

  return (
    <div className="w-full h-44 relative rounded bg-[#0d0d0d] border border-[#9e8e78]/30 overflow-hidden flex items-center justify-center select-none shadow-[inset_0_0_20px_rgba(0,0,0,0.8)]">
      <div className="absolute inset-0 z-0 flex items-center justify-center">
        {webglSupported ? (
          <Canvas camera={{ position: [0, 0, 2.8], fov: 45 }}>
            <ambientLight intensity={0.6} />
            <pointLight position={[3, 3, 3]} intensity={2.0} color="#ffd89c" />
            <pointLight position={[-3, -3, 2]} intensity={1.0} color="#9e8e78" />
            <Suspense fallback={null}>
              <DynamicOrb yesProbability={yesProbability} />
            </Suspense>
          </Canvas>
        ) : (
          <div className="relative w-20 h-20 rounded-full flex items-center justify-center">
            <div 
              style={{
                backgroundColor: cssColor,
                boxShadow: `0 0 40px 10px ${cssColor}`,
              }}
              className="w-14 h-14 rounded-full opacity-80 animate-pulse transition-all duration-500"
            />
          </div>
        )}
      </div>
      <div className="absolute bottom-2 right-3 font-mono text-[9px] uppercase tracking-widest text-[#d6c4ac] z-10 bg-[#0d0d0d]/80 px-2 py-0.5 rounded border border-[#9e8e78]/30 font-bold">
        {webglSupported ? "Live 3D Probability Orb" : "Live Probability Indicator"}
      </div>
    </div>
  );
}
