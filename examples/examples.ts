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
    group: "materials and textures",
    items: [
      "webgl_materials_texture_anisotropy",
      "webgl_materials_texture_canvas",
      "webgl_materials_texture_filters",
      "webgl_materials_texture_manualmipmap",
      "webgl_materials_texture_partialupdate",
      "webgl_materials_texture_rotation",
      "webgl_materials_wireframe",
      "webgl_materials_blending",
      "webgl_materials_blending_custom",
      "webgl_materials_channels",
      "webgl_materials_bumpmap",
      "webgl_materials_displacementmap",
      "webgl_materials_normalmap",
      "webgl_materials_normalmap_object_space",
      "webgl_materials_envmaps",
      "webgl_materials_cubemap_dynamic",
      "webgl_materials_cubemap_mipmaps",
      "webgl_materials_cubemap_render_to_mipmaps",
      "webgl_materials_physical_clearcoat",
      "webgl_materials_toon",
    ],
  },
  {
    group: "points and lines",
    items: [
      "webgl_custom_attributes_lines",
      "webgl_custom_attributes_points",
      "webgl_custom_attributes_points2",
      "webgl_custom_attributes_points3",
      "webgl_lines_colors",
      "webgl_lines_dashed",
      "webgl_points_billboards",
      "webgl_points_dynamic",
      "webgl_points_sprites",
      "webgl_sprites",
    ],
  },
  {
    group: "cameras and clipping",
    items: [
      "webgl_camera_array",
      "webgl_camera_logarithmicdepthbuffer",
      "webgl_clipping",
      "webgl_clipping_advanced",
      "webgl_clipping_intersection",
      "webgl_clipping_stencil",
      "webgl_multiple_views",
      "webgl_multiple_scenes_comparison",
      "webgl_multiple_elements",
      "webgl_multiple_elements_text",
    ],
  },
  {
    group: "render targets and panoramas",
    items: [
      "webgl_depth_texture",
      "webgl_framebuffer_texture",
      "webgl_multiple_rendertargets",
      "webgl_multisampled_renderbuffers",
      "webgl_rtt",
      "webgl_read_float_buffer",
      "webgl_shader",
      "webgl_shader_lava",
      "webgl_shaders_sky",
      "webgl_raycaster_texture",
      "webgl_panorama_cube",
      "webgl_panorama_equirectangular",
    ],
  },
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
      "webgl_loader_xyz",
      "webgl_loader_gcode",
      "webgl_loader_obj",
      "webgl_loader_imagebitmap",
      "webgl_loader_bvh",
      "webgl_loader_mdd",
      "webgl_loader_pcd",
      "webgl_loader_3ds",
      "webgl_loader_vox",
      "webgl_loader_texture_dds",
      "webgl_loader_texture_ktx",
      "webgl_loader_texture_pvrtc",
      "webgl_loader_texture_tga",
      "webgl_loader_texture_hdr",
      "webgl_loader_texture_ultrahdr",
      "webgl_loader_texture_ktx2",
      "webgl_loader_gltf_anisotropy",
      "webgl_loader_gltf_avif",
      "webgl_loader_gltf_instancing",
      "webgl_loader_gltf_iridescence",
      "webgl_loader_gltf_variants",
      "webgl_loader_texture_exr",
      "webgl_loader_fbx",
      "webgl_loader_fbx_nurbs",
      "webgl_materials_envmaps_groundprojected",
      "webgl_loader_ttf",
      "webgl_loader_md2",
      "webgl_loader_md2_control",
      "webgl_loader_amf",
      "webgl_loader_3mf",
      "webgl_loader_3mf_materials",
      "webgl_loader_texture_tiff",
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
      "webgl_geometry_text_shapes",
      "webgl_geometry_cube",
      "webgl_buffergeometry",
      "webgl_buffergeometry_indexed",
      "webgl_buffergeometry_lines",
      "webgl_buffergeometry_lines_indexed",
      "webgl_buffergeometry_points",
      "webgl_buffergeometry_points_interleaved",
      "webgl_buffergeometry_attributes_none",
      "webgl_buffergeometry_attributes_integer",
      "webgl_buffergeometry_custom_attributes_particles",
      "webgl_buffergeometry_drawrange",
      "webgl_points_waves",
      "webgl_buffergeometry_glbufferattribute",
      "webgl_buffergeometry_instancing",
      "webgl_buffergeometry_instancing_billboards",
      "webgl_buffergeometry_instancing_interleaved",
      "webgl_buffergeometry_rawshader",
      "webgl_buffergeometry_selective_draw",
      "webgl_buffergeometry_uint",
      "webgl_custom_attributes",
      "webgl_geometries",
      "webgl_geometry_colors",
      "webgl_geometry_nurbs",
      "webgl_geometry_terrain_raycast",
      "webgl_helpers",
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
    group: "interaction",
    items: [
      "webgl_interactive_buffergeometry",
      "webgl_interactive_cubes",
      "webgl_interactive_cubes_ortho",
      "webgl_interactive_lines",
      "webgl_interactive_points",
      "webgl_interactive_raycasting_points",
      "webgl_interactive_voxelpainter",
      "webgl_instancing_raycast",
      "webgl_raycaster_sprite",
      "webgl_math_orientation_transform",
    ],
  },
  {
    group: "morph targets",
    items: ["webgl_morphtargets", "webgl_morphtargets_horse", "webgl_morphtargets_sphere", "webgl_instancing_morph"],
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
      "webgl_postprocessing_3dlut",
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
      "webgl_materials_envmaps_hdr",
      "webgl_materials_cubemap",
      "webgl_materials_cubemap_refraction",
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

// Scale the iframe viewport without changing its visible bounds.
const params = { resolutionScale: 1, reload: () => select(canvas.dataset.selected ?? "webgl_loader_draco") };

const gui = new GUI({
  title: "demo browser",
  container: document.querySelector<HTMLDivElement>("#browser-controls")!,
});
gui
  .add(params, "resolutionScale", 0.5, 2, 0.05)
  .name("resolution scale")
  .onChange((value) => {
    frame.style.width = `${100 * (value as number)}%`;
    frame.style.height = `${100 * (value as number)}%`;
    frame.style.transform = `translate(-50%, -50%) scale(${1 / (value as number)})`;
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
