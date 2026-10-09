<script setup lang="ts">
import { computed, ref } from "vue"
import { useRouter } from "vue-router"
import { Loader2, LogIn } from "@lucide/vue"

import PageHeader from "@/components/layout/PageHeader.vue"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { api, describeApiError } from "@/lib/api.ts"
import { isEmail } from "@/lib/validation.ts"
import { registerAccessRoutes } from "@/router"
import { useAccessStore } from "@/stores/access.ts"
import { useAuthStore } from "@/stores/auth.ts"

/**
 * 登录页。
 *
 * 未登录时任何业务地址都会被守卫送回这里，所以它自己不需要守卫。
 *
 * 登录成功后不只写会话：还要**把可达集合取下来并登记成路由**。这是唯一一处
 * “路由是登录之后才有的”这个事实真正落地的地方 —— 守卫的那条路只负责刷新
 * 页面时的重建。
 */
const router = useRouter()
const auth = useAuthStore()
const access = useAccessStore()

const email = ref("")
const password = ref("")
const submitting = ref(false)
const error = ref<string | null>(null)
/** 首次提交之前不标红：一进页面就一片红是最劝退的空表单。 */
const submitted = ref(false)

const errors = computed(() => {
  const found: Record<string, string> = {}
  if (email.value.trim() === "") found.email = "请填写邮箱。"
  else if (!isEmail(email.value.trim())) found.email = "邮箱格式不正确。"
  if (password.value === "") found.password = "请填写口令。"
  return found
})

async function submit() {
  submitted.value = true
  if (Object.keys(errors.value).length > 0) return

  submitting.value = true
  error.value = null
  try {
    const { data, error: failure } = await api.auth.login.post({
      email: email.value.trim(),
      password: password.value,
    })
    if (failure) throw failure
    auth.signIn(data)

    // 拿到“我能去哪”，把路由登记上，然后落到第一个可访问的页面。
    // 不写死 `/`：用户不一定有总览的权限，跳过去就变成一次 404。
    await access.load()
    registerAccessRoutes(access.views)
    await router.push(access.landingPath ?? "/")
  } catch (cause) {
    // 后端对"邮箱不存在"和"口令不对"回同一句话，所以这里直接显示它。
    error.value = describeApiError(cause)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <!-- 独立的居中布局，不套 App 的侧栏与顶栏（路由上的 meta.layout 决定）。 -->
  <div class="grid min-h-dvh place-items-center p-4">
    <div class="w-full max-w-sm space-y-4">
      <PageHeader title="登录" />

      <Card>
        <CardContent class="pt-6">
          <!-- `novalidate`：浏览器自己的校验会在失败时**不派发 submit**，
              于是我们的错误提示永远不会出现——症状是一个点了没反应的按钮
              （见 principles 第 19 条）。校验交给上面那段 computed。 -->
          <form class="space-y-5" novalidate @submit.prevent="submit">
            <FieldGroup class="gap-5">
              <Field :data-invalid="submitted && errors.email ? true : undefined">
                <FieldLabel for="login-email">邮箱</FieldLabel>
                <Input
                  id="login-email"
                  v-model="email"
                  type="text"
                  inputmode="email"
                  autocomplete="username"
                  :aria-invalid="submitted && errors.email ? true : undefined"
                  placeholder="name@example.com"
                />
                <FieldError v-if="submitted && errors.email">{{ errors.email }}</FieldError>
              </Field>

              <Field :data-invalid="submitted && errors.password ? true : undefined">
                <FieldLabel for="login-password">口令</FieldLabel>
                <Input
                  id="login-password"
                  v-model="password"
                  type="password"
                  autocomplete="current-password"
                  :aria-invalid="submitted && errors.password ? true : undefined"
                />
                <FieldError v-if="submitted && errors.password">{{ errors.password }}</FieldError>
              </Field>
            </FieldGroup>

            <p v-if="error" role="alert" class="text-destructive text-sm">{{ error }}</p>

            <Button type="submit" class="w-full" :disabled="submitting">
              <Loader2 v-if="submitting" class="size-4 animate-spin" />
              <LogIn v-else class="size-4" />
              {{ submitting ? "登录中…" : "登录" }}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
