<script setup lang="ts">
import { ref, watch } from "vue"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { api, describeApiError } from "@/lib/api"
import { validatePassword } from "@/lib/password"
const props = defineProps<{ userId: string; label: string }>()
const open = defineModel<boolean>("open", { default: false })
const newPassword = ref("")
const confirmation = ref("")
const errors = ref<Record<string, string>>({})
const error = ref<string | null>(null)
const submitting = ref(false)
watch(open, () => {
  newPassword.value = confirmation.value = ""
  errors.value = {}
  error.value = null
})
async function submit() {
  errors.value = validatePassword(newPassword.value, confirmation.value)
  if (Object.keys(errors.value).length) return
  submitting.value = true
  error.value = null
  try {
    const { error: failure } = await api.rbac
      .users({ id: props.userId })
      .password.post({ newPassword: newPassword.value })
    if (failure) throw failure
    open.value = false
  } catch (cause) {
    error.value = describeApiError(cause)
  } finally {
    submitting.value = false
  }
}
</script>
<template>
  <Dialog v-model:open="open">
    <DialogContent size="md">
      <DialogHeader
        ><DialogTitle>重置「{{ label }}」的密码</DialogTitle
        ><DialogDescription
          >旧会话将失效，用户下次登录必须修改密码。</DialogDescription
        ></DialogHeader
      >
      <form novalidate class="space-y-5" @submit.prevent="submit">
        <FieldGroup class="gap-5">
          <Field :data-invalid="Boolean(errors.newPassword)">
            <FieldLabel for="reset-password">临时密码</FieldLabel>
            <Input
              id="reset-password"
              v-model="newPassword"
              type="password"
              autocomplete="new-password"
              :aria-invalid="Boolean(errors.newPassword)"
            />
            <FieldError v-if="errors.newPassword">{{ errors.newPassword }}</FieldError>
          </Field>
          <Field :data-invalid="Boolean(errors.confirmation)">
            <FieldLabel for="reset-confirmation">确认临时密码</FieldLabel>
            <Input
              id="reset-confirmation"
              v-model="confirmation"
              type="password"
              autocomplete="new-password"
              :aria-invalid="Boolean(errors.confirmation)"
            />
            <FieldError v-if="errors.confirmation">{{ errors.confirmation }}</FieldError>
          </Field>
        </FieldGroup>
        <p v-if="error" role="alert" class="text-sm text-destructive">{{ error }}</p>
        <div class="flex justify-end gap-2">
          <Button variant="outline" type="button" :disabled="submitting" @click="open = false"
            >取消</Button
          ><Button type="submit" :disabled="submitting">{{
            submitting ? "重置中…" : "确认重置"
          }}</Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>
</template>
