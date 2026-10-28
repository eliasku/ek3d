# equirectangular textures

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
