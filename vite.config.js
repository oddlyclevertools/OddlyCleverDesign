import { defineConfig } from "vite";

export default defineConfig({
  base: "./", // works from any folder, including GitHub Pages project sites
  server: { port: 5181, strictPort: true },
  build: { target: "es2022", chunkSizeWarningLimit: 1500 },
});
