<script setup lang="ts">
import { computed } from "vue"
import { RouterLink, useRoute } from "vue-router"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { isActivePath, type NavView } from "@/lib/nav"
import { cn } from "@/lib/utils"

/**
 * A leaf: a link that navigates when clicked. Never expands anything.
 *
 * The counterpart is SidebarMenuGroup, which expands and never navigates.
 * Keeping the two behaviours on separate components is what stops the
 * sidebar from making the user guess what a click will do.
 */
const props = defineProps<{
  view: NavView
  /** Icon-only rail. Only meaningful on desktop; the mobile drawer is
   *  always expanded. */
  collapsed: boolean
  /** Nested under a Menu. Indented so the hierarchy reads at a glance
   *  rather than having to be inferred from position. */
  nested?: boolean
}>()

defineEmits<{ navigate: [] }>()

const route = useRoute()

const active = computed(() => isActivePath(props.view.to, route.path))
</script>

<template>
  <!--
    One Tooltip with `disabled` rather than two branches: the trigger keeps
    the same RouterLink identity across the toggle, so collapsing does not
    remount the link and lose its focus or its in-flight navigation.
  -->
  <Tooltip :disabled="!collapsed">
    <TooltipTrigger as-child>
      <RouterLink
        :to="view.to"
        :aria-current="active ? 'page' : undefined"
        :aria-label="collapsed ? view.title : undefined"
        :class="
          cn(
            'group relative flex items-center rounded-md py-2 text-base transition-colors duration-200',
            collapsed ? 'justify-center px-0' : 'gap-3',
            // Nested items line their icon up under the parent's label,
            // not under the parent's icon.
            collapsed ? '' : nested ? 'pr-3 pl-10' : 'px-3',
            active
              ? 'bg-sidebar-accent/80 font-medium text-sidebar-foreground'
              : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
          )
        "
        @click="$emit('navigate')"
      >
        <!-- The marker is a lit bar, not heavier type: a bar reads as
             "you are here", weight alone only reads as "different". -->
        <span
          v-if="active"
          aria-hidden="true"
          class="absolute top-1/2 left-0 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary shadow-[0_0_8px_var(--primary)]"
        />

        <span class="relative shrink-0">
          <component :is="view.icon" class="size-4" />
          <!-- The glow is a blurred block behind the glyph; a shadow on the
               glyph itself would smear its strokes. -->
          <span
            v-if="active"
            aria-hidden="true"
            class="absolute inset-0 rounded-full bg-primary/30 blur-sm"
          />
        </span>

        <span v-if="!collapsed" class="truncate">{{ view.title }}</span>
      </RouterLink>
    </TooltipTrigger>
    <TooltipContent side="right">{{ view.title }}</TooltipContent>
  </Tooltip>
</template>
