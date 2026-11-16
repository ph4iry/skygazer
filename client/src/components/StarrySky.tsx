import { useEffect, useRef } from 'react';

interface StarrySkyProps {
  // the sky to show, 1 (pristine) to 8 ("8-9", inner city); fractional values blend between levels
  bortle: number;
}

interface Star {
  x: number; // 0..1 of the viewport width
  y: number; // 0..1 of the viewport height
  brightness: number; // 0 (faintest) .. 1 (brightest)
  phase: number;
  speed: number;
}

// faintest brightness still visible at each bortle class: light pollution washes out faint stars first
const LIMITS: Record<number, number> = { 1: 0, 2: 0.07, 3: 0.16, 4: 0.28, 5: 0.42, 6: 0.56, 7: 0.7, 8: 0.84 };
const STARS_PER_PIXEL = 1 / 1600;
// a diagonal band of extra faint stars that stands in for the milky way in dark skies
const BAND_SHARE = 0.35;
// how quickly the sky eases toward a new bortle level, per second
const EASE_RATE = 1.4;
// darker than this bortle level, the page's purple gradient deepens toward a near-black night;
// at this level and brighter (including the landing sky) it's left as is
const DARKEN_FROM_BORTLE = 3;
const MAX_DARKEN = 0.72;

function limitFor(bortle: number) {
  const b = Math.min(Math.max(bortle, 1), 8);
  const low = Math.floor(b);
  const high = Math.ceil(b);
  return LIMITS[low] + (LIMITS[high] - LIMITS[low]) * (b - low);
}

function makeStars(count: number): Star[] {
  return Array.from({ length: count }, () => {
    const inBand = Math.random() < BAND_SHARE;
    let x = Math.random();
    let y = Math.random();
    if (inBand) {
      // scatter around the line from the bottom-left to the top-right corner
      const t = Math.random();
      const spread = (Math.random() + Math.random() + Math.random() - 1.5) * 0.12;
      x = t + spread;
      y = 1 - t + spread;
    }
    return {
      x,
      y,
      // most stars are faint, a few are bright; the band is all faint stars
      brightness: inBand ? Math.random() ** 4 * 0.35 : Math.random() ** 3,
      phase: Math.random() * Math.PI * 2,
      speed: 0.5 + Math.random() * 1.5,
    };
  });
}

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
  return t * t * (3 - 2 * t);
}

// a fixed canvas of stars behind the page whose visibility follows a bortle level
export default function StarrySky({ bortle }: StarrySkyProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const targetRef = useRef(bortle);

  useEffect(() => {
    targetRef.current = bortle;
  }, [bortle]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let stars: Star[] = [];
    let width = 0;
    let height = 0;

    const resize = () => {
      const ratio = window.devicePixelRatio || 1;
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      stars = makeStars(Math.round(width * height * STARS_PER_PIXEL));
    };
    resize();
    window.addEventListener('resize', resize);

    let current = targetRef.current;
    let last = performance.now();
    let frame = 0;

    const draw = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      current += (targetRef.current - current) * (1 - Math.exp(-EASE_RATE * dt));
      if (reduceMotion) current = targetRef.current;

      const limit = limitFor(current);
      context.clearRect(0, 0, width, height);

      // a darker sky also darkens the page's gradient behind the stars
      const darken = Math.min(Math.max((DARKEN_FROM_BORTLE - current) / (DARKEN_FROM_BORTLE - 1), 0), 1) * MAX_DARKEN;
      if (darken > 0.005) {
        context.fillStyle = `rgba(2, 3, 12, ${darken})`;
        context.fillRect(0, 0, width, height);
      }

      // the warm glow of city lights over the horizon grows with the bortle level
      const glow = smoothstep(2, 8, current) * 0.22;
      if (glow > 0.005) {
        const gradient = context.createLinearGradient(0, height, 0, height * 0.35);
        gradient.addColorStop(0, `rgba(233, 201, 137, ${glow})`);
        gradient.addColorStop(1, 'rgba(233, 201, 137, 0)');
        context.fillStyle = gradient;
        context.fillRect(0, 0, width, height);
      }

      const time = now / 1000;
      for (const star of stars) {
        // stars just under the limit fade out instead of popping
        const visible = smoothstep(limit - 0.06, limit + 0.06, star.brightness);
        if (visible <= 0) continue;
        const twinkle = reduceMotion ? 1 : 0.8 + 0.2 * Math.sin(time * star.speed + star.phase);
        const alpha = (0.3 + 0.7 * star.brightness) * visible * twinkle;
        const radius = 0.4 + star.brightness * 1.3;
        context.globalAlpha = alpha;
        context.fillStyle = '#fff';
        context.beginPath();
        context.arc(star.x * width, star.y * height, radius, 0, Math.PI * 2);
        context.fill();
      }
      context.globalAlpha = 1;
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
    };
  }, []);

  // z-index -1 paints it over the page background but under everything else on the page
  return <canvas ref={canvasRef} aria-hidden className="pointer-events-none fixed inset-0 -z-[1] h-full w-full" />;
}
