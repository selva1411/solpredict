"use client";

import { Canvas } from "@react-three/fiber";
import { Icosahedron, Float } from "@react-three/drei";

export function Logo3D() {
  return (
    <Canvas camera={{ position: [0, 0, 3], fov: 50 }} style={{ width: 32, height: 32 }}>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 5, 5]} intensity={1} />
      <Float speed={2} rotationIntensity={1} floatIntensity={1}>
        <Icosahedron args={[1, 0]}>
          <meshStandardMaterial color="#7B3FE4" metalness={0.8} roughness={0.2} emissive="#FF3D9A" emissiveIntensity={0.3} />
        </Icosahedron>
      </Float>
    </Canvas>
  );
}
