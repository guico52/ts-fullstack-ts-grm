<script setup lang="ts">
import { computed, ref, watch } from "vue"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Switch } from "@/components/ui/switch"
import { describeApiError } from "@/lib/api"
import {
  toRequestBody,
  validateResource,
  type FieldOption,
  type ResourceField,
  type ResourceSpec,
} from "@/lib/rbac"

/**
 * One dialog for all five resources: the fields come from the resource's
 * spec, so a new column never means a new form.
 *
 * The reference pickers are native `<select>` on purpose — Reka's Select
 * cannot hold an empty value, and "leave it blank" is a real state here
 * (no parent view, or keep the current password).
 */
const props = defineProps<{
  open: boolean
  spec: ResourceSpec
  /** null creates; a row edits. */
  record: Record<string, unknown> | null
  /** Candidates for relational fields, keyed by field. */
  options?: Record<string, FieldOption[]>
  save: (body: Record<string, unknown>, id: string | null) => Promise<void>
}>()

const emit = defineEmits<{
  "update:open": [boolean]
  saved: []
}>()

const values = ref<Record<string, unknown>>({})
const errors = ref<Record<string, string>>({})
const submitError = ref<string | null>(null)
const submitting = ref(false)
/** Errors stay quiet until the first submit; after that, feedback is live. */
const submitted = ref(false)

const mode = computed<"create" | "update">(() => (props.record === null ? "create" : "update"))
const editingId = computed(() => (props.record === null ? null : String(props.record.id)))

function blankValues(spec: ResourceSpec): Record<string, unknown> {
  const draft: Record<string, unknown> = {}
  for (const field of spec.fields) {
    if (field.kind === "boolean") draft[field.key] = true
    else if (field.kind === "links") draft[field.key] = []
    else draft[field.key] = ""
  }
  return draft
}

// Re-seed the draft on every open: an abandoned edit must not leak into the
// next one, which is the bug that makes a create form open with stale values.
watch(
  () => props.open,
  (open) => {
    if (!open) return
    values.value = props.record === null ? blankValues(props.spec) : props.spec.toForm(props.record)
    errors.value = {}
    submitError.value = null
    submitted.value = false
  },
)

watch(
  values,
  () => {
    if (submitted.value) errors.value = validateResource(props.spec, values.value, mode.value)
  },
  { deep: true },
)

function choices(field: ResourceField): FieldOption[] {
  if (field.options) return [...field.options]
  return props.options?.[field.key] ?? []
}

function selectedIds(field: ResourceField): string[] {
  const value = values.value[field.key]
  return Array.isArray(value) ? value.map(String) : []
}

function toggleLink(field: ResourceField, id: string, checked: boolean): void {
  const next = new Set(selectedIds(field))
  if (checked) next.add(id)
  else next.delete(id)
  values.value[field.key] = [...next]
}

async function submit(): Promise<void> {
  submitted.value = true
  errors.value = validateResource(props.spec, values.value, mode.value)
  if (Object.keys(errors.value).length > 0) return

  submitting.value = true
  submitError.value = null
  try {
    await props.save(toRequestBody(props.spec, values.value, mode.value), editingId.value)
    emit("update:open", false)
    emit("saved")
  } catch (cause) {
    submitError.value = describeApiError(cause)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <Dialog :open="open" @update:open="(value: boolean) => emit('update:open', value)">
    <DialogContent class="sm:max-w-lg" draggable>
      <!-- The footer lives inside the form so Enter submits and the confirm
           button can be type="submit", per the form conventions. -->
      <form class="space-y-5" @submit.prevent="submit">
        <DialogHeader>
          <DialogTitle>
            {{ mode === "create" ? `新建${spec.singular}` : `编辑${spec.singular}` }}
          </DialogTitle>
          <DialogDescription>{{ spec.subtitle }}</DialogDescription>
        </DialogHeader>

        <FieldGroup class="gap-5">
          <Field
            v-for="field in spec.fields"
            :key="field.key"
            :data-invalid="Boolean(errors[field.key])"
          >
            <FieldLabel :for="`field-${field.key}`">{{ field.label }}</FieldLabel>

            <Input
              v-if="field.kind === 'text' || field.kind === 'email' || field.kind === 'number'"
              :id="`field-${field.key}`"
              :type="field.kind === 'number' ? 'number' : field.kind === 'email' ? 'email' : 'text'"
              :model-value="String(values[field.key] ?? '')"
              :placeholder="field.placeholder"
              :aria-invalid="Boolean(errors[field.key])"
              @update:model-value="(value: string | number) => (values[field.key] = value)"
            />

            <div v-else-if="field.kind === 'boolean'" class="flex items-center gap-3">
              <Switch
                :id="`field-${field.key}`"
                :model-value="values[field.key] === true"
                @update:model-value="(value: boolean) => (values[field.key] = value)"
              />
              <span class="text-sm text-muted-foreground">
                {{ values[field.key] === true ? "启用" : "停用" }}
              </span>
            </div>

            <NativeSelect
              v-else-if="field.kind === 'select'"
              :id="`field-${field.key}`"
              :model-value="String(values[field.key] ?? '')"
              :aria-invalid="Boolean(errors[field.key])"
              @update:model-value="values[field.key] = $event"
            >
              <!-- An empty option is a real choice here: no parent view, or
                   "pick one" before the field is filled in. -->
              <NativeSelectOption value="">
                {{ field.required ? "请选择…" : "（留空）" }}
              </NativeSelectOption>
              <NativeSelectOption
                v-for="option in choices(field)"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </NativeSelectOption>
            </NativeSelect>

            <div
              v-else-if="field.kind === 'links'"
              class="max-h-48 space-y-2 overflow-auto rounded-md border border-input p-3"
            >
              <label
                v-for="option in choices(field)"
                :key="option.value"
                class="flex items-center gap-2 text-sm"
              >
                <input
                  type="checkbox"
                  class="size-4 accent-primary"
                  :checked="selectedIds(field).includes(option.value)"
                  @change="
                    toggleLink(
                      field,
                      option.value,
                      ($event.target as HTMLInputElement).checked,
                    )
                  "
                />
                <span>{{ option.label }}</span>
              </label>
              <p v-if="choices(field).length === 0" class="text-sm text-muted-foreground">
                暂无可选项。
              </p>
            </div>

            <FieldDescription v-if="field.hint">{{ field.hint }}</FieldDescription>
            <FieldError v-if="errors[field.key]">{{ errors[field.key] }}</FieldError>
          </Field>
        </FieldGroup>

        <p v-if="submitError" role="alert" class="text-sm text-destructive">{{ submitError }}</p>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            :disabled="submitting"
            @click="emit('update:open', false)"
          >
            取消
          </Button>
          <Button type="submit" :disabled="submitting">
            {{ submitting ? "保存中…" : "保存" }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
