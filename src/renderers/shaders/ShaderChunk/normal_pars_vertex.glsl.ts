export default "\n#ifndef FLAT_SHADED\n\n	varying vec3 vNormal;\n\n	#ifdef USE_TANGENT\n\n		varying vec3 vTangent;\n		varying vec3 vBitangent;\n\n	#endif\n\n#endif\n";
