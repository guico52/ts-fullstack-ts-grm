/**
 * The list/paging/remove state every RBAC page needs.
 *
 * A composable rather than a store: it is parameterised by the caller's
 * source (each resource has its own typed API calls) and its state belongs
 * to one page, so a module-level singleton would be wrong. `lib/` cannot
 * hold it — that layer is deliberately Vue-free.
 */
import { computed, onMounted, ref, watch, type Ref } from "vue"

import { describeApiError } from "@/lib/api"
import { DEFAULT_PAGE_SIZE, pageInfoOf, type PageSize } from "@/lib/pagination"

export interface ResourceSource<T> {
  /** One page of rows, plus the total the server counted. */
  list: (query: { limit: number; offset: number }) => Promise<{ rows: T[]; total: number }>
  remove: (id: string) => Promise<void>
}

export interface ResourceOptions {
  /**
   * Rows per request. A tree wants everything in one go — it has no page to
   * navigate to — so it asks for more and renders no paginator.
   */
  pageSize?: PageSize
}

export function useResource<T>(source: ResourceSource<T>, options: ResourceOptions = {}) {
  const rows = ref([]) as Ref<T[]>
  const total = ref(0)
  const page = ref(1)
  const pageSize = ref<PageSize>(options.pageSize ?? DEFAULT_PAGE_SIZE)
  const loading = ref(false)
  /** Failures that have nowhere better to go — loading the list, deleting a row. */
  const error = ref<string | null>(null)

  const offset = computed(() => (page.value - 1) * pageSize.value)
  const pageInfo = computed(() => pageInfoOf(total.value, pageSize.value, offset.value))

  async function load(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const result = await source.list({ limit: pageSize.value, offset: offset.value })
      rows.value = result.rows
      total.value = result.total
      // Deleting the last row of the last page leaves the page number
      // pointing past the end; pull it back so the control and the table
      // agree about where we are.
      if (pageInfo.value.page !== page.value) page.value = pageInfo.value.page
    } catch (cause) {
      error.value = describeApiError(cause)
      rows.value = []
      total.value = 0
    } finally {
      loading.value = false
    }
  }

  async function remove(id: string): Promise<void> {
    await source.remove(id)
    await load()
  }

  watch([page, pageSize], () => {
    void load()
  })

  onMounted(() => {
    void load()
  })

  return { rows, total, page, pageSize, pageInfo, loading, error, load, remove }
}
