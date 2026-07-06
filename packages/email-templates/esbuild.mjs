import esbuild from "esbuild";

await esbuild.build({
  entryPoints: ["src/index.js"],
  bundle: true,
  outfile: "dist/index.js",
  platform: "node",
  format: "cjs",
  jsx: "automatic",
  loader: { ".jsx": "jsx" },
  logLevel: "info",
});
