<script setup lang="ts">
import { computed } from "vue"
import { RouterLink, useRoute } from "vue-router"
import { ChevronRight } from "@lucide/vue"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { isActivePath, type NavMenu } from "@/lib/nav"
import { cn } from "@/lib/utils"
import { useUiStore } from "@/stores/ui"
import SidebarNavItem from "./SidebarNavItem.vue"

/**
 * A parent entry: it expands and collapses, and **never navigates on its
 * own**. A parent that both opens and navigates is the classic way to make
 * a sidebar feel unpredictable — the user cannot tell whether a click will
 * move them or reveal something.
 *
 * Two presentations, one state:
 *
 * - expanded rail: an inline group, children indented beneath it
 * - icon rail: a flyout menu, because a 64px column cannot show a nested
 *   list, and expanding the rail on hover would be a layout jump the user
 *   did not ask for
 */
const props = defineProps<{
  menu: NavMenu
  collapsed: boolean
}>()

defineEmits<{ navigate: [] }>()

const ui = useUiStore()
const route = useRoute()

const open = computed(() => ui.isMenuOpen(props.menu.id))

/** Something inside is the current page. */
const containsActive = computed(() =>
  props.menu.children.some((child) => isActivePath(child.to, route.path)),
)
</script>

<template>
  <!-- Icon rail: a flyout. -->
  <DropdownMenu v-if="collapsed">
    <DropdownMenuTrigger as-child>
      <button
        type="button"
        :aria-label="menu.title"
        aria-haspopup="menu"
        :class="
          cn(
            'group relative flex items-center justify-center rounded-md px-0 py-2 text-base transition-colors duration-200',
            'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
          )
        "
      >
        <!-- A collapsed parent whose child is the current page keeps its
             marker: otherwise the rail shows nothing at all for the page
             you are on. -->
        <span
          v-if="containsActive"
          aria-hidden="true"
          class="absolute top-1/2 left-0 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary shadow-[0_0_8px_var(--primary)]"
        />
        <component
          :is="menu.icon"
          :class="cn('size-4 shrink-0', containsActive && 'text-primary')"
        />
      </button>
    </DropdownMenuTrigger>

    <DropdownMenuContent side="right" align="start" class="min-w-44">
      <DropdownMenuLabel>{{ menu.title }}</DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem v-for="child in menu.children" :key="child.to" as-child>
        <RouterLink
          :to="child.to"
          :aria-current="isActivePath(child.to, route.path) ? 'page' : undefined"
          class="flex w-full items-center gap-2"
          @click="$emit('navigate')"
        >
          <component :is="child.icon" class="size-4" />
          {{ child.title }}
        </RouterLink>
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>

  <!-- Expanded rail: an inline, collapsible group. -->
  <div v-else>
    <button
      type="button"
      :aria-expanded="open"
      :aria-controls="`nav-menu-${menu.id}`"
      :class="
        cn(
          'group relative flex w-full items-center gap-3 rounded-md px-3 py-2 text-base transition-colors duration-200',
          containsActive
            ? 'font-medium text-sidebar-foreground'
            : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
        )
      "
      @click="ui.toggleMenu(menu.id)"
    >
      <span class="relative shrink-0">
        <component :is="menu.icon" :class="cn('size-4', containsActive && 'text-primary')" />
      </span>

      <span class="min-w-0 flex-1 truncate text-left">{{ menu.title }}</span>

      <!-- The chevron is the affordance: it says "this opens" before the
           user clicks, which the label alone cannot. -->
      <ChevronRight
        aria-hidden="true"
        :class="
          cn(
            'size-4 shrink-0 text-sidebar-foreground/40 transition-transform duration-200',
            open && 'rotate-90',
          )
        "
      />
    </button>

    <!-- v-show, not v-if: the children stay in the DOM so a screen reader
         and the browser's find-in-page still know they exist, and the
         toggle does not rebuild them. -->
    <div
      v-show="open"
      :id="`nav-menu-${menu.id}`"
      role="group"
      class="mt-0.5 flex flex-col gap-0.5"
    >
      <SidebarNavItem
        v-for="child in menu.children"
        :key="child.to"
        :view="child"
        :collapsed="false"
        nested
        @navigate="$emit('navigate')"
      />
    </div>
  </div>
</template>
