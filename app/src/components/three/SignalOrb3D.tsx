"use client";

import { useRef, useMemo, useEffect, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import * as THREE from "three";

interface CoreProps {
  /** YES probability in [0,1]. */
  yesProbability: number;
}

/**
 * The probability core — an inner breathing mass whose turbulence and hue
 * encode conviction (emerald = YES leaning, rose = NO leaning, cyan = dead
 * heat), caged by a slowly counter-rotating geodesic wire.
 */
function ProbabilityCore({ yesProbability }: CoreProps) {
  const innerRef = useRef<THREE.Mesh>(null);
  const cageRef = useRef<THREE.LineSegments>(null);
  const ringRef = useRef<THREE.Points>(null);
  const { gl } = useThree();

  const lean = useMemo(() => Math.max(0, Math.min(1, yesProbability)), [yesProbability]);
  const color = useMemo(() => {
    // Resolve design tokens (gold / verdigris / bordeaux) from globals.css :root.
    const resolveToken = (name: string): string => {
      if (typeof document === "undefined") return "rgb(0 0 0 / 0)";
      return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    };
    const cyan = new THREE.Color(resolveToken("--color-gold"));
    const yes = new THREE.Color(resolveToken("--color-verdigris"));
    const no = new THREE.Color(resolveToken("--color-bordeaux"));
    if (lean >= 0.5) return cyan.clone().lerp(yes, (lean - 0.5) * 2);
    return cyan.clone().lerp(no, (0.5 - lean) * 2);
  }, [lean]);

  const conviction = useMemo(() => Math.abs(lean - 0.5) * 2, [lean]);

  const ringPositions = useMemo(() => {
    const count = 220;
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const radius = 1.65 + Math.sin(i * 12.9898) * 0.06;
      arr[i * 3] = Math.cos(angle) * radius;
      arr[i * 3 + 1] = (Math.sin(i * 78.233) * 0.05);
      arr[i * 3 + 2] = Math.sin(angle) * radius * 0.35; // squashed orbital plane
    }
    return arr;
  }, []);

  const wireGeometry = useMemo(() => new THREE.IcosahedronGeometry(1.32, 1), []);

  // Handle WebGL context loss gracefully
  useEffect(() => {
    const handleContextLost = (e: Event) => {
      e.preventDefault();
      console.warn("[SignalOrb3D] WebGL context lost, attempting recovery...");
    };
    const handleContextRestored = () => {
      console.log("[SignalOrb3D] WebGL context restored");
    };
    gl.domElement.addEventListener("webglcontextlost", handleContextLost, false);
    gl.domElement.addEventListener("webglcontextrestored", handleContextRestored, false);
    return () => {
      gl.domElement.removeEventListener("webglcontextlost", handleContextLost);
      gl.domElement.removeEventListener("webglcontextrestored", handleContextRestored);
    };
  }, [gl]);

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();
    if (innerRef.current) {
      const s = 0.92 + Math.sin(t * (1.2 + conviction * 2.4)) * (0.045 + conviction * 0.05);
      innerRef.current.scale.setScalar(s);
      innerRef.current.rotation.y += delta * 0.25;
      innerRef.current.rotation.z += delta * 0.08;
    }
    if (cageRef.current) {
      cageRef.current.rotation.y -= delta * (0.14 + conviction * 0.22);
      cageRef.current.rotation.x = Math.sin(t * 0.24) * 0.28;
    }
    if (ringRef.current) {
      ringRef.current.rotation.y += delta * (0.3 + conviction * 0.5);
    }
  });

  return (
    <group>
      {/* breathing inner mass */}
      <mesh ref={innerRef}>
        <icosahedronGeometry args={[0.95, 3]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.55 + conviction * 0.6}
          roughness={0.25}
          metalness={0.1}
          transparent
          opacity={0.92}
        />
      </mesh>

      {/* geodesic cage */}
      <lineSegments ref={cageRef} geometry={wireGeometry}>
        <edgesGeometry args={[wireGeometry]} />
        <lineBasicMaterial color={color} transparent opacity={0.34} />
      </lineSegments>

      {/* orbital particle ring */}
      <points ref={ringRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[ringPositions, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.02} color={color} transparent opacity={0.8} sizeAttenuation />
      </points>

      <pointLight position={[2.4, 2, 2.4]} intensity={9} color={color} distance={9} />
    </group>
  );
}

interface SignalOrb3DProps {
  yesProbability: number;
  size?: number;
  className?: string;
}

/**
 * Client-only WebGL orb. Mount through a dynamic import (`ssr: false`) —
 * see `<SignalOrb>` wrapper below.
 */
export default function SignalOrb3D({ yesProbability, size = 260, className }: SignalOrb3DProps) {
  const [mounted, setMounted] = useState(false);
  const [contextLost, setContextLost] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted) {
    return (
      <div className={className} style={{ width: size, height: size }} aria-hidden>
        <div className="flex items-center justify-center w-full h-full">
          <div className="h-32 w-32 rounded-full border border-hairline bg-[radial-gradient(circle_at_35%_30%,rgba(34,211,238,.25),transparent_65%)] animate-pulse-slow" />
        </div>
      </div>
    );
  }

  return (
    <div className={className} style={{ width: size, height: size }} aria-hidden>
      <Canvas
        dpr={[1, 1.75]}
        camera={{ position: [0, 0.4, 4.2], fov: 42 }}
        gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}
        style={{ background: "transparent", width: "100%", height: "100%" }}
        onCreated={({ gl }) => {
          // Prevent context loss from killing the canvas permanently
          gl.domElement.addEventListener("webglcontextlost", (e) => {
            e.preventDefault();
            setContextLost(true);
            console.warn("[SignalOrb3D] WebGL context lost (onCreated), prevented default");
          }, false);
          gl.domElement.addEventListener("webglcontextrestored", () => {
            setContextLost(false);
            console.log("[SignalOrb3D] WebGL context restored (onCreated)");
          }, false);
        }}
      >
        <ambientLight intensity={0.35} />
        <Float speed={1.6} rotationIntensity={0.35} floatIntensity={0.7}>
          <ProbabilityCore yesProbability={yesProbability} />
        </Float>
      </Canvas>
      {contextLost && (
        <div className="absolute inset-0 flex items-center justify-center bg-void/80 z-10">
          <div className="text-center p-4">
            <div className="text-xs font-mono text-ash mb-2">WebGL context lost — click to retry</div>
            <button
              onClick={() => window.location.reload()}
              className="text-sm font-mono text-gold hover:text-gold-lite underline"
            >
              Reload Page
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
