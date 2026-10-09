<script setup lang="ts">
import { PanelLeftClose, PanelLeftOpen } from "@lucide/vue"

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useUiStore } from "@/stores/ui"
import SidebarNav from "./SidebarNav.vue"

/**
 * The sidebar in both of its lives:
 *
 * - desktop: a rail that collapses to icons, persisted so it survives reload
 * - mobile:  a drawer, because a 240px permanent rail on a 390px screen is
 *            a layout the page can never win against
 *
 * Both render the same SidebarNav, so the two can never drift apart.
 */
const ui = useUiStore()
</script>

<template>
  <aside
    class="hidden shrink-0 flex-col border-r border-sidebar-border bg-sidebar p-3 transition-[width] duration-200 ease-out md:flex"
    :style="{ width: ui.sidebarWidth }"
    aria-label="主导航"
  >
    <SidebarNav :collapsed="ui.sidebarCollapsed" />

    <!--
      Icon-only is the one state where a label cannot explain itself, so the
      control carries an accessible name and a tooltip.
    -->
    <Tooltip :disabled="!ui.sidebarCollapsed">
      <TooltipTrigger as-child>
        <button
          type="button"
          :aria-label="ui.sidebarCollapsed ? '展开侧栏' : '收起侧栏'"
          :class="[
            'mt-2 flex items-center rounded-md py-2 text-sidebar-foreground/50 transition-colors duration-200',
            'hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
            ui.sidebarCollapsed ? 'justify-center px-0' : 'gap-2 px-3',
          ]"
          @click="ui.toggleSidebar()"
        >
          <component
            :is="ui.sidebarCollapsed ? PanelLeftOpen : PanelLeftClose"
            class="size-4 shrink-0"
          />
          <span v-if="!ui.sidebarCollapsed" class="text-xs font-medium">收起</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">展开侧栏</TooltipContent>
    </Tooltip>
  </aside>

  <Sheet :open="ui.mobileNavOpen" @update:open="(open) => ui.setMobileNav(!!open)">
    <SheetContent side="left" class="w-64 gap-0 bg-sidebar p-3">
      <!-- Dialog content needs a title for assistive tech even when the
           heading is visually redundant with the brand block below it. -->
      <SheetTitle class="sr-only">导航</SheetTitle>
      <SidebarNav :collapsed="false" @navigate="ui.setMobileNav(false)" />
    </SheetContent>
  </Sheet>
</template>
