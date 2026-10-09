<script setup lang="ts">
import { watch } from "vue"
import { useRoute } from "vue-router"

import { isMenu } from "@/lib/nav"
import { brandConfig } from "@/config/brand"
import { useAccessStore } from "@/stores/access"
import { useUiStore } from "@/stores/ui"
import SidebarMenuGroup from "./SidebarMenuGroup.vue"
import SidebarNavItem from "./SidebarNavItem.vue"

/**
 * Brand lockup + navigation tree. Shared by the desktop rail and the mobile
 * drawer, so the two can never disagree about what the app contains.
 *
 * The container and the collapse control live in AppSidebar: this piece is
 * only the contents.
 */
defineProps<{ collapsed: boolean }>()
defineEmits<{ navigate: [] }>()

const route = useRoute()
const ui = useUiStore()
const access = useAccessStore()

/**
 * Opening the Menu a route belongs to, on every navigation.
 *
 * Without this, following a link into a collapsed section leaves the user
 * on a page whose parent is shut — the sidebar no longer shows where they
 * are, which is the one thing it is for.
 */
watch(
  () => route.path,
  (path) => ui.revealPath(path, access.navEntries),
  { immediate: true },
)
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <div class="flex items-center py-2" :class="collapsed ? 'justify-center px-0' : 'gap-2.5 px-2'">
      <div
        data-slot="company-logo"
        class="flex size-9 shrink-0 items-center justify-center rounded-lg border border-sidebar-border bg-sidebar-accent/30 text-sidebar-foreground"
      >
        <img
          :src="brandConfig.defaultLogoImage"
          alt="公司 Logo 占位"
          class="size-6 object-contain dark:invert"
        />
      </div>
      <div v-if="!collapsed" class="min-w-0">
        <div
          data-slot="project-name"
          class="text-base font-semibold break-words text-sidebar-foreground"
          :style="brandConfig.projectFont"
        >
          {{ brandConfig.projectName }}
        </div>
      </div>
    </div>

    <nav class="mt-2 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto" aria-label="主导航">
      <template v-for="entry in access.navEntries" :key="isMenu(entry) ? entry.id : entry.to">
        <SidebarMenuGroup
          v-if="isMenu(entry)"
          :menu="entry"
          :collapsed="collapsed"
          @navigate="$emit('navigate')"
        />
        <SidebarNavItem v-else :view="entry" :collapsed="collapsed" @navigate="$emit('navigate')" />
      </template>
    </nav>
  </div>
</template>
