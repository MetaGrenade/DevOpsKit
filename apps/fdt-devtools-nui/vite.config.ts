import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  base: "./",
  server: {
    port: 5175,
    strictPort: true,
  },
  build: {
    outDir: path.resolve(__dirname, "../../resources/fdt_devtools/web/dist"),
    emptyOutDir: true,
  },
});
