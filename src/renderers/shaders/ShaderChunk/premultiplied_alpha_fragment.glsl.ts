export default "\n#ifdef PREMULTIPLIED_ALPHA\n\n\tgl_FragColor.rgb *= gl_FragColor.a;\n\n#endif\n";
