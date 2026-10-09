<script setup lang="ts">
import { computed } from "vue"
import { RouterView, useRoute } from "vue-router"

import AppSidebar from "@/components/layout/AppSidebar.vue"
import AppTopbar from "@/components/layout/AppTopbar.vue"
import { TooltipProvider } from "@/components/ui/tooltip"

const route = useRoute()

/**
 * 路由可以声明 `meta.layout: "bare"` 来绕过侧栏与顶栏。
 *
 * 只有登录页用它：一个还没进去的人不该看见导航，那会让他以为已经进来了。
 * 用 meta 而不是"路径等于 /login"的判断，是为了让下一个需要裸布局的页面
 * （错误页、打印页）只改路由一处。
 */
const bare = computed(() => route.meta.layout === "bare")
</script>

<template>
  <!-- One provider for the whole app: tooltips are used in the collapsed
       rail, table row actions and icon buttons, and a provider per tooltip
       would reset the shared delay between them. -->
  <TooltipProvider>
    <RouterView v-if="bare" />

    <!-- h-dvh, not h-screen: on mobile Safari `vh` is the largest viewport,
         so the layout would sit under the browser bar. min-h-0 on the
         scroll container is what actually lets it scroll. -->
    <div v-else class="flex h-dvh bg-background text-foreground">
      <AppSidebar />
      <div class="flex min-w-0 flex-1 flex-col">
        <AppTopbar />
        <main class="min-h-0 flex-1 overflow-auto">
          <RouterView />
        </main>
      </div>
    </div>
  </TooltipProvider>
</template>
