export default { 
  entry: { index: "src/index.js" },
  format: ["esm"],
  target: "node18",
  outDir: "dist",
  clean: true,
  bundle: true,
  splitting: false,
  sourcemap: true,
  minify: false,
  shims: true,
  platform: "node",
};
