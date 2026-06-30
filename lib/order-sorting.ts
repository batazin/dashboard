export const ORDER_STATUS_PRIORITY: Record<string, number> = {
  NEW: 0,
  IN_ANALYSIS: 1,
  IN_PROGRESS: 2,
  WAITING_CLIENT: 3,
  WAITING_CONFIRMATION: 4,
  FINISHED: 5,
  CANCELLED: 6,
}

type SortableOrder = {
  id: string
  status: string
  createdAt: Date | string
}

export function compareOrdersByStatusPriority(a: SortableOrder, b: SortableOrder) {
  const statusDifference =
    (ORDER_STATUS_PRIORITY[a.status] ?? Number.MAX_SAFE_INTEGER) -
    (ORDER_STATUS_PRIORITY[b.status] ?? Number.MAX_SAFE_INTEGER)

  if (statusDifference !== 0) return statusDifference

  const dateDifference =
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()

  if (dateDifference !== 0) return dateDifference

  return a.id.localeCompare(b.id)
}
