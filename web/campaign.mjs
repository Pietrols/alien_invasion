/** Authored 20-stage campaign. All velocities are world units per second. */
export const REGIONS = [
  { name: 'THE OUTER RIM', subtitle: 'Where the silence breaks.', color: [0.24, 0.88, 0.9], fog: [0.012, 0.025, 0.065], planet: [0.08, 0.25, 0.3] },
  { name: 'EMBER NEBULA', subtitle: 'Fly into the fire.', color: [1, 0.48, 0.28], fog: [0.055, 0.015, 0.03], planet: [0.42, 0.09, 0.035] },
  { name: 'THE GLASS EXPANSE', subtitle: 'Nothing here stays still.', color: [0.62, 0.52, 1], fog: [0.024, 0.013, 0.065], planet: [0.19, 0.09, 0.38] },
  { name: 'EVENT HORIZON', subtitle: 'The last light is yours.', color: [0.96, 0.76, 0.3], fog: [0.025, 0.02, 0.035], planet: [0.22, 0.16, 0.08] },
];
const TITLES = ['First contact', 'Broken formation', 'Crossfire', 'The vanguard', 'The Warden', 'Into the ember', 'Burning wings', 'Ashfall', 'Inferno fleet', 'The Harvester', 'Glass runners', 'Fracture line', 'Ghost fleet', 'Mirror storm', 'The Seraph', 'Beyond the light', 'Black tide', 'Singularity', 'Last stand', 'The World Eater'];
export const LEVELS = TITLES.map((title, i) => {
  const number = i + 1;
  return Object.freeze({ number, title, region: Math.floor(i / 5), boss: number % 5 === 0,
    waves: 2 + Math.floor(i / 6), count: 5 + Math.floor(i / 3),
    speed: 3 + i * 0.24, bulletSpeed: 6 + i * 0.22,
    fireInterval: Math.max(0.75, 2.8 - i * 0.085),
    spawnInterval: Math.max(0.34, 0.9 - i * 0.023),
    bossHP: 60 + number * 6, reward: 600 + number * 150 });
});
export function levelAt(number) {
  if (!Number.isInteger(number) || number < 1 || number > 20) throw new RangeError('Level must be 1–20');
  return LEVELS[number - 1];
}
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function createRng(seed = Date.now()) {
  let state = seed >>> 0;
  return () => { state = (Math.imul(1664525, state) + 1013904223) >>> 0; return state / 4294967296; };
}
