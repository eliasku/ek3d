import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import {
  AddEquation,
  CustomBlending,
  DstAlphaFactor,
  DstColorFactor,
  MaxEquation,
  MinEquation,
  OneFactor,
  OneMinusDstAlphaFactor,
  OneMinusDstColorFactor,
  OneMinusSrcAlphaFactor,
  OneMinusSrcColorFactor,
  ReverseSubtractEquation,
  SrcAlphaFactor,
  SrcAlphaSaturateFactor,
  SrcColorFactor,
  SubtractEquation,
  ZeroFactor,
} from "ek3d/constants";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { Mesh } from "ek3d/objects/Mesh";
import { blendingScene, labelMaterial } from "./materials-blending-common";

const { scene, load, cleanup } = blendingScene(80, 700);
const dst = [
  { name: "Zero", constant: ZeroFactor },
  { name: "One", constant: OneFactor },
  { name: "SrcColor", constant: SrcColorFactor },
  { name: "OneMinusSrcColor", constant: OneMinusSrcColorFactor },
  { name: "SrcAlpha", constant: SrcAlphaFactor },
  { name: "OneMinusSrcAlpha", constant: OneMinusSrcAlphaFactor },
  { name: "DstAlpha", constant: DstAlphaFactor },
  { name: "OneMinusDstAlpha", constant: OneMinusDstAlphaFactor },
  { name: "DstColor", constant: DstColorFactor },
  { name: "OneMinusDstColor", constant: OneMinusDstColorFactor },
];
const src = [...dst, { name: "SrcAlphaSaturate", constant: SrcAlphaSaturateFactor }];
const imageGeometry = new PlaneGeometry(100, 100);
const labelGeometry = new PlaneGeometry(100, 25);
const texture = load("lensflare/lensflare0_alpha.png");
const materials: MeshBasicMaterial[] = [];
for (let i = 0; i < dst.length; i++) {
  for (let j = 0; j < src.length; j++) {
    const material = new MeshBasicMaterial({
      map: texture,
      transparent: true,
      blending: CustomBlending,
      blendSrc: src[j].constant,
      blendDst: dst[i].constant,
      blendEquation: AddEquation,
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
const params = { blendEquation: AddEquation };
const equations = {
  Add: AddEquation,
  Subtract: SubtractEquation,
  ReverseSubtract: ReverseSubtractEquation,
  Min: MinEquation,
  Max: MaxEquation,
};
const gui = new GUI({ width: 300 });
gui.add(params, "blendEquation", equations).onChange(() => {
  for (const material of materials) material.blendEquation = params.blendEquation;
});
gui.open();
cleanup(() => gui.destroy());
