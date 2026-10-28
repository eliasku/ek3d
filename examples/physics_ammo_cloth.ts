import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { Stats } from "ek3d/addons/libs/Stats";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { Side, Wrapping, ColorSpace } from "ek3d/constants";
import { BufferAttribute } from "ek3d/core/BufferAttribute";
import { BufferGeometry } from "ek3d/core/BufferGeometry";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { SphereGeometry } from "ek3d/geometries/SphereGeometry";
import { AmbientLight } from "ek3d/lights/AmbientLight";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { TextureLoader } from "ek3d/loaders/TextureLoader";
import { LineBasicMaterial } from "ek3d/materials/LineBasicMaterial";
import { MeshLambertMaterial } from "ek3d/materials/MeshLambertMaterial";
import { MeshPhongMaterial } from "ek3d/materials/MeshPhongMaterial";
import { Color } from "ek3d/math/Color";
import { Quaternion } from "ek3d/math/Quaternion";
import { Vector3 } from "ek3d/math/Vector3";
import { LineSegments } from "ek3d/objects/LineSegments";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { depthShader } from "ek3d/renderers/shaders/DepthShader";
import { lambertShader } from "ek3d/renderers/shaders/LambertShader";
import { phongShader } from "ek3d/renderers/shaders/PhongShader";
import { WebGLBackground } from "ek3d/renderers/webgl/WebGLBackground";
import { WebGLShadowMap } from "ek3d/renderers/webgl/WebGLShadowMap";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

interface Vec {
  x(): number;
  y(): number;
  z(): number;
}
interface Rotation extends Vec {
  w(): number;
}
interface Transform {
  setIdentity(): void;
  setOrigin(v: Vec): void;
  setRotation(q: Rotation): void;
  getOrigin(): Vec;
  getRotation(): Rotation;
}
interface Shape {
  setMargin(n: number): void;
  calculateLocalInertia(mass: number, inertia: Vec): void;
}
interface Motion {
  getWorldTransform(t: Transform): void;
}
interface Body {
  setActivationState(n: number): void;
  setFriction(n: number): void;
  getMotionState(): Motion | null;
}
interface SoftBody {
  get_m_cfg(): { set_viterations(n: number): void; set_piterations(n: number): void };
  setTotalMass(n: number, fromFaces: boolean): void;
  setActivationState(n: number): void;
  appendAnchor(index: number, body: Body, disableCollision: boolean, influence: number): void;
  get_m_nodes(): { at(i: number): { get_m_x(): Vec } };
}
interface Hinge {
  enableAngularMotor(enabled: boolean, velocity: number, impulse: number): void;
}
interface World {
  setGravity(v: Vec): void;
  getWorldInfo(): { set_m_gravity(v: Vec): void };
  addRigidBody(b: Body): void;
  removeRigidBody(b: Body): void;
  addSoftBody(b: SoftBody, group: number, mask: number): void;
  removeSoftBody(b: SoftBody): void;
  addConstraint(c: Hinge, disable: boolean): void;
  removeConstraint(c: Hinge): void;
  stepSimulation(delta: number, steps: number): void;
}
interface AmmoRuntime {
  btVector3: new (x: number, y: number, z: number) => Vec;
  btQuaternion: new (x: number, y: number, z: number, w: number) => Rotation;
  btTransform: new () => Transform;
  btBoxShape: new (v: Vec) => Shape;
  btSphereShape: new (radius: number) => Shape;
  btDefaultMotionState: new (t: Transform) => Motion;
  btRigidBodyConstructionInfo: new (mass: number, motion: Motion, shape: Shape, inertia: Vec) => object;
  btRigidBody: new (info: object) => Body;
  btSoftBodyRigidBodyCollisionConfiguration: new () => object;
  btCollisionDispatcher: new (config: object) => object;
  btDbvtBroadphase: new () => object;
  btSequentialImpulseConstraintSolver: new () => object;
  btDefaultSoftBodySolver: new () => object;
  btSoftRigidDynamicsWorld: new (
    dispatcher: object,
    broadphase: object,
    solver: object,
    config: object,
    softSolver: object,
  ) => World;
  btSoftBodyHelpers: new () => {
    CreatePatch(
      info: object,
      a: Vec,
      b: Vec,
      c: Vec,
      d: Vec,
      nx: number,
      ny: number,
      fixed: number,
      diagonals: boolean,
    ): SoftBody;
    CreateRope(info: object, a: Vec, b: Vec, resolution: number, fixed: number): SoftBody;
  };
  btHingeConstraint: new (a: Body, b: Body, pa: Vec, pb: Vec, axisA: Vec, axisB: Vec, reference: boolean) => Hinge;
  btCollisionObject: object;
  castObject(body: SoftBody, type: object): { getCollisionShape(): Shape };
  destroy(value: object): void;
}
type AmmoFactory = (options: { locateFile: (file: string) => string }) => Promise<AmmoRuntime>;

