"use client";

import { useEffect, useRef } from "react";

/**
 * An interactive dotted globe you can spin with the mouse/finger. Renders a
 * fibonacci-sphere of faint dots plus glowing markers at real cities, rotating
 * on its own and draggable with inertia. Pure canvas — no libraries, no assets,
 * self-contained. Skips the animation loop under prefers-reduced-motion.
 */

type City = { name: string; lat: number; lng: number };

const CITIES: City[] = [
  { name: "Nairobi", lat: -1.29, lng: 36.82 },
  { name: "Lagos", lat: 6.52, lng: 3.38 },
  { name: "Johannesburg", lat: -26.2, lng: 28.05 },
  { name: "Accra", lat: 5.6, lng: -0.19 },
  { name: "Cairo", lat: 30.04, lng: 31.24 },
  { name: "London", lat: 51.51, lng: -0.13 },
  { name: "Dubai", lat: 25.2, lng: 55.27 },
  { name: "Mumbai", lat: 19.08, lng: 72.88 },
  { name: "Singapore", lat: 1.35, lng: 103.82 },
  { name: "New York", lat: 40.71, lng: -74.01 },
  { name: "São Paulo", lat: -23.55, lng: -46.63 },
  { name: "Sydney", lat: -33.87, lng: 151.21 },
];

function spherePoint(lat: number, lng: number): [number, number, number] {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return [-Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta)];
}

/**
 * Coarse land map as [latMin, latMax, lngMin, lngMax] boxes — enough to render
 * recognisable continents as dots (not a uniform sphere), with no map assets.
 */
const LAND: [number, number, number, number][] = [
  // North America
  [48, 72, -168, -95], [40, 60, -140, -60], [30, 49, -123, -68], [23, 33, -110, -82], [15, 23, -105, -88],
  // Central America
  [8, 17, -92, -77],
  // South America
  [2, 13, -79, -60], [-15, 3, -79, -35], [-33, -15, -73, -40], [-55, -33, -75, -53],
  // Greenland / Iceland
  [60, 82, -50, -18], [63, 66, -24, -13],
  // Europe
  [40, 60, -9, 28], [54, 71, 5, 45], [36, 45, -9, 4], [50, 59, -8, 2],
  // Africa
  [15, 37, -17, 25], [0, 20, -17, 45], [-15, 5, 10, 42], [-35, -15, 12, 40], [-26, -12, 43, 50],
  // Middle East
  [12, 42, 34, 60],
  // North & Central Asia
  [48, 75, 45, 180], [40, 55, 45, 90], [30, 48, 48, 88],
  // India
  [7, 31, 68, 89],
  // East Asia
  [22, 45, 98, 135], [30, 42, 118, 129], [31, 45, 129, 146],
  // Southeast Asia
  [-11, 23, 95, 110], [-10, 7, 105, 120], [-10, -2, 120, 141], [5, 19, 120, 127],
  // Australia / NZ
  [-39, -11, 113, 154], [-47, -34, 166, 179],
];

function isLand(lat: number, lng: number): boolean {
  for (const [a, b, c, d] of LAND) if (lat >= a && lat <= b && lng >= c && lng <= d) return true;
  return false;
}

export function WorldGlobe() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    // Land dots — a lat/lng grid filtered to the land map, so continents show.
    const dots: [number, number, number][] = [];
    for (let lat = -84; lat <= 84; lat += 3.2) {
      for (let lng = -180; lng < 180; lng += 3.2) {
        if (isLand(lat, lng)) dots.push(spherePoint(lat, lng));
      }
    }
    const cityPts = CITIES.map((c) => ({ c, p: spherePoint(c.lat, c.lng) }));

    let yaw = -0.4;
    let vel = 0.0016; // idle spin
    const tilt = -0.42;
    let dragging = false;
    let lastX = 0;
    let raf = 0;
    let size = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const css = canvas.clientWidth;
      size = css;
      canvas.width = css * dpr;
      canvas.height = css * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const rot = (p: [number, number, number]) => {
      // yaw around Y, then fixed tilt around X
      const cy = Math.cos(yaw), sy = Math.sin(yaw);
      const x1 = p[0] * cy - p[2] * sy;
      const z1 = p[0] * sy + p[2] * cy;
      const cx = Math.cos(tilt), sx = Math.sin(tilt);
      const y2 = p[1] * cx - z1 * sx;
      const z2 = p[1] * sx + z1 * cx;
      return [x1, y2, z2] as [number, number, number];
    };

    const draw = () => {
      const R = size / 2;
      const cx = R;
      const cy = R;
      const rad = R * 0.92;
      ctx.clearRect(0, 0, size, size);

      // soft glow behind
      const g = ctx.createRadialGradient(cx, cy, rad * 0.2, cx, cy, rad * 1.15);
      g.addColorStop(0, "rgba(0,223,164,0.10)");
      g.addColorStop(1, "rgba(0,223,164,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, rad * 1.15, 0, Math.PI * 2);
      ctx.fill();

      // globe rim
      ctx.strokeStyle = "rgba(0,223,164,0.16)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.stroke();

      // land dots — brighter/mint on the near face, faint on the far face
      for (const d of dots) {
        const [x, y, z] = rot(d);
        const depth = (z + 1) / 2; // 0 back .. 1 front
        const px = cx + x * rad;
        const py = cy - y * rad;
        if (z < 0) {
          // far side: very faint so the near-side continents read clearly
          ctx.fillStyle = `rgba(120,140,165,${0.05 + depth * 0.12})`;
          ctx.beginPath();
          ctx.arc(px, py, 0.9, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = `rgba(120,220,190,${0.28 + depth * 0.5})`;
          ctx.beginPath();
          ctx.arc(px, py, 0.9 + depth * 1.0, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // anonymous "copier hub" markers (no place names — global by design)
      const now = performance.now();
      for (const { c, p } of cityPts) {
        const [x, y, z] = rot(p);
        const px = cx + x * rad;
        const py = cy - y * rad;
        if (z < -0.1) continue; // behind the globe
        const front = (z + 1) / 2;
        const pulse = 0.5 + 0.5 * Math.sin(now / 500 + c.lng);
        // halo
        ctx.fillStyle = `rgba(47,240,189,${0.12 * front})`;
        ctx.beginPath();
        ctx.arc(px, py, 5 + pulse * 4, 0, Math.PI * 2);
        ctx.fill();
        // core
        ctx.fillStyle = `rgba(47,240,189,${0.6 + 0.4 * front})`;
        ctx.beginPath();
        ctx.arc(px, py, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }

      if (!dragging) {
        yaw += vel;
        // ease idle velocity back toward the gentle default
        vel += (0.0016 - vel) * 0.02;
      }
      raf = requestAnimationFrame(draw);
    };

    if (reduce) {
      draw(); // one static frame
    } else {
      raf = requestAnimationFrame(draw);
    }

    // drag to spin
    const onDown = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      canvas.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      yaw += dx * 0.008;
      vel = dx * 0.0016; // fling → inertia
    };
    const onUp = (e: PointerEvent) => {
      dragging = false;
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
    };
  }, []);

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[440px]">
      <canvas
        ref={canvasRef}
        className="h-full w-full cursor-grab touch-none select-none active:cursor-grabbing"
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}
