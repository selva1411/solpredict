"use client";

import { useState, useEffect } from "react";

export interface DeviceCapability {
  webglSupported: boolean;
  lowEndDevice: boolean;
  prefersReducedMotion: boolean;
  prefersReducedTransparency: boolean;
  cpuCores: number;
}

export function useDeviceCapability(): DeviceCapability {
  const [caps, setCaps] = useState<DeviceCapability>({
    webglSupported: true,
    lowEndDevice: false,
    prefersReducedMotion: false,
    prefersReducedTransparency: false,
    cpuCores: navigator.hardwareConcurrency || 4,
  });

  useEffect(() => {
    const mqReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mqReducedTransparency = window.matchMedia("(prefers-reduced-transparency: reduce)");

    let webgl = true;
    try {
      const canvas = document.createElement("canvas");
      webgl = !!(
        window.WebGLRenderingContext &&
        (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
      );
    } catch {
      webgl = false;
    }

    const cpuCores = navigator.hardwareConcurrency || 4;
    const lowEnd = !webgl || cpuCores <= 2 || /Android|iPhone|iPod|iPad/.test(navigator.userAgent);

    const update = () => {
      setCaps({
        webglSupported: webgl,
        lowEndDevice: lowEnd,
        prefersReducedMotion: mqReducedMotion.matches,
        prefersReducedTransparency: mqReducedTransparency.matches,
        cpuCores,
      });
    };

    update();

    mqReducedMotion.addEventListener("change", update);
    mqReducedTransparency.addEventListener("change", update);

    return () => {
      mqReducedMotion.removeEventListener("change", update);
      mqReducedTransparency.removeEventListener("change", update);
    };
  }, []);

  return caps;
}
