import { defineConfig } from "vite";

export default defineConfig({
  base: "/arcade/pallet-3d/",
  server: {
    host: "0.0.0.0",
    port: 47321,
    strictPort: true,
  },
  preview: {
    host: "0.0.0.0",
    port: 47321,
    strictPort: true,
  },
});
