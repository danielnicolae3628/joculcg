// Small math/helper utilities shared across the game.

export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export function dist(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

export function rand(min, max) {
  return min + Math.random() * (max - min);
}

export function randInt(min, max) {
  return Math.floor(rand(min, max + 1));
}

export function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function normalizeAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

// Deterministic pseudo-random value in [0,1) from integer coordinates.
export function hash2(x, y) {
  const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function rectCorners(cx, cy, halfL, halfW, angle) {
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const pts = [[halfL, halfW], [halfL, -halfW], [-halfL, halfW], [-halfL, -halfW]];
  return pts.map(([lx, ly]) => ({
    x: cx + lx * cos - ly * sin,
    y: cy + lx * sin + ly * cos,
  }));
}
