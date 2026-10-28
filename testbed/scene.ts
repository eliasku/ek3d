import { Scene } from "ek3d/scenes/Scene";
import { Fog } from "ek3d/scenes/Fog";
import { FogExp2 } from "ek3d/scenes/FogExp2";
import { Uniform } from "ek3d/core/Uniform";
import { UniformsGroup } from "ek3d/core/UniformsGroup";
import { Object3D } from "ek3d/core/Object3D";
import { BufferGeometry } from "ek3d/core/BufferGeometry";
import { InterleavedBuffer } from "ek3d/core/InterleavedBuffer";
import { InterleavedBufferAttribute } from "ek3d/core/InterleavedBufferAttribute";
import { Vector3 } from "ek3d/math/Vector3";
import { Color } from "ek3d/math/Color";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { SphereGeometry } from "ek3d/geometries/SphereGeometry";
import { CylinderGeometry } from "ek3d/geometries/CylinderGeometry";
import { CapsuleGeometry } from "ek3d/geometries/CapsuleGeometry";
import { TubeGeometry } from "ek3d/geometries/TubeGeometry";
import { ExtrudeGeometry } from "ek3d/geometries/ExtrudeGeometry";
import { ShapeGeometry } from "ek3d/geometries/ShapeGeometry";
import { EdgesGeometry } from "ek3d/geometries/EdgesGeometry";
import { CatmullRomCurve3 } from "ek3d/extras/curves/CatmullRomCurve3";
import { Path } from "ek3d/extras/core/Path";
import { Shape } from "ek3d/extras/core/Shape";
import { Mesh } from "ek3d/objects/Mesh";
import { InstancedMesh } from "ek3d/objects/InstancedMesh";
import { BatchedMesh } from "ek3d/objects/BatchedMesh";
import { LOD } from "ek3d/objects/LOD";
import { Line } from "ek3d/objects/Line";
import { LineLoop } from "ek3d/objects/LineLoop";
import { LineSegments } from "ek3d/objects/LineSegments";
import { Points } from "ek3d/objects/Points";
import { Sprite } from "ek3d/objects/Sprite";
import { LineBasicMaterial } from "ek3d/materials/LineBasicMaterial";
import { LineDashedMaterial } from "ek3d/materials/LineDashedMaterial";
import { PointsMaterial } from "ek3d/materials/PointsMaterial";
import { SpriteMaterial } from "ek3d/materials/SpriteMaterial";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { MeshLambertMaterial } from "ek3d/materials/MeshLambertMaterial";
import { MeshPhongMaterial } from "ek3d/materials/MeshPhongMaterial";
import { MeshNormalMaterial } from "ek3d/materials/MeshNormalMaterial";
import { MeshMatcapMaterial } from "ek3d/materials/MeshMatcapMaterial";
import { MeshToonMaterial } from "ek3d/materials/MeshToonMaterial";
import { MeshStandardMaterial } from "ek3d/materials/MeshStandardMaterial";
import { MeshPhysicalMaterial } from "ek3d/materials/MeshPhysicalMaterial";
import { ShadowMaterial } from "ek3d/materials/ShadowMaterial";
import { ShaderMaterial } from "ek3d/materials/ShaderMaterial";
import { HemisphereLight } from "ek3d/lights/HemisphereLight";
import { AmbientLight } from "ek3d/lights/AmbientLight";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { PointLight } from "ek3d/lights/PointLight";
import { SpotLight } from "ek3d/lights/SpotLight";
import { LightProbe } from "ek3d/lights/LightProbe";
import { RectAreaLight } from "ek3d/lights/RectAreaLight";
import { DataTexture } from "ek3d/textures/DataTexture";
import {
  PixelFormat,
  TextureType,
  Wrapping,
  ColorSpace,
  TextureFilter,
  Mapping,
  BufferUsage,
  Side,
  GLSL,
} from "ek3d/constants";

