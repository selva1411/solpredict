"use client";

import React, { Suspense, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, MeshDistortMaterial } from "@react-three/drei";
import * as THREE from "three";
import { motion } from "framer-motion";
import { Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";

function FloatingCore() {
  const ref = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.y = clock.getElapsedTime() * 0.35;
      ref.current.rotation.x = Math.sin(clock.getElapsedTime() * 0.5) * 0.15;
    }
  });

  return (
    <Float speed={2} rotationIntensity={0.4} floatIntensity={1.2}>
      <mesh ref={ref}>
        <icosahedronGeometry args={[1.1, 1]} />
        <MeshDistortMaterial
          color="#FFA500"
          emissive="#FFA500"
          emissiveIntensity={0.25}
          roughness={0.35}
          metalness={0.85}
          distort={0.22}
          speed={2.5}
        />
      </mesh>
    </Float>
  );
}

function OrbitRing() {
  const ref = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.z = clock.getElapsedTime() * 0.6;
  });

  return (
    <mesh ref={ref} rotation={[Math.PI / 2.5, 0, 0]}>
      <torusGeometry args={[1.65, 0.04, 12, 64]} />
      <meshStandardMaterial color="#2D3142" metalness={0.9} roughness={0.2} emissive="#FFA500" emissiveIntensity={0.08} />
    </mesh>
  );
}

function GateScene() {
  return (
    <>
      <ambientLight intensity={0.6} />
      <pointLight position={[4, 4, 4]} intensity={2.5} color="#FFA500" />
      <pointLight position={[-3, -2, 2]} intensity={1.2} color="#235A34" />
      <FloatingCore />
      <OrbitRing />
    </>
  );
}

interface ConnectWalletGateProps {
  title: string;
  description: string;
  icon?: LucideIcon;
}

export function ConnectWalletGate({
  title,
  description,
  icon: Icon = Wallet,
}: ConnectWalletGateProps) {
  return (
    <div className="flex-1 flex items-center justify-center py-12">
      <motion.div
        initial={{ opacity: 0, y: 24, rotateX: 8 }}
        animate={{ opacity: 1, y: 0, rotateX: 0 }}
        transition={{ duration: 0.55, ease: "easeOut" }}
        style={{ perspective: 1200 }}
        className="board-panel py-10 text-center space-y-6 max-w-xl mx-auto w-full px-6 bg-[#0C0D12] board-panel-3d"
      >
        <div className="relative h-44 w-full overflow-hidden rounded border border-[#2D3142]/60 bg-[#050608]">
          <Suspense
            fallback={
              <div className="w-full h-full flex items-center justify-center font-mono text-[#FFA500] text-xs animate-pulse">
                INITIALIZING TERMINAL...
              </div>
            }
          >
            <Canvas camera={{ position: [0, 0, 4.5], fov: 45 }} gl={{ antialias: true, alpha: true }}>
              <GateScene />
            </Canvas>
          </Suspense>
          <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[#050608] to-transparent pointer-events-none" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mx-auto w-14 h-14 bg-[#050608] border border-[#2D3142] rounded flex items-center justify-center text-[#FFA500] shadow-[0_0_20px_rgba(255,165,0,0.15)]"
        >
          <Icon className="w-7 h-7" />
        </motion.div>

        <div className="space-y-3">
          <h2 className="text-2xl font-bold font-display text-[#F4F4F9]">{title}</h2>
          <p className="text-[#808495] text-sm max-w-sm mx-auto leading-relaxed">{description}</p>
          <p className="text-[10px] font-mono uppercase tracking-widest text-[#FFA500]/70 pt-2">
            Connect wallet above — routing is automatic by authority role
          </p>
        </div>
      </motion.div>
    </div>
  );
}
