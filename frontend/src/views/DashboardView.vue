<script setup lang="ts">
import { Building2, KeyRound, LayoutList, ShieldCheck, Users } from "@lucide/vue"

import PageHeader from "@/components/layout/PageHeader.vue"
import SectionHeader from "@/components/layout/SectionHeader.vue"
import StatCard from "@/components/data/StatCard.vue"
import { Card, CardContent } from "@/components/ui/card"

/** The five RBAC resources, so the overview doubles as the map of the app. */
const MODULES = [
  { label: "组织", to: "/system/organizations", icon: Building2, hint: "组织单位" },
  { label: "用户", to: "/system/users", icon: Users, hint: "用户与所属组织" },
  { label: "视图", to: "/system/views", icon: LayoutList, hint: "菜单、页面与按钮" },
  { label: "角色", to: "/system/roles", icon: ShieldCheck, hint: "用户、视图与权限" },
  { label: "权限", to: "/system/permissions", icon: KeyRound, hint: "最小授权单元" },
]
</script>

<template>
  <!-- One container pattern for every page: p-4 space-y-4. A page that
       invents its own padding is the fastest way for an app to stop
       looking like one app. -->
  <div class="p-4 space-y-4">
    <PageHeader title="总览" subtitle="系统管理的入口——左侧「系统管理」下有五个资源页。" />

    <SectionHeader>模块</SectionHeader>

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <StatCard
        v-for="module in MODULES"
        :key="module.to"
        :label="module.label"
        value="管理"
        :icon="module.icon"
        :hint="module.hint"
      />
    </div>

    <SectionHeader>从这里开始</SectionHeader>

    <Card>
      <CardContent class="space-y-3 text-sm">
        <p class="text-muted-foreground">
          后端提供 <span class="font-mono text-xs">/rbac/*</span> 五组接口，页面与它们一一对应：
          分页列表、<span class="font-mono text-xs">GET /:id</span>、创建、局部更新、软删除。
        </p>
        <ul class="ml-4 list-disc space-y-1.5 text-muted-foreground">
          <li>读走 ts-grm 的查询 DSL，写走原生参数化 SQL——见后端约束。</li>
          <li>删除是软删除：记录留在库里，但不再出现在列表与查询中。</li>
          <li>新建与编辑复用同一个弹窗表单，字段由资源的定义驱动。</li>
          <li>表格分页由后端承担，页码与每页条数都会带到请求里。</li>
        </ul>
      </CardContent>
    </Card>
  </div>
</template>
