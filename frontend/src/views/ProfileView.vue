<script setup lang="ts">
import { onMounted, ref } from "vue"
import { RouterLink } from "vue-router"
import type { AuthModel } from "../../../backend/src/modules/auth/model"
import PageHeader from "@/components/layout/PageHeader.vue"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { api, describeApiError } from "@/lib/api"
import { useAuthStore } from "@/stores/auth"
import { useAccessStore } from "@/stores/access"
const auth = useAuthStore()
const access = useAccessStore()
const profile = ref<AuthModel["profile"] | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
async function load() {
  loading.value = true
  error.value = null
  try {
    const { data, error: failure } = await api.auth.me.get()
    if (failure) throw failure
    profile.value = data
    if (auth.user?.id === data.id)
      auth.signIn({
        ...auth.user,
        name: data.name,
        email: data.email,
        mustChangePassword: data.mustChangePassword,
      })
    await access.load()
  } catch (cause) {
    error.value = describeApiError(cause)
  } finally {
    loading.value = false
  }
}
onMounted(load)
</script>
<template>
  <div class="p-4 space-y-4">
    <PageHeader title="我的信息"
      ><template #actions
        ><Button as-child
          ><RouterLink to="/account/password">修改密码</RouterLink></Button
        ></template
      ></PageHeader
    >
    <p v-if="error" role="alert" class="text-sm text-destructive">{{ error }}</p>
    <Button v-if="error" variant="outline" :disabled="loading" @click="load">重新加载</Button>
    <Card class="max-w-2xl">
      <CardHeader
        ><CardTitle
          class="text-base font-semibold tracking-[0.08em] text-muted-foreground uppercase"
          >账户资料</CardTitle
        ></CardHeader
      >
      <CardContent>
        <p v-if="loading && !profile" class="text-sm text-muted-foreground">加载中…</p>
        <dl v-else-if="profile" class="grid gap-7 sm:grid-cols-2">
          <div class="min-w-0 space-y-2">
            <dt class="text-base font-semibold">姓名</dt>
            <dd class="break-words">{{ profile.name }}</dd>
          </div>
          <div class="min-w-0 space-y-2">
            <dt class="text-base font-semibold">邮箱</dt>
            <dd class="font-mono break-all">{{ profile.email }}</dd>
          </div>
          <div class="min-w-0 space-y-2">
            <dt class="text-base font-semibold">所属组织</dt>
            <dd class="break-words">{{ profile.organization?.name ?? "未关联组织" }}</dd>
          </div>
          <div class="min-w-0 space-y-2">
            <dt class="text-base font-semibold">用户 ID</dt>
            <dd class="font-mono tabular-nums break-all">{{ profile.id }}</dd>
          </div>
          <div class="min-w-0 space-y-2">
            <dt class="text-base font-semibold">角色</dt>
            <dd class="flex flex-wrap gap-2">
              <span
                v-for="role in profile.roles"
                :key="role.id"
                class="rounded-md bg-muted px-2 py-1 break-words"
                >{{ role.name }}</span
              ><span v-if="!profile.roles.length">未分配角色</span>
            </dd>
          </div>
          <div class="min-w-0 space-y-2">
            <dt class="text-base font-semibold">密码状态</dt>
            <dd>{{ profile.mustChangePassword ? "需要修改密码" : "正常" }}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  </div>
</template>