export function createScene(resources: Array<{ dispose(): void }>) {
  const scene = new Scene();
  const fogs = [null, new Fog(0x8ca6b8, 5, 19), new FogExp2(0x8ca6b8, 0.075)];
  const stage = new Object3D();
  scene.add(stage);
  const pixels = new Uint8Array(128 * 64 * 4);
  const skyColors = [
    [240, 100, 55],
    [50, 150, 210],
    [65, 80, 160],
    [210, 170, 90],
  ];
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 128; x++) {
      const color = skyColors[Math.floor(x / 32)];
      const shade = ((x >> 3) + (y >> 3)) % 2 === 0 ? 1 : 0.5;
      const offset = (y * 128 + x) * 4;
      for (let channel = 0; channel < 3; channel++) pixels[offset + channel] = Math.round(color[channel] * shade);
      pixels[offset + 3] = 255;
    }
  }
  const environment = new DataTexture(pixels, 128, 64, PixelFormat.RGBA, TextureType.UnsignedByte);
  environment.colorSpace = ColorSpace.SRGB;
  environment.mapping = Mapping.EquirectangularReflection;
  environment.needsUpdate = true;
  scene.background = environment;
  scene.backgroundIntensity = 0.4;
  // A blurred equirectangular background exercises the renderer's PMREM conversion.
  scene.backgroundBlurriness = 0.35;
  const checker = new DataTexture(
    new Uint8Array([255, 190, 60, 255, 30, 80, 140, 255, 30, 80, 140, 255, 255, 190, 60, 255]),
    2,
    2,
    PixelFormat.RGBA,
    TextureType.UnsignedByte,
  );
  checker.colorSpace = ColorSpace.SRGB;
  checker.wrapS = checker.wrapT = Wrapping.Repeat;
  checker.repeat.set(3, 3);
  checker.needsUpdate = true;
  resources.push(environment, checker);

  const geometry = new BoxGeometry();
  const reflectedGeometry = new SphereGeometry(0.65, 32, 20);
  const texturedGeometry = new CylinderGeometry(0.55, 0.55, 1.1, 32, 2);
  const litGeometry = new CapsuleGeometry(0.38, 0.6, 6, 16, 2);
  const positions = litGeometry.getAttribute("position");
  const normals = litGeometry.getAttribute("normal");
  if (!positions || !normals || !("getX" in positions) || !("getX" in normals))
    throw new Error("Capsule geometry is missing CPU attributes");
  const packed = new InterleavedBuffer(new Int16Array(positions.count * 6), 6).setUsage(BufferUsage.DynamicDraw);
  const packedPositions = new InterleavedBufferAttribute(packed, 3, 0, true);
  const packedNormals = new InterleavedBufferAttribute(packed, 3, 3, true);
  for (let i = 0; i < positions.count; i++) {
    packedPositions.setXYZ(i, positions.getX(i), positions.getY(i), positions.getZ(i));
    packedNormals.setXYZ(i, normals.getX(i), normals.getY(i), normals.getZ(i));
  }
  litGeometry.setAttribute("position", packedPositions);
  litGeometry.setAttribute("normal", packedNormals);
  const floorMaterial = new MeshLambertMaterial({ color: 0xb8c4d0 });
  const litMaterial = new MeshLambertMaterial({ color: 0xff8844 });
  const texturedMaterial = new MeshBasicMaterial({ map: checker });
  const reflectedMaterial = new MeshBasicMaterial({ envMap: environment, reflectivity: 1 });
  const tint = new Uniform(new Vector3(0.3, 2, 4));
  const pulse = new Uniform(1);
  const beaconUniforms = new UniformsGroup().setName("Beacon").setUsage(BufferUsage.DynamicDraw).add(tint);
  const beaconMaterial = new ShaderMaterial({
    glslVersion: GLSL.GLSL3,
    uniforms: { pulse },
    uniformsGroups: [beaconUniforms],
    vertexShader: "void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `layout(std140) uniform Beacon { vec3 tint; };
uniform float pulse;
out vec4 fragColor;
void main() { fragColor = vec4(tint * pulse, 1.0); }`,
  });
  resources.push(beaconUniforms);
  resources.push(
    geometry,
    reflectedGeometry,
    texturedGeometry,
    litGeometry,
    floorMaterial,
    litMaterial,
    texturedMaterial,
    reflectedMaterial,
    beaconMaterial,
  );
  const floor = new Mesh(geometry, floorMaterial);
  floor.scale.set(9, 0.2, 7);
  floor.position.y = -0.1;
  floor.receiveShadow = true;
  scene.add(floor);
  const reflected = new Mesh(reflectedGeometry, reflectedMaterial);
  reflected.name = "Sphere";
  reflected.position.set(-2.2, 0.9, 0);
  const textured = new Mesh(texturedGeometry, texturedMaterial);
  textured.name = "Cylinder";
  textured.position.set(0, 0.9, 0);
  const lit = new Mesh(litGeometry, litMaterial);
  lit.name = "Capsule";
  lit.position.set(2.2, 0.9, 0);
  for (const mesh of [reflected, textured, lit]) {
    mesh.scale.set(1.3, 1.3, 1.3);
    mesh.rotation.set(0.1, 0.35, 0);
    mesh.castShadow = true;
    stage.add(mesh);
  }
  const primitives = [reflected, textured, lit];
  const matcapPixels = new Uint8Array(32 * 32 * 4);
  const normalPixels = new Uint8Array(32 * 32 * 4);
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const offset = (y * 32 + x) * 4;
      const highlight = Math.max(0, 1 - Math.hypot(x - 10, y - 23) / 23);
      matcapPixels[offset] = 35 + 210 * highlight;
      matcapPixels[offset + 1] = 50 + 155 * highlight;
      matcapPixels[offset + 2] = 100 + 100 * highlight;
      matcapPixels[offset + 3] = 255;
      normalPixels[offset] = 128 + 70 * Math.sin((x * Math.PI) / 4);
      normalPixels[offset + 1] = 128 + 70 * Math.cos((y * Math.PI) / 4);
      normalPixels[offset + 2] = 230;
      normalPixels[offset + 3] = 255;
    }
  }
  const matcap = new DataTexture(matcapPixels, 32, 32);
  matcap.colorSpace = ColorSpace.SRGB;
  matcap.needsUpdate = true;
  const normalMap = new DataTexture(normalPixels, 32, 32);
  normalMap.wrapS = normalMap.wrapT = Wrapping.Repeat;
  normalMap.needsUpdate = true;
  const gradientMap = new DataTexture(
    new Uint8Array([35, 35, 35, 255, 100, 100, 100, 255, 180, 180, 180, 255, 255, 255, 255, 255]),
    4,
    1,
  );
  gradientMap.minFilter = gradientMap.magFilter = TextureFilter.Nearest;
  gradientMap.needsUpdate = true;
  const phongMaterial = new MeshPhongMaterial({ color: 0xeea060, shininess: 80, map: checker });
  const normalMaterial = new MeshNormalMaterial({ normalMap });
  const matcapMaterial = new MeshMatcapMaterial({ matcap, normalMap });
  const toonMaterial = new MeshToonMaterial({ color: 0x44bb99, gradientMap, map: checker });
  const standardMaterial = new MeshStandardMaterial({
    color: 0xeeb76b,
    metalness: 0.8,
    roughness: 0.28,
    map: checker,
  });
  const physicalMaterial = new MeshPhysicalMaterial({
    color: 0xaaccff,
    metalness: 0.15,
    roughness: 0.2,
    clearcoat: 1,
    clearcoatRoughness: 0.12,
    iridescence: 0.7,
    iridescenceIOR: 1.3,
    map: checker,
  });
  const comparisonMaterials = [
    phongMaterial,
    normalMaterial,
    matcapMaterial,
    toonMaterial,
    standardMaterial,
    physicalMaterial,
  ];
  const comparisonNames = ["Phong", "Normal", "Matcap", "Toon", "Standard", "Physical", "Shadow"];
  const comparisonMeshes = comparisonMaterials.map((material, i) => {
    const mesh = new Mesh(reflectedGeometry, material);
    mesh.name = comparisonNames[i];
    mesh.position.set(((i % 3) - 1) * 2.2, 0.85, i < 3 ? -1.2 : 1.2);
    mesh.castShadow = mesh.receiveShadow = true;
    return mesh;
  });
  const shadowMaterial = new ShadowMaterial({ color: 0x18233e, opacity: 0.8 });
  const shadowReceiver = new Mesh(geometry, shadowMaterial);
  shadowReceiver.name = "Shadow";
  shadowReceiver.position.y = 0.02;
  shadowReceiver.scale.set(8, 0.02, 6);
  shadowReceiver.receiveShadow = true;
  const comparisonSet = [...comparisonMeshes, shadowReceiver];
  const materialPositionKeys = comparisonNames.map((_, i) => `material${i}`);
  resources.push(matcap, normalMap, gradientMap, ...comparisonMaterials, shadowMaterial);
  const instanceMaterial = new MeshLambertMaterial({ color: 0xffffff });
  const instances = new InstancedMesh(geometry, instanceMaterial, 3);
  instances.name = "Instances";
  instances.castShadow = true;
  instances.receiveShadow = true;
  instances.instanceMatrix.setUsage(BufferUsage.DynamicDraw);
  const instanceColors = [new Color(0x44bbff), new Color(0xff8844), new Color(0x88dd55)];
  const instanceHighlight = new Color(0xffffff);
  const instanceTransform = new Object3D();
  const instanceScreen = new Vector3();
  const instancePositionKeys = ["instance0", "instance1", "instance2"];
  for (let i = 0; i < instances.count; i++) instances.setColorAt(i, instanceColors[i]);
  instances.instanceColor!.setUsage(BufferUsage.DynamicDraw);
  instances.instanceColor!.needsUpdate = true;
  // InstancedMesh owns its GPU attributes, not the shared box geometry or material.
  resources.push(instanceMaterial, instances);
  const instancedSet = [instances];
  const batchGeometries = [reflectedGeometry, texturedGeometry];
  const batches = new BatchedMesh(
    2,
    batchGeometries.reduce((count, item) => count + item.getAttribute("position")!.count, 0),
    batchGeometries.reduce((count, item) => count + item.getIndex()!.count, 0),
    instanceMaterial,
  );
  batches.name = "BatchedMesh";
  batches.castShadow = true;
  batches.receiveShadow = true;
  const batchGeometryIds = batchGeometries.map((item) => batches.addGeometry(item));
  const batchIds: Array<number | null> = batchGeometryIds.map((id) => batches.addInstance(id));
  const batchPositionKeys = ["batch0", "batch1"];
  for (let i = 0; i < batchIds.length; i++) batches.setColorAt(batchIds[i]!, instanceColors[i]);
  const lod = new LOD();
  lod.name = "LOD";
  lod.position.set(2.2, 0.9, 0);
  lod.scale.set(1.3, 1.3, 1.3);
  const lodMaterials = [new MeshLambertMaterial({ color: 0xcc77ee }), new MeshLambertMaterial({ color: 0x88dd55 })];
  for (let i = 0; i < lodMaterials.length; i++) {
    const level = new Mesh(i === 0 ? reflectedGeometry : geometry, lodMaterials[i]);
    level.castShadow = true;
    level.receiveShadow = true;
    lod.addLevel(level, i * 12, 0.12);
  }
  const batchedSet = [batches, lod];
  // BatchedMesh owns the packed copies, not the source geometries or shared material.
  resources.push(...lodMaterials, batches);
  const curve = new CatmullRomCurve3([
    new Vector3(-0.55, -0.55, -0.25),
    new Vector3(-0.55, 0.4, 0.25),
    new Vector3(0, 0, 0),
    new Vector3(0.55, -0.4, -0.25),
    new Vector3(0.55, 0.55, 0.25),
  ]);
  const contour = new Shape();
  contour.moveTo(-0.65, -0.65);
  contour.lineTo(0.65, -0.65);
  contour.lineTo(0.65, 0.65);
  contour.lineTo(-0.65, 0.65);
  contour.closePath();
  const hole = new Path();
  hole.absarc(0, 0, 0.3, 0, Math.PI * 2, true);
  contour.holes.push(hole);
  const tubeGeometry = new TubeGeometry(curve, 64, 0.2, 12, false);
  const extrudeGeometry = new ExtrudeGeometry(contour, {
    depth: 0.3,
    steps: 1,
    bevelEnabled: true,
    bevelThickness: 0.06,
    bevelSize: 0.06,
    bevelSegments: 3,
    curveSegments: 24,
  });
  extrudeGeometry.translate(0, 0, -0.15);
  const shapeGeometry = new ShapeGeometry(contour, 24);
  const tubeMaterial = new MeshLambertMaterial({ color: 0x55ccee });
  const extrudeMaterial = new MeshLambertMaterial({ color: 0xffbb55 });
  const shapeMaterial = new MeshLambertMaterial({ color: 0xaa77ee, side: Side.Double });
  resources.push(tubeGeometry, extrudeGeometry, shapeGeometry, tubeMaterial, extrudeMaterial, shapeMaterial);
  const tube = new Mesh(tubeGeometry, tubeMaterial);
  tube.name = "Tube";
  const extrude = new Mesh(extrudeGeometry, extrudeMaterial);
  extrude.name = "Extrude";
  const shape = new Mesh(shapeGeometry, shapeMaterial);
  shape.name = "Shape";
  const curves = [tube, extrude, shape];
  for (let i = 0; i < curves.length; i++) {
    curves[i].position.copy(primitives[i].position);
    curves[i].scale.copy(primitives[i].scale);
    curves[i].rotation.copy(primitives[i].rotation);
    curves[i].castShadow = true;
  }
  const lineGeometry = new BufferGeometry().setFromPoints([
    new Vector3(-0.5, -0.4, 0),
    new Vector3(-0.2, 0.4, 0),
    new Vector3(0.2, -0.4, 0),
    new Vector3(0.5, 0.4, 0),
  ]);
  const loopGeometry = new BufferGeometry().setFromPoints([
    new Vector3(-0.5, -0.5, 0),
    new Vector3(0.5, -0.5, 0),
    new Vector3(0.5, 0.5, 0),
    new Vector3(-0.5, 0.5, 0),
  ]);
  const edgesGeometry = new EdgesGeometry(geometry);
  const pointPositions: Vector3[] = [];
  for (let y = -1; y <= 1; y++) {
    for (let x = -1; x <= 1; x++) pointPositions.push(new Vector3(x * 0.4, y * 0.4, 0));
  }
  const pointGeometry = new BufferGeometry().setFromPoints(pointPositions);
  const markerPixels = new Uint8Array(16 * 16 * 4);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const offset = (y * 16 + x) * 4;
      markerPixels.fill(255, offset, offset + 3);
      markerPixels[offset + 3] = Math.hypot(x - 7.5, y - 7.5) < 7 ? 255 : 0;
    }
  }
  const marker = new DataTexture(markerPixels, 16, 16);
  marker.needsUpdate = true;
  const lineMaterial = new LineBasicMaterial({ color: 0x55ccee });
  const loopMaterial = new LineDashedMaterial({ color: 0xffbb55, dashSize: 0.16, gapSize: 0.1 });
  const edgesMaterial = new LineBasicMaterial({ color: 0xaa77ee });
  const pointsMaterial = new PointsMaterial({
    color: 0x55ee99,
    size: 0.22,
    map: marker,
    transparent: true,
    depthWrite: false,
  });
  const spriteMaterial = new SpriteMaterial({
    color: 0xff6688,
    map: marker,
    transparent: true,
    opacity: 0.75,
    depthWrite: false,
  });
  const line = new Line(lineGeometry, lineMaterial);
  const loop = new LineLoop(loopGeometry, loopMaterial);
  loop.computeLineDistances();
  const edges = new LineSegments(edgesGeometry, edgesMaterial);
  const points = new Points(pointGeometry, pointsMaterial);
  const sprite = new Sprite(spriteMaterial);
  const objects = [line, loop, edges, points, sprite];
  const objectNames = ["Line", "LineLoop", "LineSegments", "Points", "Sprite"];
  for (let i = 0; i < objects.length; i++) {
    objects[i].name = objectNames[i];
    objects[i].position.set((i - 2) * 1.6, 0.9, 0);
  }
  resources.push(
    lineGeometry,
    loopGeometry,
    edgesGeometry,
    pointGeometry,
    sprite.geometry,
    marker,
    lineMaterial,
    loopMaterial,
    edgesMaterial,
    pointsMaterial,
    spriteMaterial,
  );
  const beacon = new Mesh(geometry, beaconMaterial);
  beacon.scale.set(0.3, 0.3, 0.3);
  beacon.position.set(0, 1.2, 0);
  lit.add(beacon);

  const hemisphere = new HemisphereLight(0x99ccff, 0x443322, 1.2);
  const ambient = new AmbientLight(0xffd8ad, 0.8);
  ambient.visible = false;
  const directional = new DirectionalLight(0xffffff, 3);
  const point = new PointLight(0xffddb0, 150);
  const spot = new SpotLight(0xffddb0, 220, 24, Math.PI / 5, 0.35);
  const cookie = new DataTexture(
    new Uint8Array([255, 80, 40, 255, 0, 0, 0, 255, 0, 0, 0, 255, 40, 120, 255, 255]),
    2,
    2,
    PixelFormat.RGBA,
    TextureType.UnsignedByte,
  );
  cookie.colorSpace = ColorSpace.SRGB;
  cookie.needsUpdate = true;
  directional.position.set(-3, 6, 3);
  point.position.copy(directional.position);
  spot.position.copy(directional.position);
  for (const light of [directional, point, spot]) {
    light.castShadow = true;
    light.shadow.mapSize.set(512, 512);
    light.shadow.bias = -0.001;
    light.shadow.camera.near = 0.1;
    light.shadow.camera.far = 30;
  }
  directional.shadow.camera.left = directional.shadow.camera.bottom = -6;
  directional.shadow.camera.right = directional.shadow.camera.top = 6;
  directional.shadow.camera.updateProjectionMatrix();
  scene.add(hemisphere, ambient, directional, spot.target);
  resources.push(hemisphere, ambient, directional, point, cookie, spot);
  const probe = new LightProbe();
  probe.sh.coefficients[0].set(0.7, 1.2, 2.2);
  probe.sh.coefficients[1].set(0.2, 0.4, 0.7);
  probe.intensity = 2;
  const area = new RectAreaLight(0xffa060, 12, 5, 4);
  area.position.set(0, 4, 3);
  area.lookAt(0, 0, 0);
  probe.visible = area.visible = false;
  scene.add(probe, area);
  resources.push(probe, area);
  return {
    scene,
    fogs,
    stage,
    environment,
    checker,
    litGeometry,
    positions,
    packed,
    packedPositions,
    litMaterial,
    texturedMaterial,
    reflectedMaterial,
    tint,
    pulse,
    floor,
    reflected,
    textured,
    lit,
    primitives,
    normalMap,
    gradientMap,
    phongMaterial,
    normalMaterial,
    matcapMaterial,
    toonMaterial,
    standardMaterial,
    physicalMaterial,
    comparisonMaterials,
    comparisonNames,
    comparisonMeshes,
    shadowMaterial,
    shadowReceiver,
    comparisonSet,
    materialPositionKeys,
    instances,
    instanceColors,
    instanceHighlight,
    instanceTransform,
    instanceScreen,
    instancePositionKeys,
    instancedSet,
    batches,
    batchGeometryIds,
    batchIds,
    batchPositionKeys,
    lod,
    lodMaterials,
    batchedSet,
    tubeMaterial,
    extrudeMaterial,
    shapeMaterial,
    tube,
    extrude,
    shape,
    curves,
    lineMaterial,
    loopMaterial,
    edgesMaterial,
    pointsMaterial,
    spriteMaterial,
    line,
    loop,
    edges,
    points,
    sprite,
    objects,
    hemisphere,
    ambient,
    directional,
    point,
    spot,
    cookie,
    probe,
    area,
  };
}
