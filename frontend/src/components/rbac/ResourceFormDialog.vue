<script setup lang="ts">
import { computed, ref, watch } from "vue"

import IconPicker from "@/components/rbac/IconPicker.vue"
import { Button } from "@/components/ui/button"
import { Combobox } from "@/components/ui/combobox"
import { MultiSelect } from "@/components/ui/multi-select"
import { TreeSelect } from "@/components/ui/tree-select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { describeApiError } from "@/lib/api"
import type { DialogSize } from "@/lib/dialog-sizes"
import { VIEW_COMPONENTS } from "@/lib/views-catalog"
import {
  toRequestBody,
  validateResource,
  type FieldOption,
  type ResourceField,
  type ResourceRow,
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
  /**
   * The rows the page is showing. A field's `auto` rule may need them — a
   * view's order is a position among siblings, which only the list knows.
   */
  rows?: readonly ResourceRow[]
  /**
   * Values to open a **new** record with, overriding the blanks.
   *
   * Used by "add a page under this menu": the parent, the kind and the order
   * are already decided by where the button was, so the form opens with them
   * filled rather than asking again.
   */
  seed?: Record<string, unknown> | null
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

/**
 * Fields grouped by `legend`, in declaration order.
 *
 * A field **with** a legend starts a new section; a field without one joins
 * whatever section is open. That is what lets a section hold several fields
 * while only its first carries a heading.
 */
const groups = computed(() => {
  const out: Array<{ legend?: string; fields: ResourceField[] }> = []
  for (const field of props.spec.fields) {
    // A field the current kind of record has no use for is not shown at all —
    // not shown and disabled, which would leave a dead control on screen.
    if (field.visibleWhen && !field.visibleWhen(values.value)) continue
    if (field.legend !== undefined) {
      out.push({ legend: field.legend, fields: [field] })
      continue
    }
    const open = out[out.length - 1]
    if (open) open.fields.push(field)
    else out.push({ legend: undefined, fields: [field] })
  }
  return out
})

/**
 * A dialog with paired fields has to be wider, or the pairing backfires:
 * two half-width inputs in a 512px dialog come out at 221px each, narrower
 * than the single full-width input they replaced.
 */
const dialogSize = computed<DialogSize>(() => {
  if (props.spec.width) return props.spec.width
  return props.spec.fields.some((field) => field.span === 1) ? "xl" : "md"
})

/** Fields the user has typed into; their `auto` rule stops applying. */
const touched = ref<Set<string>>(new Set())

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
    values.value =
      props.record === null
        ? { ...blankValues(props.spec), ...(props.seed ?? {}) }
        : props.spec.toForm(props.record)
    errors.value = {}
    submitError.value = null
    submitted.value = false
    touched.value = new Set()
    applyAuto()
  },
)

watch(
  values,
  () => {
    if (submitted.value) errors.value = validateResource(props.spec, values.value, mode.value)
    applyAuto()
  },
  { deep: true },
)

/**
 * Fill in every `auto` field that the user has not typed into.
 *
 * Converges: the rule is a pure function of the current values, so writing
 * its result changes nothing on the next pass and the watch settles.
 */
function applyAuto(): void {
  for (const field of props.spec.fields) {
    if (!field.auto || touched.value.has(field.key)) continue
    const next = field.auto(values.value, props.rows ?? [])
    if (next !== values.value[field.key]) values.value[field.key] = next
  }
}

/** The view catalogue as picker options: the file on the left, its route on the right. */
const COMPONENT_OPTIONS = VIEW_COMPONENTS.map((component) => ({
  value: component.path,
  label: component.path,
  hint: component.route,
}))

function choices(field: ResourceField): FieldOption[] {
  const base: readonly FieldOption[] = field.options ?? props.options?.[field.key] ?? []
  // The resource may narrow a picker to what the current draft allows — a
  // page's parent must be a menu, a button's must be a page.
  return props.spec.narrowOptions
    ? [...props.spec.narrowOptions(field, base, values.value)]
    : [...base]
}

function selectedIds(field: ResourceField): string[] {
  const value = values.value[field.key]
  return Array.isArray(value) ? value.map(String) : []
}

/**
 * Write a value, plus whatever else it implies.
 *
 * Picking a component fills three columns at once: the file becomes
 * `componentPath`, its name becomes `componentName`, and its kebab-case form
 * becomes the route. One click instead of three typed strings that can
 * disagree with each other.
 */