export function startSoftBodyDemo(kind: "cloth" | "rope"): void {
  const element = document.querySelector<HTMLCanvasElement>("#scene");
  if (!element) throw new Error("Missing physics canvas");
  const canvas: HTMLCanvasElement = element;
  let disposed = false;
  let cleanup = (): void => {};
  const script = document.createElement("script");
  const fail = (error: unknown): void => {
    if (disposed) return;
    canvas.dataset.state = "error";
    canvas.dataset.error = error instanceof Error ? error.message : String(error);
    console.error(error);
  };
  canvas.dataset.state = "loading";
  window.addEventListener("pagehide", (event) => {
    if (!event.persisted) {
      disposed = true;
      script.remove();
      cleanup();
    }
  });
  script.onerror = () => fail(new Error("Failed to load Ammo runtime"));
  script.onload = () => {
    if (!("Ammo" in window) || typeof window.Ammo !== "function") {
      fail(new Error("Invalid Ammo runtime"));
      return;
    }
    const factory = window.Ammo as AmmoFactory;
    factory({ locateFile: (file) => `/examples/libs/${file}` })
      .then((ammo) => {
        if (disposed) return;
        try {
          initialize(ammo);
        } catch (error) {
          cleanup();
          fail(error);
        }
      })
      .catch(fail);
  };
  script.src = "/examples/libs/ammo.wasm.js";
  document.head.appendChild(script);

  function initialize(ammo: AmmoRuntime): void {
    const allocations: object[] = [];
    const own = <T extends object>(value: T): T => {
      allocations.push(value);
      return value;
    };
    const vec = (x: number, y: number, z: number): Vec => own(new ammo.btVector3(x, y, z));
    const scene = new Scene();
    scene.background = new Color(0xbfd1e5);
    const camera = new PerspectiveCamera(60, innerWidth / innerHeight, 0.2, 2000);
    if (kind === "cloth") camera.position.set(-12, 7, 4);
    else camera.position.set(-7, 5, 8);
    const renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      createBackground: WebGLBackground,
      createShadowMap: WebGLShadowMap,
      shaders: {
        MeshPhongMaterial: phongShader,
        MeshLambertMaterial: lambertShader,
        MeshDepthMaterial: depthShader,
        LineBasicMaterial: basicShader,
      },
    });
    renderer.setPixelRatio(devicePixelRatio);
    renderer.setSize(innerWidth, innerHeight);
    if (!renderer.shadowMap) throw new Error("Missing shadow map system");
    renderer.shadowMap.enabled = true;
    const controls = new OrbitControls(camera, canvas);
    controls.target.set(0, 2, 0);
    controls.update();
    const stats = new Stats();
    document.body.appendChild(stats.dom);
    scene.add(new AmbientLight(0xbbbbbb));
    const light = new DirectionalLight(0xffffff, 3);
    if (kind === "cloth") light.position.set(-7, 10, 15);
    else light.position.set(-10, 10, 5);
    light.castShadow = true;
    light.shadow.camera.left = -10;
    light.shadow.camera.right = 10;
    light.shadow.camera.top = 10;
    light.shadow.camera.bottom = -10;
    light.shadow.camera.near = 2;
    light.shadow.camera.far = 50;
    light.shadow.mapSize.set(1024, 1024);
    if (kind === "cloth") light.shadow.bias = -0.003;
    scene.add(light);
    const config = own(new ammo.btSoftBodyRigidBodyCollisionConfiguration());
    const dispatcher = own(new ammo.btCollisionDispatcher(config));
    const broadphase = own(new ammo.btDbvtBroadphase());
    const solver = own(new ammo.btSequentialImpulseConstraintSolver());
    const softSolver = own(new ammo.btDefaultSoftBodySolver());
    const world = own(new ammo.btSoftRigidDynamicsWorld(dispatcher, broadphase, solver, config, softSolver));
    world.setGravity(vec(0, -9.8, 0));
    world.getWorldInfo().set_m_gravity(vec(0, -9.8, 0));
    const transformAux = own(new ammo.btTransform());
    const bodies: { mesh: Mesh; body: Body; dynamic: boolean }[] = [];
    let softBody: SoftBody | undefined;
    let hinge: Hinge | undefined;
    let movement = 0;
    let active = true;
    const resize = (): void => {
      camera.aspect = innerWidth / innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(innerWidth, innerHeight);
    };
    const keydown = (event: KeyboardEvent): void => {
      if (event.code === "KeyQ") movement = 1;
      else if (event.code === "KeyA") movement = -1;
    };
    const keyup = (): void => {
      movement = 0;
    };
    cleanup = () => {
      if (!active) return;
      active = false;
      renderer.setAnimationLoop(null);
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("keyup", keyup);
      if (hinge) {
        world.removeConstraint(hinge);
        ammo.destroy(hinge);
      }
      if (softBody) {
        world.removeSoftBody(softBody);
        ammo.destroy(softBody);
      }
      for (const entry of bodies) world.removeRigidBody(entry.body);
      for (let i = allocations.length - 1; i >= 0; i--) {
        if (allocations[i] !== hinge && allocations[i] !== softBody) ammo.destroy(allocations[i]);
      }
      controls.dispose();
      disposeObject(scene);
      light.shadow.dispose();
      renderer.dispose();
      stats.dom.remove();
    };
    const pos = new Vector3();
    const quat = new Quaternion();
    function rigid(mesh: Mesh, shape: Shape, mass: number): Body {
      mesh.position.copy(pos);
      mesh.quaternion.copy(quat);
      const transform = own(new ammo.btTransform());
      transform.setIdentity();
      transform.setOrigin(vec(pos.x, pos.y, pos.z));
      transform.setRotation(own(new ammo.btQuaternion(quat.x, quat.y, quat.z, quat.w)));
      const motion = own(new ammo.btDefaultMotionState(transform));
      const inertia = vec(0, 0, 0);
      shape.calculateLocalInertia(mass, inertia);
      const info = own(new ammo.btRigidBodyConstructionInfo(mass, motion, shape, inertia));
      const body = own(new ammo.btRigidBody(info));
      if (mass > 0) body.setActivationState(4);
      world.addRigidBody(body);
      bodies.push({ mesh, body, dynamic: mass > 0 });
      scene.add(mesh);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      return body;
    }
    function box(
      x: number,
      y: number,
      z: number,
      mass: number,
      material: MeshPhongMaterial,
    ): { mesh: Mesh; body: Body } {
      const mesh = new Mesh(new BoxGeometry(x, y, z), material);
      const shape = own(new ammo.btBoxShape(vec(x / 2, y / 2, z / 2)));
      shape.setMargin(0.05);
      return { mesh, body: rigid(mesh, shape, mass) };
    }
    function grid(material: MeshPhongMaterial | MeshLambertMaterial, x: number, y: number): void {
      new TextureLoader().load(
        "/examples/textures/grid.png",
        (texture) => {
          if (!active || disposed) {
            texture.dispose();
            return;
          }
          texture.colorSpace = ColorSpace.SRGB;
          texture.wrapS = Wrapping.Repeat;
          texture.wrapT = Wrapping.Repeat;
          texture.repeat.set(x, y);
          material.map = texture;
          material.needsUpdate = true;
        },
        undefined,
        fail,
      );
    }
    pos.set(0, -0.5, 0);
    const groundMaterial = new MeshPhongMaterial({ color: 0xffffff });
    box(40, 1, 40, 0, groundMaterial);
    grid(groundMaterial, 40, 40);
    let ball: Body | undefined;
    if (kind === "rope") {
      pos.set(-3, 2, 0);
      const shape = own(new ammo.btSphereShape(0.6));
      shape.setMargin(0.05);
      ball = rigid(new Mesh(new SphereGeometry(0.6, 20, 20), new MeshPhongMaterial({ color: 0x202020 })), shape, 1.2);
      ball.setFriction(0.5);
    }
    pos.set(0, 0.3, -3.6);
    for (let row = 0; row < 8; row++) {
      const odd = row % 2 === 1;
      pos.z = -3.6 - (odd ? 0.3 : 0);
      const count = odd ? 7 : 6;
      for (let i = 0; i < count; i++) {
        const half = odd && (i === 0 || i === count - 1);
        box(
          0.6,
          0.6,
          half ? 0.6 : 1.2,
          half ? 0.25 : 0.5,
          new MeshPhongMaterial({ color: Math.floor(Math.random() * 0x1000000) }),
        );
        pos.z += odd && (i === 0 || i === count - 2) ? 0.9 : 1.2;
      }
      pos.y += 0.6;
    }
    const helpers = own(new ammo.btSoftBodyHelpers());
    let geometry: BufferGeometry;
    let armLength: number;
    let pylonHeight: number;
    let startZ: number;
    if (kind === "cloth") {
      const plane = new PlaneGeometry(4, 3, 20, 15);
      plane.rotateY(Math.PI / 2);
      plane.translate(-3, 4.5, 0);
      geometry = plane;
      const material = new MeshLambertMaterial({ color: 0xffffff, side: Side.Double });
      const cloth = new Mesh(plane, material);
      cloth.castShadow = true;
      cloth.receiveShadow = true;
      scene.add(cloth);
      grid(material, 20, 15);
      softBody = own(
        helpers.CreatePatch(
          world.getWorldInfo(),
          vec(-3, 6, 2),
          vec(-3, 6, -2),
          vec(-3, 3, 2),
          vec(-3, 3, -2),
          21,
          16,
          0,
          true,
        ),
      );
      armLength = 7;
      pylonHeight = 6;
      startZ = 2;
    } else {
      geometry = new BufferGeometry();
      const positions: number[] = [];
      const indices: number[] = [];
      for (let i = 0; i <= 10; i++) positions.push(-3, 2.6 + i * 0.4, 0);
      for (let i = 0; i < 10; i++) indices.push(i, i + 1);
      geometry.setIndex(new BufferAttribute(new Uint16Array(indices), 1));
      geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
      geometry.computeBoundingSphere();
      const rope = new LineSegments(geometry, new LineBasicMaterial({ color: 0x000000 }));
      rope.castShadow = true;
      rope.receiveShadow = true;
      scene.add(rope);
      softBody = own(helpers.CreateRope(world.getWorldInfo(), vec(-3, 2.6, 0), vec(-3, 6.6, 0), 9, 0));
      armLength = 3;
      pylonHeight = 6.6;
      startZ = 0;
    }
    const cfg = softBody.get_m_cfg();
    cfg.set_viterations(10);
    cfg.set_piterations(10);
    softBody.setTotalMass(kind === "cloth" ? 0.9 : 3, false);
    ammo.castObject(softBody, ammo.btCollisionObject).getCollisionShape().setMargin(0.15);
    world.addSoftBody(softBody, 1, -1);
    softBody.setActivationState(4);
    const baseMaterial = new MeshPhongMaterial({ color: 0x606060 });
    pos.set(-3, 0.1, startZ - armLength);
    box(1, 0.2, 1, 0, baseMaterial);
    pos.set(-3, pylonHeight / 2, startZ - armLength);
    const pylon = box(0.4, pylonHeight, 0.4, 0, baseMaterial);
    pos.set(-3, pylonHeight + 0.2, startZ - armLength / 2);
    const arm = box(0.4, 0.4, armLength + 0.4, 2, baseMaterial);
    if (kind === "cloth") {
      softBody.appendAnchor(0, arm.body, false, 0.5);
      softBody.appendAnchor(20, arm.body, false, 0.5);
    } else if (ball) {
      softBody.appendAnchor(0, ball, true, 1);
      softBody.appendAnchor(10, arm.body, true, 1);
    }
    const axis = vec(0, 1, 0);
    hinge = own(
      new ammo.btHingeConstraint(
        pylon.body,
        arm.body,
        vec(0, pylonHeight / 2, 0),
        vec(0, -0.2, -armLength / 2),
        axis,
        axis,
        true,
      ),
    );
    world.addConstraint(hinge, true);
    window.addEventListener("resize", resize);
    window.addEventListener("keydown", keydown);
    window.addEventListener("keyup", keyup);
    let previous = performance.now();
    renderer.setAnimationLoop(() => {
      const now = performance.now();
      const delta = (now - previous) / 1000;
      previous = now;
      hinge?.enableAngularMotor(true, (kind === "cloth" ? 0.8 : 1.5) * movement, 50);
      world.stepSimulation(delta, 10);
      if (softBody) {
        const positions = geometry.getAttribute("position");
        const nodes = softBody.get_m_nodes();
        if (!(positions instanceof BufferAttribute)) throw new Error("Missing soft body positions");
        for (let i = 0; i < positions.count; i++) {
          const p = nodes.at(i).get_m_x();
          positions.setXYZ(i, p.x(), p.y(), p.z());
        }
        positions.needsUpdate = true;
        if (kind === "cloth") {
          geometry.computeVertexNormals();
          const normal = geometry.getAttribute("normal");
          if (normal) normal.needsUpdate = true;
        }
      }
      for (const entry of bodies)
        if (entry.dynamic) {
          const motion = entry.body.getMotionState();
          if (!motion) continue;
          motion.getWorldTransform(transformAux);
          const p = transformAux.getOrigin();
          const q = transformAux.getRotation();
          entry.mesh.position.set(p.x(), p.y(), p.z());
          entry.mesh.quaternion.set(q.x(), q.y(), q.z(), q.w());
        }
      renderer.render(scene, camera);
      stats.update();
      if (canvas.dataset.state !== "error") canvas.dataset.state = "rendered";
    });
  }
}

if (location.pathname.endsWith("physics_ammo_cloth.html")) startSoftBodyDemo("cloth");
