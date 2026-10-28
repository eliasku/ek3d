/**
 * In-app example browser: a list of demo cards on the left, the selected demo
 * rendered in an <iframe> on the right.
 */
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";

const frameSel = document.querySelector<HTMLIFrameElement>("#demo-frame");
if (frameSel === null) throw new Error("Missing demo iframe");
const frame: HTMLIFrameElement = frameSel;

const listSel = document.querySelector<HTMLDivElement>("#demo-list");
if (listSel === null) throw new Error("Missing demo list");
const list: HTMLDivElement = listSel;

/** The ported demo pages grouped by upstream section. */
const DEMOS: Array<{ group: string; items: string[] }> = [
  {
    group: "loaders",
    items: [
      "webgl_loader_draco",
      "webgl_loader_gltf_transmission",
      "webgl_loader_gltf_compressed",
      "webgl_loader_gltf_animation_pointer",
      "webgl_morphtargets_face",
      "webgl_loader_gltf_dispersion",
      "webgl_loader_gltf_sheen",
      "webgl_loader_texture_lottie",
      "webgl_loader_ldraw",
      "webgl_loader_stl",
      "webgl_loader_ply",
      "webgl_loader_texture_exr",
      "webgl_loader_fbx",
      "webgl_loader_fbx_nurbs",
      "webgl_materials_envmaps_groundprojected",
    ],
  },
  {
    group: "controls",
    items: [
      "misc_controls_orbit",
      "misc_controls_map",
      "misc_controls_drag",
      "misc_controls_pointerlock",
      "misc_controls_transform",
      "misc_controls_trackball",
      "misc_controls_arcball",
    ],
  },
  {
    group: "misc",
    items: [
      "misc_animation_keys",
      "misc_animation_groups",
      "misc_boxselection",
      "webgl_lights_hemisphere",
      "webgl_instancing_dynamic",
      "webgl_instancing_scatter",
      "webgl_interactive_htmlmesh",
    ],
  },
  {
    group: "geometry",
    items: [
      "webgl_geometry_shapes",
      "webgl_geometry_extrude_shapes",
      "webgl_geometry_terrain",
      "webgl_geometry_minecraft",
      "webgl_geometry_text",
      "webgl_lod",
      "webgl_modifier_simplifier",
    ],
  },
  {
    group: "camera",
    items: ["webgl_camera"],
  },
  {
    group: "animation",
    items: ["webgl_animation_keyframes", "misc_controls_fly"],
  },
  {
    group: "postprocessing",
    items: [
      "webgl_postprocessing",
      "webgl_postprocessing_afterimage",
      "webgl_postprocessing_dof",
      "webgl_postprocessing_fxaa",
      "webgl_postprocessing_glitch",
      "webgl_postprocessing_masking",
      "webgl_postprocessing_procedural",
      "webgl_postprocessing_rgb_halftone",
      "webgl_postprocessing_sao",
      "webgl_postprocessing_smaa",
      "webgl_postprocessing_sobel",
      "webgl_postprocessing_ssaa",
      "webgl_postprocessing_ssao",
      "webgl_postprocessing_taa",
      "webgl_postprocessing_transition",
      "webgl_postprocessing_unreal_bloom",
      "webgl_postprocessing_unreal_bloom_selective",
      "webgl_postprocessing_gtao",
    ],
  },
  {
    group: "shaders / tone mapping",
    items: ["webgl_shaders", "webgl_tonemapping", "webgl_shaders_ocean"],
  },
  {
    group: "materials",
    items: [
      "webgl_materials_alphahash",
      "webgl_materials_texture_html",
      "webgl_materials_envmaps_exr",
      "webgl_materials_matcap",
      "webgl_materials_subsurface_scattering",
      "webgl_mirror",
      "webgl_refraction",
      "webgl_water2",
    ],
  },
];

const canvas = document.querySelector<HTMLCanvasElement>("#browser-check-target")!;

function select(name: string): void {
  const url = `/examples/${name}.html`;
  frame.src = url;
  canvas.dataset.selected = name;
  canvas.dataset.state = "selected";

  for (const item of list.querySelectorAll<HTMLButtonElement>(".demo-item")) {
    item.classList.toggle("active", item.dataset.demo === name);
  }

  history.replaceState(null, "", `#${name}`);
}

function buildList(): void {
  const search = document.querySelector<HTMLInputElement>("#demo-search")!;

  function renderFilter(filter: string): void {
    list.innerHTML = "";

    for (const { group, items } of DEMOS) {
      const visible = items.filter((name) => name.includes(filter.toLowerCase().replaceAll(" ", "_")));
      if (visible.length === 0) continue;

      const heading = document.createElement("h3");
      heading.textContent = group;
      list.appendChild(heading);

      for (const name of visible) {
        const button = document.createElement("button");
        button.type = "button";
        button.classList.add("demo-item");
        button.dataset.demo = name;
        button.textContent = name;
        button.addEventListener("click", () => select(name));
        list.appendChild(button);
      }
    }
  }

  search.addEventListener("input", () => renderFilter(search.value));
  renderFilter("");

  const initial = location.hash.slice(1);
  if (initial) {
    select(initial);
  } else {
    select("webgl_loader_draco");
  }
}

buildList();

// Keyboard shortcuts mirroring the integrated demo's page-check contract.
window.addEventListener("keydown", (event) => {
  if (event.ctrlKey || event.metaKey) return;

  if (event.code === "ArrowDown" || event.code === "ArrowUp") {
    const items = list.querySelectorAll<HTMLButtonElement>(".demo-item");
    if (items.length === 0) return;

    const currentIndex = Array.from(items).findIndex((item) => item.classList.contains("active"));
    const next =
      event.code === "ArrowDown" ? Math.min(currentIndex + 1, items.length - 1) : Math.max(currentIndex - 1, 0);
    const target = items[next === -1 ? 0 : next] as HTMLButtonElement;

    if (target.dataset.demo) select(target.dataset.demo);
  }
});

// A lil-gui panel controls the iframe's scale and reload, matching the demo HUD contract.
const params = { scale: 1, reload: () => select(canvas.dataset.selected ?? "webgl_loader_draco") };

const gui = new GUI({ title: "demo browser" });
gui
  .add(params, "scale", 0.5, 2, 0.05)
  .name("iframe scale")
  .onChange((value) => {
    frame.style.width = `${100 / (value as number)}%`;
    frame.style.height = `${100 / (value as number)}%`;
    frame.style.transform = `scale(${value as number})`;
  });
gui.add(params, "reload").name("reload demo");

window.addEventListener(
  "pagehide",
  () => {
    gui.destroy();
  },
  { once: true },
);

function publishState(): void {
  canvas.dataset.frames = String(Number(canvas.dataset.frames ?? 0) + 1);
  requestAnimationFrame(publishState);
}

publishState();
