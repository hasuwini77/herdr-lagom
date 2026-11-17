// WCAG 2.2 contrast maths, and the dimming a wallpaper needs under a theme.
export const rgb = (h) => {
  h = String(h).replace("#", "");
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};
export const lum = (c) => {
  const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
export const mix = (top, under, a) => top.map((v, i) => v * a + under[i] * (1 - a));

// Every colour that carries text: panel text, status colours and terminal colours 1..15.
export const TEXT = ["foreground", "muted", "dim", "accent", "working", "blocked", "done",
  ...Array.from({ length: 15 }, (_, i) => `ansi${i + 1}`)];
// The surfaces a wallpaper shows through.
export const BASES = ["chrome", "background"];

// The weakest text contrast when `a` of each base colour covers the picture's worst spot.
export function weakest(colors, worst, a) {
  let low = Infinity;
  for (const base of BASES) {
    const under = mix(rgb(colors[base]), worst, a);
    for (const name of TEXT) if (colors[name]) low = Math.min(low, ratio(rgb(colors[name]), under));
  }
  return low;
}

// The least dimming (0..1) that reaches `target`, and what it gives.
// measure: { p01: [r,g,b], p99: [r,g,b] }, the picture's darkest and brightest 1%.
// Called on every render, so each text colour's luminance is worked out once and the answer is kept:
// a light theme over a dark picture walks nearly all 100 steps, and a render that slow is cut off.
let kept = { key: null, value: null };
export function dimming(colors, measure, target) {
  const key = JSON.stringify([colors, measure, target]);
  if (kept.key === key) return kept.value;
  const worst = lum(rgb(colors.background)) < 0.2 ? measure.p99 : measure.p01;
  const texts = TEXT.filter((n) => colors[n]).map((n) => lum(rgb(colors[n])));
  const bases = BASES.map((b) => rgb(colors[b]));
  const at = (a) => {
    let low = Infinity;
    for (const base of bases) {
      const under = lum(mix(base, worst, a));
      for (const t of texts) low = Math.min(low, (Math.max(t, under) + 0.05) / (Math.min(t, under) + 0.05));
    }
    return low;
  };
  let a = 0;
  while (a < 1 && at(a) < target) a = Math.round((a + 0.01) * 100) / 100;
  const got = at(a);
  kept = { key, value: { a, got, bare: at(0), reached: got >= target } };
  return kept.value;
}

export const alphaHex = (a) => Math.round(a * 255).toString(16).padStart(2, "0");
