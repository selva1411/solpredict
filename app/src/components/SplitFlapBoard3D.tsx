"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";

// Individual modeled Split-Flap Tile in 3D
interface FlapTile3DProps {
  char: string;
  position: [number, number, number];
}

function FlapTile3D({ char, position }: FlapTile3DProps) {
  const [isReducedMotion] = useState(() => {
    if (typeof window !== "undefined") {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }
    return false;
  });

  const [currentChar, setCurrentChar] = useState(char);
  const [prevChar, setPrevChar] = useState(char);
  const [prevProp, setPrevProp] = useState(char);
  const [flipAnim, setFlipAnim] = useState(Math.PI);

  // Derive state from char changes during render phase
  if (char !== prevProp) {
    setPrevProp(char);
    setPrevChar(currentChar);
    setCurrentChar(char);
    if (isReducedMotion) {
      setFlipAnim(Math.PI);
    } else {
      setFlipAnim(0);
    }
  }

  // Animate the rotating flap card
  useFrame((_, delta) => {
    if (flipAnim < Math.PI) {
      setFlipAnim((prev) => Math.min(prev + delta * 12, Math.PI));
    }
  });

  // Clipping planes for top and bottom card halves
  const topClipPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, -1, 0), 0), []);
  const bottomClipPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);

  return (
    <group position={position}>
      {/* 1. Backdrop plate / Card frame */}
      <mesh position={[0, 0, -0.05]}>
        <boxGeometry args={[0.75, 1.1, 0.05]} />
        <meshStandardMaterial color="#050608" roughness={0.9} metalness={0.1} />
      </mesh>

      {/* 2. Top Static Card (Shows top half of CURRENT character) */}
      <group>
        <mesh position={[0, 0, 0.005]}>
          <planeGeometry args={[0.72, 1.05]} />
          <meshStandardMaterial
            color="#111216"
            clippingPlanes={[topClipPlane]}
            roughness={0.8}
            metalness={0.1}
          />
        </mesh>
        <Text
          position={[0, 0, 0.01]}
          fontSize={0.85}
          anchorX="center"
          anchorY="middle"
        >
          <meshBasicMaterial attach="material" color="#FFA500" clippingPlanes={[topClipPlane]} />
          {currentChar}
        </Text>
      </group>

      {/* 3. Bottom Static Card (Shows bottom half of PREVIOUS character) */}
      <group>
        <mesh position={[0, 0, 0.002]}>
          <planeGeometry args={[0.72, 1.05]} />
          <meshStandardMaterial
            color="#0C0D10"
            clippingPlanes={[bottomClipPlane]}
            roughness={0.8}
            metalness={0.1}
          />
        </mesh>
        <Text
          position={[0, 0, 0.008]}
          fontSize={0.85}
          anchorX="center"
          anchorY="middle"
        >
          <meshBasicMaterial attach="material" color="#FFA500" clippingPlanes={[bottomClipPlane]} />
          {prevChar}
        </Text>
      </group>

      {/* 4. Flipping flap card rotating around Y = 0 */}
      {flipAnim < Math.PI && (
        <group rotation={[-flipAnim, 0, 0]}>
          {/* Front of the flap (falling down, shows top half of PREVIOUS character) */}
          {flipAnim < Math.PI / 2 ? (
            <group>
              <mesh position={[0, 0, 0.015]}>
                <planeGeometry args={[0.72, 1.05]} />
                <meshStandardMaterial
                  color="#111216"
                  clippingPlanes={[topClipPlane]}
                  roughness={0.8}
                  metalness={0.1}
                  side={THREE.DoubleSide}
                />
              </mesh>
              <Text
                position={[0, 0, 0.02]}
                fontSize={0.85}
                anchorX="center"
                anchorY="middle"
              >
                <meshBasicMaterial attach="material" color="#FFA500" clippingPlanes={[topClipPlane]} />
                {prevChar}
              </Text>
            </group>
          ) : (
            /* Back of the flap (flipped over, shows bottom half of CURRENT character) */
            <group rotation={[Math.PI, 0, Math.PI]}>
              <mesh position={[0, 0, 0.015]}>
                <planeGeometry args={[0.72, 1.05]} />
                <meshStandardMaterial
                  color="#0C0D10"
                  clippingPlanes={[bottomClipPlane]}
                  roughness={0.8}
                  metalness={0.1}
                  side={THREE.DoubleSide}
                />
              </mesh>
              <Text
                position={[0, 0, 0.02]}
                fontSize={0.85}
                anchorX="center"
                anchorY="middle"
              >
                <meshBasicMaterial attach="material" color="#FFA500" clippingPlanes={[bottomClipPlane]} />
                {currentChar}
              </Text>
            </group>
          )}
        </group>
      )}

      {/* 5. Center Split Line Shadow */}
      <mesh position={[0, 0, 0.025]}>
        <planeGeometry args={[0.75, 0.025]} />
        <meshBasicMaterial color="#000000" />
      </mesh>
    </group>
  );
}

