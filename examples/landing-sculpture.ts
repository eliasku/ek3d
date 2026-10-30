import { MarchingCubes } from "ek3d/addons/objects/MarchingCubes";
import type { Material } from "ek3d/materials/Material";

// Centres and strengths share one field, so touching spheres blend without seams.
const balls: ReadonlyArray<readonly [number, number, number, number]> = [
  [0.4, 0.42, 0.53, 1.45],
  [0.6, 0.58, 0.48, 1.1],
  [0.43, 0.76, 0.48, 0.8],
  [0.74, 0.35, 0.55, 0.65],
  [0.48, 0.2, 0.5, 0.55],
];

export function createLandingSculpture(material: Material): MarchingCubes {
  const surface = new MarchingCubes(80, material, false, false, 24000);
  updateLandingSculpture(surface, 0, 0);
  return surface;
}

/** Bounded motion keeps the entire isosurface inside the sampled volume. */
export function updateLandingSculpture(surface: MarchingCubes, seconds: number, energy: number): void {
  const phase = (seconds * Math.PI * 2) / 1.2;
  const heartbeat =
    (Math.pow(Math.max(0, Math.sin(phase)), 18) + 0.55 * Math.pow(Math.max(0, Math.sin(phase - 1)), 24)) * (1 - energy);
  surface.scale.set(2.8 * (1 - heartbeat * 0.035), 2.8 * (1 + heartbeat * 0.12), 2.8 * (1 + heartbeat * 0.025));
  surface.reset();
  const spread = 0.55 + energy * 0.67;
  const motion = 0.012 + energy * 0.016;
  for (let i = 0; i < balls.length; i++) {
    const [x, y, z, strength] = balls[i];
    const phase = i * 2.4;
    surface.addBall(
      0.5 + (x - 0.5) * spread + Math.sin(seconds * 0.8 + phase) * motion,
      0.5 + (y - 0.5) * spread + Math.sin(seconds * 0.65 + phase * 1.3) * motion,
      0.5 + (z - 0.5) * spread + Math.sin(seconds * 0.7 + phase) * motion,
      strength,
      18,
    );
  }
  surface.update();
}
