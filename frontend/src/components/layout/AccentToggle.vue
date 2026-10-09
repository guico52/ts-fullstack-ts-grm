<script setup lang="ts">
import { Palette } from "@lucide/vue"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ACCENTS, ACCENT_LABELS, parseAccent } from "@/lib/accent"
import { useThemeStore } from "@/stores/theme"

const theme = useThemeStore()
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="outline" size="icon-sm" class="shrink-0">
        <Palette class="size-[1.2rem]" />
        <span class="sr-only">选择强调色</span>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuRadioGroup
        :model-value="theme.accent"
        @update:model-value="(v) => theme.setAccent(parseAccent(String(v)))"
      >
        <DropdownMenuRadioItem
          v-for="accent in ACCENTS"
          :key="accent"
          :value="accent"
          class="gap-2"
        >
          <!--
            The swatch carries its own data-accent. --primary is composed on
            <html>, so the colour is rebuilt from the --brand-* parts here,
            where the scoped override applies. It previews exactly what
            picking this accent will do, in whichever theme is active.
          -->
          <span
            :data-accent="accent"
            aria-hidden="true"
            class="inline-block size-3 shrink-0 rounded-full ring-1 ring-black/10 ring-inset dark:ring-white/15"
            style="background: oklch(var(--brand-l) var(--brand-c) var(--brand-h))"
          />
          {{ ACCENT_LABELS[accent] }}
        </DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
