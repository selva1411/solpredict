"use client";

import React, { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface OrbMeshProps {
  yesProb: number; // 0–100
}

function OrbMesh({ yesProb }: OrbMeshProps) {
  const groupRef = useRef<THREE.Group>(null!);
  const dividerRef = useRef<THREE.Mesh>(null!);

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.45;
      groupRef.current.rotation.x += delta * 0.1;
    }
  });

  const dividerY = (yesProb / 100) * 2 - 1; // Map 0-100 to -1..1
  // Calculate angle for divider placement
  const theta = Math.acos(dividerY);

  return (
    <group ref={groupRef}>
      {/* YES hemisphere (neon cyan/green) — top to divider */}
      <mesh>
        <sphereGeometry args={[1, 64, 64, 0, Math.PI * 2, 0, theta]} />
        <meshStandardMaterial
          color="#0DF5E3"
          emissive="#0DF5E3"
          emissiveIntensity={0.25}
          roughness={0.1}
          metalness={0.9}
          transparent
          opacity={0.9}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* NO hemisphere (coral red) — divider to bottom */}
      <mesh>
        <sphereGeometry args={[1, 64, 64, 0, Math.PI * 2, theta, Math.PI - theta]} />
        <meshStandardMaterial
          color="#FF4D6D"
          emissive="#FF4D6D"
          emissiveIntensity={0.25}
          roughness={0.1}
          metalness={0.9}
          transparent
          opacity={0.9}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Glowing divider ring */}
      <mesh ref={dividerRef} position={[0, Math.cos(theta), 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[Math.sin(theta) + 0.01, 0.03, 16, 100]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>

      {/* Glossy outer ring accent */}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[1.08, 0.015, 8, 64]} />
        <meshStandardMaterial color="#8B5CF6" roughness={0.1} metalness={0.9} />
      </mesh>
    </group>
  );
}

function OrbScene({ yesProb }: OrbMeshProps) {
  return (
    <>
      <ambientLight intensity={0.4} />
      <pointLight position={[3, 3, 3]} intensity={1.2} color="#0DF5E3" />
      <pointLight position={[-3, -3, -3]} intensity={0.8} color="#8B5CF6" />
      <directionalLight position={[0, 5, 2]} intensity={1.0} color="#ffffff" />
      <OrbMesh yesProb={yesProb} />
    </>
  );
}

interface ProbabilityOrb3DProps {
  yesProb: number;
  size?: number; // px
}

export default function ProbabilityOrb3D({ yesProb, size = 128 }: ProbabilityOrb3DProps) {
  return (
    <div style={{ width: size, height: size }} className="flex-shrink-0">
      <Canvas
        camera={{ position: [0, 0, 2.8], fov: 45 }}
        style={{ background: "transparent" }}
        gl={{ alpha: true, antialias: true }}
        dpr={[1, 1.5]}
      >
        <OrbScene yesProb={yesProb} />
      </Canvas>
    </div>
  );
}
