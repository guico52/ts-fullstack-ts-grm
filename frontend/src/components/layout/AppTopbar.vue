<script setup lang="ts">
import { Menu } from "@lucide/vue"

import AccentToggle from "@/components/layout/AccentToggle.vue"
import ThemeToggle from "@/components/layout/ThemeToggle.vue"
import { Button } from "@/components/ui/button"
import { brandConfig } from "@/config/brand"
import { useUiStore } from "@/stores/ui"

const ui = useUiStore()
</script>

<template>
  <!--
    Three columns, not justify-between. The company name has to sit at the
    true centre of the bar, and it does only when both side columns are the
    same width — `justify-between` would let a wide left side push the name
    off centre as soon as the controls change.

    The bar carries no breadcrumb: the sidebar already shows where you are,
    and a second, smaller copy of that answer was the busiest thing on an
    otherwise empty strip.
  -->
  <header data-slot="topbar" class="app-topbar shrink-0">
    <div class="topbar-start flex min-w-0 items-center justify-start">
      <!-- Only on the sizes where the sidebar is a drawer. Leaving this
           visible on desktop would offer a second way to open something
           that is already on screen. -->
      <Button
        variant="ghost"
        size="icon-sm"
        class="md:hidden"
        aria-label="打开导航"
        @click="ui.setMobileNav(true)"
      >
        <Menu class="size-4" />
      </Button>
    </div>

    <div class="topbar-lockup">
      <span class="topbar-wing" aria-hidden="true"><i /><i /></span>
      <div class="topbar-title">
        <span data-slot="topbar-brand" class="topbar-name text-base font-semibold">
          {{ brandConfig.companyName }}
        </span>
      </div>
      <span class="topbar-wing topbar-wing-end" aria-hidden="true"><i /><i /></span>
    </div>

    <div class="topbar-end flex min-w-0 items-center justify-end gap-2">
      <AccentToggle />
      <ThemeToggle />
    </div>
  </header>
</template>

<style scoped>
/* A centred brand stage: all colour and light come from the app's tokens. */
.app-topbar {
  position: relative;
  isolation: isolate;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 4fr) minmax(0, 1fr);
  align-items: center;
  gap: 0.75rem;
  min-height: 6rem;
  padding: 1rem;
  border-bottom: 1px solid var(--border);
  background:
    radial-gradient(
      ellipse at 50% 0%,
      color-mix(in oklab, var(--primary) 12%, transparent),
      transparent 70%
    ),
    var(--background);
  container-type: inline-size;
}

.app-topbar::after {
  content: "";
  position: absolute;
  inset: auto 0 0;
  height: 2px;
  background: linear-gradient(
    90deg,
    transparent,
    color-mix(in oklab, var(--primary) 55%, transparent),
    transparent
  );
  pointer-events: none;
}

.topbar-lockup {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: center;
  gap: 1rem;
}

.topbar-title {
  min-width: 0;
  padding: 0.7rem 0;
}

.topbar-name {
  display: block;
  overflow-wrap: anywhere;
  text-align: center;
  font-size: clamp(1.25rem, 3cqi, 2rem);
  font-weight: 750;
  line-height: 1.4;
  letter-spacing: 0.08em;
  color: var(--foreground);
}

.topbar-wing {
  display: flex;
  flex: 1 1 3rem;
  max-width: 5rem;
  min-width: 1.5rem;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.4rem;
}

.topbar-wing i {
  width: 100%;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent,
    color-mix(in oklab, var(--primary) 65%, transparent)
  );
}

.topbar-wing i:last-child {
  width: 55%;
}

.topbar-wing-end {
  transform: rotate(180deg);
}

@container (max-width: 650px) {
  .topbar-wing {
    display: none;
  }
  .topbar-title {
    padding-inline: 0.75rem;
  }
}

/* A separate brand row keeps the full company name and controls readable. */
@media (max-width: 639px) {
  .app-topbar {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 0.5rem;
    padding: 0.75rem;
  }
  .topbar-lockup {
    grid-column: 1 / -1;
    grid-row: 1;
  }
  .topbar-start,
  .topbar-end {
    grid-row: 2;
  }
}
</style>