function setField(field: ResourceField, value: unknown): void {
  // Typing into a field takes it out of automatic control.
  touched.value.add(field.key)
  values.value[field.key] = value
  if (typeof value === "string" && field.derive) {
    Object.assign(values.value, field.derive(value))
  }
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
    <DialogContent :size="dialogSize" draggable>
      <!-- `novalidate` 不是可选项。浏览器自己的校验（`type="email"` 的格式、
           `type="number"` 的 step）在失败时**不派发 submit**，于是这里的校验
           与错误提示永远不会跑——症状就是一颗点了没反应的保存按钮。
           真正拦住非法值的是 `validateResource`，它会把话说出来。
           见 principles 第 19 条。

           footer 在这个 form 里面，所以主按钮是真的 `type="submit"`，回车能用。 -->
      <form class="space-y-5" novalidate @submit.prevent="submit">
        <DialogHeader>
          <DialogTitle>
            {{ mode === "create" ? `新建${spec.singular}` : `编辑${spec.singular}` }}
          </DialogTitle>
          <!-- 空描述：reka-ui 要求要么有描述、要么显式声明没有，而 Vue 的
               attr 传不了它认的 `undefined`。留一个空的、仅屏幕阅读器可见
               的槽位声明“无描述”——标题已经说了这个弹窗是什么。视觉上不
               存在，也就不构成界面上的解释（见 principles 第 21 条）。 -->
          <DialogDescription class="sr-only" />
        </DialogHeader>

        <div class="space-y-6">
          <FieldSet v-for="(group, index) in groups" :key="group.legend ?? index">
            <FieldLegend v-if="group.legend">{{ group.legend }}</FieldLegend>

            <!-- Two columns on a wide dialog: a short field like 排序 should
                 not take a full row from a long one like 名称. `span: 1`
                 opts into half width; everything else spans the row. -->
            <FieldGroup class="grid gap-5 sm:grid-cols-2">
              <Field
                v-for="field in group.fields"
                :key="field.key"
                :data-invalid="Boolean(errors[field.key])"
                :class="field.span === 1 ? undefined : 'sm:col-span-2'"
              >
                <FieldLabel :for="`field-${field.key}`">{{ field.label }}</FieldLabel>

                <Input
                  v-if="field.kind === 'text' || field.kind === 'email' || field.kind === 'number'"
                  :id="`field-${field.key}`"
                  :type="
                    field.kind === 'number' ? 'number' : field.kind === 'email' ? 'email' : 'text'
                  "
                  :model-value="String(values[field.key] ?? '')"
                  :placeholder="field.placeholder"
                  :step="field.kind === 'number' ? (field.step ?? 1) : undefined"
                  :aria-invalid="Boolean(errors[field.key])"
                  @update:model-value="(value: string | number) => setField(field, value)"
                />

                <IconPicker
                  v-else-if="field.kind === 'icon'"
                  :id="`field-${field.key}`"
                  :model-value="String(values[field.key] ?? '')"
                  @update:model-value="(value: string) => setField(field, value)"
                />

                <Combobox
                  v-else-if="field.kind === 'component'"
                  :id="`field-${field.key}`"
                  :model-value="String(values[field.key] ?? '')"
                  :options="COMPONENT_OPTIONS"
                  :invalid="Boolean(errors[field.key])"
                  placeholder="选择组件…"
                  search-placeholder="搜索组件，例如 users…"
                  empty-text="没有匹配的组件。"
                  @update:model-value="(value: string) => setField(field, value)"
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

                <Combobox
                  v-else-if="field.kind === 'select'"
                  :id="`field-${field.key}`"
                  :model-value="String(values[field.key] ?? '')"
                  :options="choices(field)"
                  :invalid="Boolean(errors[field.key])"
                  :clearable="field.clearable ?? !field.required"
                  :placeholder="field.required ? '请选择…' : '（留空）'"
                  @update:model-value="(value: string) => setField(field, value)"
                />

                <!-- One control per shape of data: a role's users are a flat set,
                 its permissions too, but its views are a tree. -->
                <TreeSelect
                  v-else-if="field.kind === 'links' && field.picker === 'tree'"
                  :id="`field-${field.key}`"
                  :model-value="selectedIds(field)"
                  :options="choices(field)"
                  :invalid="Boolean(errors[field.key])"
                  :placeholder="`选择${field.label}…`"
                  :search-placeholder="`搜索${field.label}…`"
                  @update:model-value="(value: string[]) => setField(field, value)"
                />

                <MultiSelect
                  v-else-if="field.kind === 'links'"
                  :id="`field-${field.key}`"
                  :model-value="selectedIds(field)"
                  :options="choices(field)"
                  :invalid="Boolean(errors[field.key])"
                  :placeholder="`选择${field.label}…`"
                  :search-placeholder="`搜索${field.label}…`"
                  @update:model-value="(value: string[]) => setField(field, value)"
                />

                <FieldError v-if="errors[field.key]">{{ errors[field.key] }}</FieldError>
              </Field>
            </FieldGroup>
          </FieldSet>
        </div>

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
