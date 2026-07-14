"use client";

import React, { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Points, PointMaterial } from "@react-three/drei";
import * as THREE from "three";

function CryptoCoin() {
  const coinRef = useRef<THREE.Group>(null!);
  const ring1Ref = useRef<THREE.Mesh>(null!);
  const ring2Ref = useRef<THREE.Mesh>(null!);

  useFrame((state, delta) => {
    const elapsed = state.clock.getElapsedTime();
    if (coinRef.current) {
      // Slow rotation on Y and X for the main coin
      coinRef.current.rotation.y += delta * 0.4;
      coinRef.current.rotation.x = Math.sin(elapsed * 0.5) * 0.15;
    }
    if (ring1Ref.current) {
      ring1Ref.current.rotation.x += delta * 0.2;
      ring1Ref.current.rotation.y += delta * 0.15;
    }
    if (ring2Ref.current) {
      ring2Ref.current.rotation.y -= delta * 0.25;
      ring2Ref.current.rotation.z += delta * 0.1;
    }
  });

  return (
    <group>
      {/* 3D Floating Coin Group */}
      <group ref={coinRef}>
        {/* Coin Body (Cylinder representing a thick gold/cyan token) */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[1.5, 1.5, 0.2, 64]} />
          <meshStandardMaterial
            color="#8B5CF6"
            roughness={0.1}
            metalness={0.9}
            emissive="#8B5CF6"
            emissiveIntensity={0.15}
          />
        </mesh>
        
        {/* Raised Inner Emblem / Detail */}
        <mesh position={[0, 0, 0.11]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[1.1, 1.1, 0.05, 32]} />
          <meshStandardMaterial
            color="#06B6D4"
            roughness={0.1}
            metalness={0.95}
            emissive="#06B6D4"
            emissiveIntensity={0.3}
          />
        </mesh>
        <mesh position={[0, 0, -0.11]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[1.1, 1.1, 0.05, 32]} />
          <meshStandardMaterial
            color="#06B6D4"
            roughness={0.1}
            metalness={0.95}
            emissive="#06B6D4"
            emissiveIntensity={0.3}
          />
        </mesh>

        {/* Diagonal "SOL" style stripe accent on coin face */}
        <mesh position={[0, 0, 0.14]}>
          <boxGeometry args={[0.8, 0.15, 0.04]} />
          <meshStandardMaterial color="#0DF5E3" emissive="#0DF5E3" emissiveIntensity={0.6} />
        </mesh>
        <mesh position={[0, 0, 0.14]} rotation={[0, 0, Math.PI / 4]}>
          <boxGeometry args={[0.8, 0.15, 0.04]} />
          <meshStandardMaterial color="#8B5CF6" emissive="#8B5CF6" emissiveIntensity={0.6} />
        </mesh>
      </group>

      {/* Orbital Ring 1 (Neon Cyan) */}
      <mesh ref={ring1Ref} rotation={[Math.PI / 4, Math.PI / 4, 0]}>
        <torusGeometry args={[2.5, 0.03, 16, 100]} />
        <meshBasicMaterial color="#06B6D4" transparent opacity={0.6} />
      </mesh>

      {/* Orbital Ring 2 (Neon Purple) */}
      <mesh ref={ring2Ref} rotation={[-Math.PI / 4, Math.PI / 3, 0]}>
        <torusGeometry args={[2.8, 0.02, 16, 100]} />
        <meshBasicMaterial color="#8B5CF6" transparent opacity={0.5} />
      </mesh>
    </group>
  );
}

function ParticleField() {
  const pointsRef = useRef<THREE.Points>(null!);

  const positions = useMemo(() => {
    const count = 750;
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      // Scatter inside a sphere
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = 4 + Math.random() * 8; // hollow sphere from radius 4 to 12
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      arr[i * 3 + 2] = r * Math.cos(phi);
    }
    return arr;
  }, []);

  useFrame((_, delta) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y += delta * 0.04;
      pointsRef.current.rotation.x += delta * 0.015;
    }
  });

  return (
    <Points ref={pointsRef} positions={positions} stride={3}>
      <PointMaterial
        transparent
        color="#0DF5E3"
        size={0.035}
        sizeAttenuation
        depthWrite={false}
        opacity={0.5}
      />
    </Points>
  );
}

function Scene() {
  return (
    <>
      <ambientLight intensity={0.2} />
      <pointLight position={[5, 5, 5]} intensity={1.5} color="#06B6D4" />
      <pointLight position={[-5, -5, -5]} intensity={1.0} color="#8B5CF6" />
      <directionalLight position={[0, 4, 8]} intensity={1.2} color="#ffffff" />

      <Float speed={1.5} rotationIntensity={0.3} floatIntensity={0.8}>
        <CryptoCoin />
      </Float>
      <ParticleField />
    </>
  );
}

export default function HeroScene() {
  return (
    <div className="canvas-container" style={{ height: "450px" }}>
      <Canvas
        camera={{ position: [0, 0, 7], fov: 45 }}
        style={{ background: "transparent" }}
        gl={{ alpha: true, antialias: true }}
        dpr={[1, 2]}
      >
        <Scene />
      </Canvas>
    </div>
  );
}
