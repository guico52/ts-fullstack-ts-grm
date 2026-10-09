<script setup lang="ts">
import type { Component } from "vue"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * A metric card. The title uses the design-system label — 11px, uppercase,
 * 0.08em tracking, muted — which is the same string every data card in the
 * app uses. The guard test asserts it, so a card cannot quietly ship with
 * the stock `text-base font-medium` title and drift out of the family.
 */
defineProps<{
  label: string
  value: string
  hint?: string
  icon?: Component
  loading?: boolean
}>()
</script>

<template>
  <Card class="gap-0 py-4">
    <CardHeader class="flex flex-row items-center justify-between pb-2">
      <CardTitle class="text-base font-semibold tracking-[0.08em] text-muted-foreground uppercase">
        {{ label }}
      </CardTitle>
      <component :is="icon" v-if="icon" class="size-4 text-primary" />
    </CardHeader>
    <CardContent>
      <Skeleton v-if="loading" class="h-8 w-24" />
      <!-- tabular-nums: without it a live number reflows on every update
           and the whole row twitches. -->
      <div v-else class="text-2xl font-semibold tracking-tight tabular-nums">{{ value }}</div>
      <p v-if="hint" class="mt-1 text-xs text-muted-foreground">{{ hint }}</p>
    </CardContent>
  </Card>
</template>
