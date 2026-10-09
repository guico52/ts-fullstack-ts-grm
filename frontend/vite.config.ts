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
  build: {
    /**
     * ECharts is the one dependency measured in hundreds of kB: ~770kB
     * minified, ~265kB gzipped, and only on the chart route. The default
     * 500kB warning would fire on every build for a chunk that is lazy by
     * design, which is how a warning becomes noise. Raising it here records
     * the decision instead of hiding a regression.
     */
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        /**
         * ECharts is ~600kB of the chart page and changes only when the
         * library does. Splitting it out of the view's chunk means editing
         * `ChartsView.vue` does not invalidate the cached library, and the
         * route's dynamic import keeps both off the first load entirely.
         */
        manualChunks: (id: string) =>
          /node_modules\/(echarts|vue-echarts|zrender)\//.test(id) ? "echarts" : undefined,
      },
    },
  },
  test: {
    // Guards read source files and server-render components; neither needs a DOM.
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
})
