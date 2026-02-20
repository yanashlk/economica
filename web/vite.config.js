import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  appType: "spa",
  server: {
    proxy: {
      "/forms": "http://localhost:3001",
      "/submissions": "http://localhost:3001",
      "/auth": "http://localhost:3001",
      "/admin": "http://localhost:3001",
    },
  },
});