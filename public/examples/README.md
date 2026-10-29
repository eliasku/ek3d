# Example assets and attribution

ek3d is a non-commercial project. Third-party assets retain their own licenses and restrictions.
Non-commercial use is not permission to redistribute an asset. Preserve notices and resolve
missing redistribution rights before public hosting or packaging.

Porting note: differential tests against upstream/vendor modules (ktx-parse, RoundedBox, needle
pointer plugin etc.) are temporary companions of the porting effort. Tests depending on external
resources (CDN modules, needle.tools assets) are deleted instead of kept — re-checks happen at
package release against the remaining browser matrix.

`venice_sunset_1k.hdr` is upstream three.js' example asset: [Venice Sunset by Greg Zaal](https://polyhaven.com/a/venice_sunset), [CC0 / Poly Haven](https://polyhaven.com/license). Copied unmodified from the pinned `upstream/three.js/examples/textures/equirectangular/` checkout.

`textures/minecraft/atlas.png` comes from the Painterly Pack (http://painterlypack.net/), as referenced by upstream's `painterlypack.txt`.

`models/obj/*` assets (cerberus, female02, male02, walt, tree, ninja) are the unmodified upstream example models.

`models/gltf/DispersionTest.glb`, `models/gltf/SheenChair.glb`, `models/gltf/coffeemat.glb`, `models/gltf/facecap.glb`, `models/gltf/DragonDispersion.glb`, `textures/edge3.jpg` and `textures/lottie/24017-lottie-logo-animation.json` are the unmodified upstream example assets. The Lottie JSON is the LottieFiles sample [#24017 lottie logo animation](https://lottiefiles.com/24017-lottie-logo-animation), served by upstream three.js examples.

`libs/basis/*` (Binomial LLC, Apache-2.0) and `examples/libs/meshopt_decoder.module.js` (meshoptimizer, MIT) are the unmodified upstream vendor decoder runtimes, served as assets like the Draco decoders; the package source carries no vendor code.

`models/stl/ascii/slotted_disk.stl`, `models/stl/binary/{pr2_head_pan,pr2_head_tilt,colored}.stl`,
`models/ply/ascii/dolphins.ply` and `models/ply/binary/Lucy100k.ply` are copied unmodified from the
pinned three.js examples. Upstream credits the STL loader example to
[Alec Leeper](https://github.com/aleeper), the PR2 head to
[pr2_description](https://www.ros.org/wiki/pr2_description), and the PLY example/data to
[Wei Meng](https://github.com/menway) and
[John Burkardt](https://people.sc.fsu.edu/~jburkardt/data/ply/ply.html).
The upstream three.js MIT notice is retained in `models/THREE-LICENSE.txt`.

`libs/fflate.module.js` is the unmodified upstream fflate 0.8.3 runtime by Arjun Barrett
([MIT license](https://github.com/101arrowz/fflate/blob/v0.8.3/LICENSE), retained in
`libs/fflate-LICENSE.txt`). Examples load it as a resource and explicitly inject its zlib decoder.
`libs/meshopt_simplifier.module.js` is the unmodified meshoptimizer runtime by Arseny Kapoulkine
(MIT notice in `libs/meshopt_simplifier-LICENSE.txt`). Neither runtime is bundled into package source.

`models/fbx/**` is copied unmodified from the pinned upstream example assets, including the
Mixamo character/animation credited by `webgl_loader_fbx`. The source README declares `nurbs.fbx`
CC0; that README is retained. The subsurface bunny example credits Shaochun Lin for art support.

`models/gltf/Flower/*` is Kenney's Nature Pack model (CC0 1.0; upstream README retained).
`models/gltf/LeePerrySmith/*` contains Lee Perry-Smith's head scan and normal map
(CC BY 3.0; attribution in `LeePerrySmith_License.txt`).

`textures/memorial.exr` (Paul Debevec's HDR Research image), `textures/piz_compressed.exr`
(Richard Monette's IBL sample) and `textures/equirectangular.png` are unmodified upstream assets.
`textures/matcaps/040full.exr` is credited to cyaoeu, with `040full.txt` retained;
the porcelain matcap and its attribution text are retained alongside it.

`textures/waterdudv.jpg`, `textures/waternormals.jpg` and
`textures/water/Water_{1_M_Normal,2_M_Normal,1_M_Flow}.jpg` are unmodified upstream water textures.
The pinned checkout supplies no separate per-texture notice; the repository MIT notice is retained.

`models/xyz/helix_201.xyz` is John Burkardt's 201-point helix, copied unmodified from
the pinned three.js checkout. The [XYZ data page](https://people.math.sc.edu/Burkardt/data/xyz/xyz.html)
licenses the data under GNU LGPL; `models/xyz/COPYING.LESSER` contains LGPL 2.1.
The data file is the editable source and is served locally with the example.

`models/gcode/{benchy,test_m82,test_m83}.gcode` are unmodified pinned upstream toolpaths.
The upstream MIT notice is retained in `models/THREE-LICENSE.txt`.
The boat is [#3DBenchy](https://www.3dbenchy.com/) by Creative Tools, designed by Daniel Norée;
its [current license is CC0 1.0](https://www.3dbenchy.com/license/).

`models/obj/male02/*` includes the OBJ, MTL and three textures from the pinned upstream checkout.
The retained `readme.txt` credits Reallusion iClone and links the original Google 3D Warehouse author.
`textures/planets/earth_atmos_2048.jpg`, also used by the ImageBitmap comparison, is the unmodified
upstream Earth texture.

`models/bvh/pirouette.bvh` and `models/mdd/cube.mdd` are unmodified pinned upstream assets.
Upstream credits the [CMU Graphics Lab Motion Capture Database](http://mocap.cs.cmu.edu/)
for the BVH motion capture. The MIT notice is retained in `models/THREE-LICENSE.txt`.

`models/pcd/{ascii,binary,binary_compressed}/*`, `models/3ds/portalgun/*` and `models/vox/monu10.vox`
are unmodified pinned upstream assets. The 3DS example supplies the separate `textures/normal.jpg`
normal map. Upstream links [MagicaVoxel](https://ephtracy.github.io/) for the VOX sample.
The MIT notice is retained in `models/THREE-LICENSE.txt`.

`models/gltf/{AnisotropyBarnLamp,IridescenceLamp}.glb`, `models/gltf/AVIFTest/forest_house.glb`,
`models/gltf/DamagedHelmet/**` and `models/gltf/MaterialsVariantsShoe/**` are unmodified pinned assets.
The lamp metadata credits Wayfair and Eric Chadwick (CC BY 4.0). DamagedHelmet and the Shopify shoe
retain their upstream README attribution and licenses.

`textures/memorial.hdr`, `textures/ktx2/*.ktx2`,
`textures/equirectangular/quarry_01_1k.hdr` and `spruit_sunrise_{2k,4k}.hdr.jpg` are pinned upstream
textures. Quarry and Spruit Sunrise are [Poly Haven](https://polyhaven.com/) environments (CC0).
`libs/zstddec.module.js` is the unmodified ZSTD decoder used by the HDR KTX2 sample.
Its wrapper and embedded Zstandard notices are retained in `libs/zstddec-LICENSE.txt`.

`textures/compressed/*.{dds,ktx,pvr}` (30 files), `textures/wave_normals_24bit_uncompressed.dds`,
`textures/crate_color8.tga` and `textures/crate_grey8.tga` are unmodified pinned upstream example
assets. Upstream credits the leaf/`disturb` texture to
[lauris71](https://opengameart.org/node/10505) and the explosion texture to
[bart](https://opengameart.org/node/7728); the remaining compressed samples and the TGA crate
textures ship without separate per-file notices. The MIT notice is retained in
`models/THREE-LICENSE.txt`.

`textures/crate.gif`, `textures/floors/FloorsCheckerboard_S_Diffuse.jpg` and
`textures/terrain/grasslight-big.jpg` are unmodified pinned upstream example textures.
The terrain texture retains its upstream OpenGameArt attribution and CC BY 3.0 notice.

`fonts/ttf/kenpixel.ttf` is Kenney's KenPixel font (CC0; bundled notice retained).
`libs/opentype-1.3.4.min.js` is the upstream opentype.js runtime by Frederik De Bleser and
contributors; its MIT license is retained alongside it. Applications inject the parser into
`TTFLoader`; this runtime is not included in package source.

`luts/*` contains the nine unmodified lookup tables used by the upstream 3D LUT example.
The CUBE headers credit RocketStock (2017); the 3DL header credits Presetpro.com and Tim Martin
(2018). The upstream page also credits FreePresets.com. The pinned directory supplies no
separate LUT redistribution license; provenance is not a grant of additional rights.

`models/md2/ogro/**` and `models/md2/ratamahatta/**` are unmodified pinned upstream model assets.
The retained `Ogro.txt` credits Magarnigal (model), Ogro_Fix (skins) and Deranged (additional skin).
The pinned Ratamahatta directory contains no attribution notice. Neither directory supplies
explicit redistribution terms; resolve these model permissions before publishing the assets.

`models/3mf/{cube_gears,facecolors,multipletextures,pyramid,spinal implant,variable voronoi,vertexcolors}.3mf`
are the pinned 3MF Consortium samples. Their upstream attribution README and BSD-2-Clause license
are retained. `models/3mf/truck.3mf` and `models/amf/rook.amf` are pinned upstream example models
without asset-specific license notices; the adjacent three.js MIT notices do not establish
separate model permissions. Resolve those permissions before publishing the assets.

`textures/{square-outline-textured.png,water.jpg}` and
`textures/sprites/{circle,disc,spark1}.png` are unmodified pinned upstream assets used by the
BufferGeometry and interactive point/voxel examples. The pinned checkout provides no separate
per-image redistribution notices; the three.js MIT notice is retained in `models/THREE-LICENSE.txt`.

`textures/tiff/*`, `textures/cube/pisa{HDR,}/**`, `models/obj/walt/WaltHead.obj` and
`models/ply/binary/Lucy100k.ply` are unmodified pinned upstream assets. The upstream examples
credit David OReilly for WaltHead and the Stanford 3D Scanning Repository for Lucy.
Pisa is Paul Debevec's light-probe image. These credits do not add redistribution rights.
`textures/cube/{SwedishRoyalCastle,Park3Med}/**` are by Emil Persson (Humus); their retained
`readme.txt` files require written approval for commercial distribution.
`vendor/utif.module.js` is the pinned UTIF runtime by Photopea, with its MIT notice retained
in `vendor/UTIF-LICENSE.txt`. Examples inject it into `TIFFLoader`; package source does not bundle it.

`models/gltf/Horse.glb` is the pinned upstream horse, credited to Mirada's _Rome_ project.
The checkout supplies no asset-specific redistribution license; resolve permissions before
publication. `models/gltf/AnimatedMorphSphere/glTF/*` is Howard Wolosky's glTF test model
(CC0; upstream README retained).

The panorama photograph `textures/2294472375_24a3b8ef46_o.jpg` is credited by upstream to
[Jón Ragnarsson](https://www.flickr.com/photos/jonragnarsson/2294472375/).
`textures/cube/sun_temple_stripe.jpg` is the unmodified upstream cube-panorama atlas.
The pinned checkout does not supply separate redistribution terms for these images.

The material examples also use pinned upstream `models/gltf/Nefertiti/`, whose retained README
specifies CC BY-NC, and `textures/cube/Bridge2/`, whose retained Humus notice requires written
approval for commercial distribution. Keep the adjacent Lee Perry-Smith, ninja displacement,
scratched-gold, lensflare and font notices. The Walt/ninja models, Angus cubemap, sprite images,
hardwood and lava textures ship without explicit asset-specific redistribution terms;
upstream provenance and an adjacent code license do not establish those rights.

The point and sprite pages use unmodified pinned `textures/sprites/{ball,disc,spark1,snowflake1,
snowflake2,snowflake3,snowflake4,snowflake5}.png`, `textures/{sprite0,sprite1,sprite2}.png` and
`models/obj/female02/female02.obj`. The retained model README identifies Reallusion iClone
and its 3D Warehouse source but does not state a redistribution license.
`fonts/helvetiker_bold.typeface.json` retains the existing Helvetiker font notices.

## Animation, lighting, geometry and volume batch

All files below are copied unmodified from the pinned three.js examples.

- `models/gltf/{Soldier,Xbot}.glb`: upstream credits Mixamo. Resolve redistribution terms
  before public hosting. `models/gltf/RobotExpressive/RobotExpressive.glb`: Tomás Laulhé, modified by Don McCurdy,
  CC0 1.0, as recorded in the upstream model README.
- `models/gltf/{Flamingo,Stork,Parrot}.glb`: Mirada's _Rome_ models. As with the Horse,
  the pinned tree does not establish asset-specific redistribution rights.
- `models/gltf/dungeon_warkarma.glb`, `models/json/{pressure,suzanne_buffergeometry}.json`,
  `models/obj/tree.obj`, `models/vox/menger.vox`, `textures/{tri_pattern,disturb}.jpg`,
  `textures/{checker,colors}.png`, hardwood/brick maps, Earth maps, `lobe.hdr` and the
  checkerboard floor maps retain upstream provenance. No blanket asset license is inferred.
- `textures/equirectangular/royal_esplanade_2k.hdr.jpg` is the upstream Royal Esplanade
  environment. Review its original image terms before publication.
- `textures/cube/pisa/{px,nx,py,ny,pz,nz}.png` is Paul Debevec's Pisa light probe.
  Credit alone does not establish redistribution rights.
- `fonts/MPLUSRounded1c/` retains the M PLUS Rounded font's `OFL.txt`.
  Decal textures retain their adjacent `LICENSE.TXT` and Lee Perry-Smith attribution.
- `textures/3d/head256x256x109.zip` retains its adjacent head-dataset notice and copyright.
  `models/nrrd/stent.nrrd` retains its public-domain provenance notice.
  Upstream lists the provenance of `models/nrrd/I.nrrd` as unknown.
- `textures/spiritedaway.ktx2` contains Studio Ghibli imagery; no separate
  redistribution permission was found. `textures/cm_{gray,viridis}.png` retain upstream
  provenance. These resources must not be publicly distributed without applicable rights.

The existing local fflate and Basis runtimes serve the new archive/volume examples.
They are injected explicitly and remain outside the package source.

## Lines, materials, simulation and molecular batch

- `models/pdb/*.pdb` are the seventeen pinned molecular samples. Some files credit
  Chemical Structure Services, A. W. Maverick or Marvin; no asset-specific redistribution
  license was found. Confirm permission before publication.
- `textures/{pano.mp4,pano.webm,kinect.mp4,kinect.webm,sintel.mp4,sintel.ogv}` and
  `models/gltf/{DragonAttenuation,duck}.glb` are unmodified pinned assets.
  The retained `textures/kinect.nfo` records freenect/ffmpeg provenance, not a content license.
  Upstream's Sintel example credits the Blender Foundation. Resolve video/model terms
  before public hosting; the adjacent code license does not establish these rights.
- `textures/wide_gamut/logo_{srgb,p3}.png` and `textures/equirectangular/spot1Lux.hdr`
  retain pinned upstream provenance, without identified asset-specific redistribution terms.
- Bird simulations reuse the local Mirada _Rome_ Parrot and Flamingo models. Lensflare
  textures retain their `LICENSE.txt` (CC BY-NC-SA 3.0); SwedishRoyalCastle retains its
  Humus notice. Existing font, Ferrari, Lee Perry-Smith, UV-grid, HDR and Draco resources
  keep their previously recorded notices and publication caveats.

## Collada, vector scenes, lighting, workers and audio batch

- `models/collada/elf/` is Elf Girl by halloween; `models/collada/stormtrooper/`
  is Dancing Stormtrooper by StrykerDoesAnimation. The upstream pages identify both as
  CC BY. Preserve author credit and review the original distribution terms.
  `models/collada/abb_irb52_7_120.dae` comes from `rdiankov/collada_robots`;
  repository provenance alone does not establish model-specific redistribution rights.
- `models/kmz/Box.kmz` retains `Readme.txt`, attributing the Box model to
  Khronos glTF-Sample-Models. `models/svg/` contains the unmodified pinned SVG samples.
  No blanket license is inferred for individual artwork.
- `models/vrml/` contains all sixteen pinned chooser models and `map.gif`.
  Four model headers cite the Web3D license retained in `WEB3D-LICENSE.txt`;
  review the remaining models' individual terms before publication.
- `libs/chevrotain.module.min.js` is Chevrotain 9.0.1, Apache-2.0, including
  regexp-to-ast 0.5.0, MIT. Both license texts are adjacent.
  `libs/potpack.module.js` retains its ISC license header.
  These are example resources injected into addons, not package dependencies.
- `models/gltf/kira.glb` is identified as CC0 by the upstream IK page.
  `BoomBox.glb` retains the CC0 Public / Microsoft for Everything notice in
  `BoomBox-LICENSE.txt`. RobotExpressive retains its CC0 README.
  DispersionTest embeds CC BY 4.0 attribution to Analytical Graphics, model by Ed Mackey,
  with a CC0 Adobe cloth backdrop.
- `models/gltf/{coffeeMug,DiffuseRoughnessParameterSweep,godrays_demo,ShaderBall,
  ShaderBall2,ShadowmappableMesh,rolex}.glb` and `textures/{jade,shaderball_ds}.jpg`
  and `textures/noise.png` retain pinned upstream provenance. No separate redistribution
  terms were established. FPS, worker and priority examples also reuse existing local
  models, matcap, HDR and Draco resources with their earlier notices.
- `sounds/readme.txt` and `sounds/analysis-NOTICE.txt` retain audio credits.
  Skullbeatz's Bad Cat and other Newgrounds tracks use CC BY-NC-SA terms recorded there;
  Project Utopia and michorvath's ping-pong recording are CC0.
  SwedishRoyalCastle remains subject to its existing Humus notice.

Non-commercial use does not waive attribution, share-alike or permission requirements.

## USD, probe grids, Ammo and prefiltered environments

- `models/usdz/saeukkang.usdz` is copied from the pinned three.js checkout.
  No asset-specific attribution or redistribution license was established. Resolve permission
  before publishing this model.
- `models/gltf/Sponza/` comes from Khronos glTF-Sample-Assets revision
  `8f492390ddc7a2ae221a1369ef560589cf8c70fb`, preserving all 71 glTF payload files.
  The retained README credits Crytek and Frank Meinl. Model files use the
  CRYENGINE Limited License Agreement; metadata uses CC BY 4.0.
  Keep `LICENSE.md`, `metadata.json` and the referenced
  `models/LICENSES/LicenseRef-CRYENGINE-Agreement.txt`. Review the CRYENGINE terms
  before public hosting; this is not a CC0 model.
- `libs/ammo.wasm.js`, `libs/ammo.wasm.wasm` and `libs/ammo.LICENSE` come from
  ammo.js revision `79190a1f03845794b1bba1777f30037349967658`.
  The retained zlib license applies to the runtime, not the example textures.
  `textures/{grid,colors}.png` retain pinned three.js provenance without an inferred
  blanket image license.
- `textures/pmrem/` contains eight pinned prefiltered HDR environments.
  Its README records CC0 Poly Haven sources and photographer credits. Existing local
  Basis, ZSTD, fflate and Venice Sunset resources keep their earlier notices.

The sculpt addon source embeds the complete SculptGL MIT notice for Stéphane Ginier.

## Rhino, IFC, VDB, subdivision and webcam

- `libs/rhino3dm/` contains the unmodified rhino3dm 8.32.1 JavaScript/WASM runtime
  and its MIT license. `models/3dm/Rhino_Logo.3dm` is copied from the pinned upstream
  checkout; model-specific redistribution rights remain unresolved.
- `libs/web-ifc/` contains web-ifc 0.0.77 browser JavaScript, single-threaded WASM
  and its MPL-2.0 license, from the npm tarball with SHA-1
  `5f4b3913c1e42f721c2c031f85633d75dadc0545`.
  Source: https://github.com/ThatOpen/engine_web-ifc/tree/f26c4beef0a668ebdb180d2b95a94097a1e21cef.
  `models/ifc/rac_advanced_sample_project.ifc` is the unchanged pinned upstream
  example model; its asset-specific redistribution terms were not established.
- `models/vdb/PROVENANCE.txt` pins the exact OpenVDB smoke sample and its SHA-256.
  The adjacent website CC BY 4.0 license does not establish model-specific rights.
  Resolve publication permission before hosting the sample.
- `libs/mediapipe/` retains Tasks Vision 0.10.35, its WASM variants and the float16
  version 1 face-landmarker model, with Apache-2.0 license and source notices.
  The webcam example reuses the existing Face Cap model and Meshopt/Basis resources.
- The maintained `LoopSubdivision` port credits three-subdivide 1.1.5 and retains
  its MIT license in the source. `VDBLoader` retains three-vdb-loader 0.3.0's
  MIT notice. Neither addon imports a second Three.js runtime.

## Exporters and sculpting

- `libs/draco/` contains the Google Draco 1.5.7 encoder and its Apache-2.0 license.
  The source is https://github.com/google/draco; the example loads the encoder locally.
- `models/gltf/CarbonFrameBike.glb` retains its adjacent CC BY-SA 4.0 attribution:
  Robert Schweier; realtime and animation by Felix Herbst / prefrontal cortex,
  supported by Needle. Preserve attribution and share-alike requirements.
- `files/arkit.png` is copied from the pinned upstream example. Its image-specific
  redistribution and trademark terms were not established; review them before publication.
- `textures/NormalMap{OpenGL,DirectX}.png` and
  `textures/equirectangular/san_giuseppe_bridge_2k.hdr` are unchanged pinned upstream
  assets. Their asset-specific redistribution terms remain unconfirmed.
- `libs/ktx-parse.module.js` retains the pinned upstream ktx-parse runtime and its
  adjacent MIT license. It is an example asset, not a package runtime dependency.
- Exported files generated by the geometry examples are derived from their scene inputs.
  Exporting a third-party model does not replace its original asset license.

The godrays page reuses the pinned `models/gltf/godrays_demo.glb`; no asset-specific
redistribution license was found. Review permission before public hosting.
The three-good-godrays 0.12.0 zlib license and altered-source notice are retained in
`src/addons/postprocessing/GodraysShaders.ts`. The BVH raycaster reuses the existing
Stanford bunny FBX. The three-mesh-bvh 0.9.10 MIT notice is retained in
`src/addons/math/bvh/core/Constants.ts`. Neither port imports another Three.js runtime.
MaterialX 1.39.5 interface metadata retains its Apache-2.0 license in the root `LICENSE`.

## CSG, batch LOD and G-code

- The CSG page uses procedural geometry and local maintained three-bvh-csg 0.0.18,
  cdt2d and native mesh BVH ports. Their source headers retain MIT notices and provenance.
- The batch LOD page uses procedural geometry, native ports of
  @three.ez/batched-mesh-extensions 0.0.11, bvh.js 0.0.13 and
  @three.ez/simplify-geometry 0.0.1. Andrea Gargaro's MIT notices are retained in
  the root license and source. `libs/meshoptimizer/` contains the licensed
  meshoptimizer 1.1.1 simplifier, injected by the example.
- `libs/polyslice/polyslice.js` is the Polyslice 26.4.0 browser distribution,
  npm tarball SHA-1 `7d865e4b7c237e04bcbf072b98895468a1deba4c`.
  Source: https://github.com/jgphilpott/polyslice.
  The local modification wraps the distribution in `createPolyslice(engine)` and
  replaces its Three.js imports and global lookups with explicit native constructors.
  No slicing algorithms were changed. Adjacent notices cover Polyslice, polyconvert,
  polytree, polygon-clipping, splaytree, robust-predicates, three-subdivide and
  Microsoft's bundled TypeScript helpers. This is an example runtime, not a package
  dependency. Generated G-code is not certified for physical printers.

## Rapier physics

- `libs/rapier/` contains `@dimforge/rapier3d-compat` 0.21.0 from its npm distribution:
  https://www.npmjs.com/package/@dimforge/rapier3d-compat/v/0.21.0.
  Source: https://github.com/dimforge/rapier.js.
  The adjacent `LICENSE` retains the Apache-2.0 terms. The compatibility module embeds
  its WASM payload; the separate upstream WASM file is retained alongside it.
  The runtime is injected by the examples, not bundled into package sources.
- All six Rapier scenes use procedural geometry. Their grid texture reuses the existing
  pinned three.js resource; no additional model asset license is implied.

## Pinned glTF catalog

- `models/gltf-catalog/` uses Khronos glTF-Sample-Assets revision
  `8f492390ddc7a2ae221a1369ef560589cf8c70fb`. The approved 146-model, 325-variant
  inventory and full notices are retained in `examples/gltf-catalog.json`.
  `examples/gltf-catalog-provenance.json` preserves the four excluded model records from
  the original 150-model / 338-variant index, including their notices, hashes and terms.
- Local files cover 146 models and 325 variant entrypoints: 1,294 blobs, 1,208,113,979 bytes,
  plus exact pinned README/LICENSE notices for the 34 models added in iteration 36.
  Preserve component attribution and noncommercial/share-alike conditions.
- BrainStem, EnvironmentTest, Sponza and VirtualCity (13 variants) are explicitly user-excluded.
  Poser EULA, Adobe Stock, CRYENGINE and 3DRT notices do not establish this project's right
  to publish their standalone files. They are not runtime selections or missing assets.
- The embedded Khronos, Cesium, UX3D and DGG marks remain unmodified inside the models,
  as allowed by their pinned LegalMark notices in `models/LICENSES`. They are not used
  as project branding and imply no endorsement. Khronos and the Khronos Group logo are
  registered trademarks of the Khronos Group Inc. glTF and the glTF logo, and 3D Commerce
  and the 3D Commerce logo, are trademarks of the Khronos Group Inc.
- Duck is unmodified under SCEA Shared Source License 1.0; its source notices and
  accompanying documentation are retained with `models/LICENSES/SCEA.txt`.
- DragonAttenuation and DragonDispersion credit the Stanford Computer Graphics Laboratory.
  `models/LICENSES/LicenseRef-Stanford-Graphics.txt` permits free redistribution, not
  commercial use or inclusion in a product for sale without permission.
- PlaysetLightTest's unmodified 3D data retains CC BY-NC-SA 4.0; IKEA product/design rights
  remain reserved. Its complete README and license are adjacent to the model.
- `textures/equirectangular/royal_esplanade_2k.hdr.jpg` is the pinned upstream
  UltraHDR conversion of Greg Zaal's Royal Esplanade photograph. The Poly Haven source
  is CC0: https://polyhaven.com/a/royal_esplanade and https://polyhaven.com/license.
  mrdoob introduced the conversion in three.js commit `56446ce283fa983634903820ecdc4f99aaa3d829`
  ([PR 32380](https://github.com/mrdoob/three.js/pull/32380)); the upstream MIT notice is retained.
  The PR does not specify the conversion tool or additional conversion-specific terms.

## Progressive glTF

- `models/gltf/progressive/knight/` contains The Forgotten Knight by dark_igorek,
  licensed CC BY 4.0. Its adjacent `NOTICE.txt` preserves attribution. The unmodified
  Needle Cloud base GLB and all 89 referenced mesh and texture LOD GLBs are local.
- `models/gltf/progressive/resources.json` records Knight's complete local graph and the
  original source records for the user-excluded Mobile Home and Peachy Balloon.
  The URLs in the supplied three.js revision `83f6bd095356c68334df7d9b7ec03a0abebff3fc`
  both return HTTP 200, but no redistribution grant is established. Balloon's GLB itself
  declares SKETCHFAB Standard. Neither excluded model is copied or requested at runtime.
- The native progressive loader is adapted from MIT-licensed Needle source commit
  `4d423859641a275d322318b0164bc6dce48d36a4` (`3.5.0-rc`), not the upstream page's
  unlicensed `3.2.0`. Source modules retain the license and modified-source notice.
- The example reuses local Quarry 01 by Sergej Majboroda / Poly Haven, CC0.
  Optional worker transport is consumer-provided; no vendor worker or second engine is bundled.
