<script setup lang="ts">
import { RouterLink } from "vue-router"
import { ArrowLeft, Home } from "@lucide/vue"

import PageHeader from "@/components/layout/PageHeader.vue"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

/**
 * The catch-all route.
 *
 * Without one, an unknown URL renders the shell with an empty main area —
 * which reads as a broken app rather than a wrong address, and leaves the
 * user with no way back except the browser button.
 */
</script>

<template>
  <div class="p-4 space-y-4">
    <PageHeader title="页面不存在" subtitle="这个地址没有页面，或者它已经被移走了。" />

    <Card class="max-w-2xl">
      <CardHeader>
        <CardTitle
          class="text-base font-semibold tracking-[0.08em] text-muted-foreground uppercase"
        >
          走错了
        </CardTitle>
        <CardDescription>请检查地址，或从总览页重新开始。</CardDescription>
      </CardHeader>
      <CardContent>
        <div class="flex flex-wrap items-center gap-2">
          <Button as-child>
            <RouterLink to="/">
              <Home class="size-4" />
              回到Overview
            </RouterLink>
          </Button>
          <!-- A real back step, for the common case of a stale link that
               landed here from somewhere inside the app. -->
          <Button variant="outline" @click="$router.back()">
            <ArrowLeft class="size-4" />
            返回上一页
          </Button>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