// 3D Split-Flap Board Canvas Scene
interface SceneProps {
  rows: string[];
}

function FlapBoardScene({ rows }: SceneProps) {
  const maxCols = 24;
  const rowCount = 3;

  // Render rows centered in 3D scene
  const gridOffsetZ = 0;
  const colSpacing = 0.82;
  const rowSpacing = 1.25;

  return (
    <>
      <ambientLight intensity={1.5} />
      <pointLight position={[5, 5, 5]} intensity={2.5} color="#FFA500" />
      <pointLight position={[-5, 5, 3]} intensity={1.2} color="#ffffff" />
      <directionalLight position={[0, 8, 4]} intensity={1.0} />

      <group position={[-(maxCols - 1) * colSpacing * 0.5, (rowCount - 1) * rowSpacing * 0.5, gridOffsetZ]}>
        {rows.map((rowText, rowIndex) => {
          // Format text row to match maxCols width
          const paddedText = rowText.toUpperCase().slice(0, maxCols).padEnd(maxCols, " ");
          const chars = paddedText.split("");

          return (
            <group key={rowIndex} position={[0, -rowIndex * rowSpacing, 0]}>
              {chars.map((char, colIndex) => (
                <FlapTile3D
                  key={`${rowIndex}-${colIndex}`}
                  char={char}
                  position={[colIndex * colSpacing, 0, 0]}
                />
              ))}
            </group>
          );
        })}
      </group>
    </>
  );
}

interface SplitFlapBoard3DProps {
  marketsList?: string[];
}

export default function SplitFlapBoard3D({ marketsList = [] }: SplitFlapBoard3DProps) {
  const defaultRows = [
    "PREDICT THE FUTURE     ",
    "SETTLE THE BOARD       ",
    "SOLPREDICT ACTIVE BOARD"
  ];

  const [activeRows, setActiveRows] = useState<string[]>(defaultRows);
  const [, setCycleIndex] = useState(0);

  // Cycle flight board rows with open market questions or fallbacks
  useEffect(() => {
    const validQuestions = marketsList.filter(q => q.trim().length > 0);
    if (validQuestions.length === 0) return;

    const timer = setInterval(() => {
      setCycleIndex((prev) => {
        const nextIdx = (prev + 1) % Math.ceil(validQuestions.length / 3);
        const start = nextIdx * 3;
        
        const q1 = validQuestions[start] || "PREDICT THE FUTURE     ";
        const q2 = validQuestions[start + 1] || "SETTLE THE BOARD       ";
        const q3 = validQuestions[start + 2] || "SOLPREDICT ACTIVE BOARD";

        setActiveRows([q1, q2, q3]);
        return nextIdx;
      });
    }, 5500);

    return () => clearInterval(timer);
  }, [marketsList]);

  return (
    <div className="w-full h-[320px] select-none relative bg-[#050608] border-b-2 border-t border-[#2D3142] overflow-hidden">
      {/* 3D Flight Board View */}
      <Suspense fallback={<div className="w-full h-full flex items-center justify-center font-mono text-[#FFA500]">WARPING TILE GRID...</div>}>
        <Canvas
          camera={{ position: [0, 0, 10.5], fov: 40 }}
          gl={{ alpha: false, antialias: true, localClippingEnabled: true }}
          style={{ background: "#050608" }}
        >
          <FlapBoardScene rows={activeRows} />
        </Canvas>
      </Suspense>
    </div>
  );
}
