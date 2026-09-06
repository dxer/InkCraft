import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

// content script 必须是经典脚本（不支持 ES Module），单独产出 IIFE 单文件
export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: false,
    lib: {
      entry: fileURLToPath(new URL("./src/content.ts", import.meta.url)),
      name: "InkCraftContent",
      formats: ["iife"],
      fileName: () => "content.js",
    },
  },
});
