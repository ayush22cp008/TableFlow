export function formatOrderNumber(order: { id: string; daily_number?: number | null; is_priority?: boolean }): string {
  return order.daily_number
    ? `${order.is_priority ? 'R' : 'W'}${order.daily_number}`
    : `#${order.id.slice(0, 6)}`;
}
