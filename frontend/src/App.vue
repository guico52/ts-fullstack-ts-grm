<script setup lang="ts">
import { RouterView } from "vue-router"

import AppSidebar from "@/components/layout/AppSidebar.vue"
import AppTopbar from "@/components/layout/AppTopbar.vue"
import { TooltipProvider } from "@/components/ui/tooltip"
</script>

<template>
  <!-- One provider for the whole app: tooltips are used in the collapsed
       rail, table row actions and icon buttons, and a provider per tooltip
       would reset the shared delay between them. -->
  <TooltipProvider>
    <!-- h-dvh, not h-screen: on mobile Safari `vh` is the largest viewport,
         so the layout would sit under the browser bar. min-h-0 on the
         scroll container is what actually lets it scroll. -->
    <div class="flex h-dvh bg-background text-foreground">
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
