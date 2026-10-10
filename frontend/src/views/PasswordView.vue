<script setup lang="ts">
import { ref } from "vue"
import { useRouter } from "vue-router"
import PageHeader from "@/components/layout/PageHeader.vue"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { api, describeApiError } from "@/lib/api"
import { validatePassword } from "@/lib/password"
import { clearAccessRoutes } from "@/router"
import { useAuthStore } from "@/stores/auth"
import { useAccessStore } from "@/stores/access"
const auth = useAuthStore()
const access = useAccessStore()
const router = useRouter()
const currentPassword = ref("")
const newPassword = ref("")
const confirmation = ref("")
const errors = ref<Record<string, string>>({})
const error = ref<string | null>(null)
const submitting = ref(false)
async function submit() {
  errors.value = validatePassword(newPassword.value, confirmation.value)
  if (!currentPassword.value) errors.value.currentPassword = "请填写当前密码。"
  if (newPassword.value === currentPassword.value)
    errors.value.newPassword = "新密码必须与当前密码不同。"
  if (Object.keys(errors.value).length) return
  submitting.value = true
  error.value = null
  try {
    const { error: failure } = await api.auth.me.password.post({
      currentPassword: currentPassword.value,
      newPassword: newPassword.value,
    })
    if (failure) throw failure
    currentPassword.value = newPassword.value = confirmation.value = ""
    auth.signOut()
    access.reset()
    clearAccessRoutes()
    await router.replace({ name: "login", query: { passwordChanged: "1" } })
  } catch (cause) {
    error.value = describeApiError(cause)
  } finally {
    submitting.value = false
  }
}
</script>
<template>
  <div class="p-4 space-y-4">
    <PageHeader title="修改密码" />
    <Card class="max-w-xl">
      <CardHeader
        ><CardTitle
          class="text-base font-semibold tracking-[0.08em] text-muted-foreground uppercase"
          >密码</CardTitle
        ></CardHeader
      >
      <CardContent>
        <p v-if="auth.user?.mustChangePassword" class="mb-4 text-sm text-muted-foreground">
          密码已被重置，请修改后继续使用。
        </p>
        <form novalidate class="space-y-5" @submit.prevent="submit">
          <FieldGroup class="gap-7">
            <Field :data-invalid="Boolean(errors.currentPassword)">
              <FieldLabel for="current-password">当前密码</FieldLabel>
              <Input
                id="current-password"
                v-model="currentPassword"
                type="password"
                autocomplete="current-password"
                :aria-invalid="Boolean(errors.currentPassword)"
              />
              <FieldError v-if="errors.currentPassword">{{ errors.currentPassword }}</FieldError>
            </Field>
            <Field :data-invalid="Boolean(errors.newPassword)">
              <FieldLabel for="new-password">新密码</FieldLabel>
              <Input
                id="new-password"
                v-model="newPassword"
                type="password"
                autocomplete="new-password"
                :aria-invalid="Boolean(errors.newPassword)"
              />
              <FieldError v-if="errors.newPassword">{{ errors.newPassword }}</FieldError>
            </Field>
            <Field :data-invalid="Boolean(errors.confirmation)">
              <FieldLabel for="confirm-password">确认新密码</FieldLabel>
              <Input
                id="confirm-password"
                v-model="confirmation"
                type="password"
                autocomplete="new-password"
                :aria-invalid="Boolean(errors.confirmation)"
              />
              <FieldError v-if="errors.confirmation">{{ errors.confirmation }}</FieldError>
            </Field>
          </FieldGroup>
          <p v-if="error" role="alert" class="text-sm text-destructive">{{ error }}</p>
          <Button type="submit" :disabled="submitting">{{
            submitting ? "修改中…" : "确认修改"
          }}</Button>
        </form>
      </CardContent>
    </Card>
  </div>
</template>
