import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: [
      "@emotion/react",
      "@emotion/styled",
      "hoist-non-react-statics",
      "prop-types",
      "react-is"
    ],
    esbuildOptions: {
      target: "esnext"
    }
  },
  build: {
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true
    }
  }
});
