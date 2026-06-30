import { compareOrdersByStatusPriority } from "@/lib/order-sorting"

describe("order status sorting", () => {
  it("places every in-progress order before waiting-confirmation orders", () => {
    const orders = [
      { id: "waiting-newer", status: "WAITING_CONFIRMATION", createdAt: "2026-06-30T14:23:00Z" },
      { id: "progress-older", status: "IN_PROGRESS", createdAt: "2026-06-30T11:39:00Z" },
      { id: "waiting-older", status: "WAITING_CONFIRMATION", createdAt: "2026-06-30T11:44:00Z" },
      { id: "progress-newer", status: "IN_PROGRESS", createdAt: "2026-06-30T12:00:00Z" },
    ]

    expect(orders.sort(compareOrdersByStatusPriority).map((order) => order.id)).toEqual([
      "progress-newer",
      "progress-older",
      "waiting-newer",
      "waiting-older",
    ])
  })

  it("keeps the newest orders first inside the same status", () => {
    const orders = [
      { id: "older", status: "IN_PROGRESS", createdAt: "2026-06-29T12:00:00Z" },
      { id: "newer", status: "IN_PROGRESS", createdAt: "2026-06-30T12:00:00Z" },
    ]

    expect(orders.sort(compareOrdersByStatusPriority).map((order) => order.id)).toEqual([
      "newer",
      "older",
    ])
  })
})
