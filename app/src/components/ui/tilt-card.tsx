"use client";

import { useRef, type ReactNode, type MouseEvent } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

interface TiltCardProps {
  children: ReactNode;
  className?: string;
  /** Max tilt in degrees. */
  max?: number;
  /** Lift toward the viewer on hover (px). */
  lift?: number;
  onClick?: () => void;
}

/**
 * Perspective-tilt container — the card rotates in 3D toward the pointer
 * with spring physics. Pure CSS transforms driven by framer-motion; cheap,
 * GPU-composited, no WebGL.
 */
export function TiltCard({ children, className, max = 7, lift = 14, onClick }: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);

  const rotateX = useSpring(useTransform(py, [0, 1], [max, -max]), { stiffness: 220, damping: 22 });
  const rotateY = useSpring(useTransform(px, [0, 1], [-max, max]), { stiffness: 220, damping: 22 });
  const z = useSpring(lift, { stiffness: 260, damping: 24 });

  function handleMove(e: MouseEvent<HTMLDivElement>) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    px.set((e.clientX - rect.left) / rect.width);
    py.set((e.clientY - rect.top) / rect.height);
  }

  function handleLeave() {
    px.set(0.5);
    py.set(0.5);
    z.set(0);
  }

  function handleEnter() {
    z.set(lift);
  }

  return (
    <div style={{ perspective: 1000 }} className="holo-card-3d">
      <motion.div
        ref={ref}
        onMouseMove={handleMove}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        onClick={onClick}
        style={{ rotateX, rotateY, translateZ: z, transformStyle: "preserve-3d" }}
        className={className}
      >
        {children}
      </motion.div>
    </div>
  );
}
