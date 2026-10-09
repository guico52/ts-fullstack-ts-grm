import { fileURLToPath, URL } from "node:url"

// vitest/config re-exports Vite's defineConfig with the `test` field typed.
import { defineConfig } from "vitest/config"
import vue from "@vitejs/plugin-vue"
import tailwindcss from "@tailwindcss/vite"
import { brandConfig } from "./src/config/brand.ts"

export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    {
      name: "project-document-title",
      transformIndexHtml(html) {
        const title = `${brandConfig.projectName} · ${brandConfig.companyName}`
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
        return html.replace(/<title>.*?<\/title>/, `<title>${title}</title>`)
      },
    },
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // Guards read source files and server-render components; neither needs a DOM.
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
})
