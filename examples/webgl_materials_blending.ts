import { Blending } from "ek3d/constants";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { Mesh } from "ek3d/objects/Mesh";
import { blendingScene, labelMaterial } from "./materials-blending-common";

const { scene, load, cleanup } = blendingScene(70, 600);
const blendings = [
  { name: "No", constant: Blending.No },
  { name: "Normal", constant: Blending.Normal },
  { name: "Additive", constant: Blending.Additive },
  { name: "Subtractive", constant: Blending.Subtractive },
  { name: "Multiply", constant: Blending.Multiply },
];
const maps = [
  "uv_grid_opengl.jpg",
  "sprite0.jpg",
  "sprite0.png",
  "lensflare/lensflare0.png",
  "lensflare/lensflare0_alpha.png",
].map(load);
const imageGeometry = new PlaneGeometry(100, 100);
const labelGeometry = new PlaneGeometry(100, 25);
for (let row = 0; row < maps.length; row++) {
  const y = 300 - row * 150;
  for (let i = 0; i < blendings.length; i++) {
    const blending = blendings[i];
    const material = new MeshBasicMaterial({
      map: maps[row],
      transparent: true,
      blending: blending.constant,
      premultipliedAlpha: true,
    });
    const x = (i - blendings.length / 2) * 110;
    const image = new Mesh(imageGeometry, material);
    image.position.set(x, y, 0);
    scene.add(image);
    const label = new Mesh(labelGeometry, labelMaterial(blending.name, "rgba(0, 0, 0, 0.95)"));
    label.position.set(x, y - 75, 0);
    scene.add(label);
  }
}
cleanup();
