import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { fileURLToPath, URL } from "node:url"

export default defineConfig({
  base: process.env.DEPLOY_BASE || "/",
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  build: {
    sourcemap: false,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "three-core",
              test: /three[\/]build[\/]three.core/,
              priority: 30,
            },
            {
              name: "three-renderer",
              test: /node_modules.*three[\/]/,
              priority: 20,
            },
            {
              name: "react",
              test: /node_modules.*(?:react|react-dom|scheduler)[\/]/,
              priority: 10,
            },
          ],
        },
      },
    },
  },
  server: { host: "127.0.0.1", port: 4173, strictPort: true },
  preview: { host: "127.0.0.1", port: 4174, strictPort: true },
})
