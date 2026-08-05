'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { useRef, useMemo, Suspense, useState, useEffect } from 'react';
import * as THREE from 'three';
import { ParticleBackground } from './ParticleBackground';

interface ParticleFieldProps {
  count?: number;
  spread?: number;
}

function ParticleField({ count = 400, spread = 18 }: ParticleFieldProps) {
  const ref = useRef<THREE.Points>(null);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();

    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos((Math.random() * 2) - 1);
      const r = Math.cbrt(Math.random()) * spread;

      positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);

      const isCyan = Math.random() > 0.4;
      const color = new THREE.Color();
      if (isCyan) {
        color.setHSL(0.52 + Math.random() * 0.06, 0.9, 0.55 + Math.random() * 0.15);
      } else {
        color.setHSL(0.75 + Math.random() * 0.05, 0.85, 0.5 + Math.random() * 0.1);
      }
      colors[i * 3]     = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;

      sizes[i] = 0.5 + Math.random() * 2.0;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    return geo;
  }, [count, spread]);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.getElapsedTime();
    ref.current.rotation.x = t * 0.018;
    ref.current.rotation.y = t * 0.012;
    ref.current.rotation.z = t * 0.006;
  });

  return (
    <points ref={ref} geometry={geometry}>
      <pointsMaterial
        size={0.05}
        vertexColors
        transparent
        opacity={0.55}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

function SecondaryLayer() {
  const ref = useRef<THREE.Points>(null);
  const count = 100;

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      positions[i * 3]     = (Math.random() - 0.5) * 30;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 30;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 30;

      const color = new THREE.Color();
      color.setHSL(0.9 + Math.random() * 0.1, 0.7, 0.6);
      colors[i * 3]     = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    return geo;
  }, []);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.getElapsedTime();
    ref.current.rotation.x = -t * 0.008;
    ref.current.rotation.y = t * 0.005;
  });

  return (
    <points ref={ref} geometry={geometry}>
      <pointsMaterial
        size={0.08}
        vertexColors
        transparent
        opacity={0.3}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
  } catch {
    return false;
  }
}

interface ParticleBackground3DProps {
  className?: string;
}

export default function ParticleBackground3D({ className = '' }: ParticleBackground3DProps) {
  const [webglOk, setWebglOk] = useState(true);

  useEffect(() => {
    if (!supportsWebGL()) setWebglOk(false);
  }, []);

  // WebGL unavailable — fall back to the lightweight CSS/2D canvas background
  if (!webglOk) {
    return <ParticleBackground />;
  }

  return (
    <div className={`fixed inset-0 -z-10 pointer-events-none ${className}`}>
      <Canvas
        camera={{ position: [0, 0, 8], fov: 65, near: 0.1, far: 100 }}
        gl={{ antialias: false, alpha: true }}
        dpr={[1, 1.5]}
        onCreated={({ gl }) => {
          const context = gl.getContext() as unknown as EventTarget | null;
          const handleLost = (e: Event) => { e.preventDefault(); setWebglOk(false); };
          context?.addEventListener?.('webglcontextlost', handleLost, false);
        }}
      >
        <Suspense fallback={null}>
          <ParticleField count={400} spread={18} />
          <SecondaryLayer />
        </Suspense>
      </Canvas>
      {/* Vignette for depth */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at center, transparent 30%, #050507 85%)' }}
      />
    </div>
  );
}
