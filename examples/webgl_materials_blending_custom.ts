import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { Equation, Blending, Factor } from "ek3d/constants";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { Mesh } from "ek3d/objects/Mesh";
import { blendingScene, labelMaterial } from "./materials-blending-common";

const { scene, load, cleanup } = blendingScene(80, 700);
const dst = [
  { name: "Zero", constant: Factor.Zero },
  { name: "One", constant: Factor.One },
  { name: "SrcColor", constant: Factor.SrcColor },
  { name: "OneMinusSrcColor", constant: Factor.OneMinusSrcColor },
  { name: "SrcAlpha", constant: Factor.SrcAlpha },
  { name: "OneMinusSrcAlpha", constant: Factor.OneMinusSrcAlpha },
  { name: "DstAlpha", constant: Factor.DstAlpha },
  { name: "OneMinusDstAlpha", constant: Factor.OneMinusDstAlpha },
  { name: "DstColor", constant: Factor.DstColor },
  { name: "OneMinusDstColor", constant: Factor.OneMinusDstColor },
];
const src = [...dst, { name: "SrcAlphaSaturate", constant: Factor.SrcAlphaSaturate }];
const imageGeometry = new PlaneGeometry(100, 100);
const labelGeometry = new PlaneGeometry(100, 25);
const texture = load("lensflare/lensflare0_alpha.png");
const materials: MeshBasicMaterial[] = [];
for (let i = 0; i < dst.length; i++) {
  for (let j = 0; j < src.length; j++) {
    const material = new MeshBasicMaterial({
      map: texture,
      transparent: true,
      blending: Blending.Custom,
      blendSrc: src[j].constant,
      blendDst: dst[i].constant,
      blendEquation: Equation.Add,
    });
    const mesh = new Mesh(imageGeometry, material);
    mesh.position.set((j - src.length / 2) * 110, -((i - dst.length / 2) * 110 + 50), 0);
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    scene.add(mesh);
    materials.push(material);
  }
}
for (let j = 0; j < src.length; j++) {
  const mesh = new Mesh(labelGeometry, labelMaterial(src[j].name, "rgba(0, 150, 0, 1)", true));
  mesh.position.set((j - src.length / 2) * 110, -((-dst.length / 2) * 110 + 50 - 70), 0);
  mesh.matrixAutoUpdate = false;
  mesh.updateMatrix();
  scene.add(mesh);
}
for (let i = 0; i < dst.length; i++) {
  const mesh = new Mesh(labelGeometry, labelMaterial(dst[i].name, "rgba(150, 0, 0, 1)", true));
  mesh.position.set((-src.length / 2) * 110 - 125, -((i - dst.length / 2) * 110 + 165 - 120), 0);
  mesh.matrixAutoUpdate = false;
  mesh.updateMatrix();
  scene.add(mesh);
}
const params = { blendEquation: Equation.Add };
const equations = {
  Add: Equation.Add,
  Subtract: Equation.Subtract,
  ReverseSubtract: Equation.ReverseSubtract,
  Min: Equation.Min,
  Max: Equation.Max,
};
const gui = new GUI({ width: 300 });
gui.add(params, "blendEquation", equations).onChange(() => {
  for (const material of materials) material.blendEquation = params.blendEquation;
});
gui.open();
cleanup(() => gui.destroy());
