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
