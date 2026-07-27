import { OrderStatus } from '@/types'

const statusConfig: Record<OrderStatus, { label: string; color: string }> = {
  placed:     { label: 'Order Placed',  color: 'bg-blue-500/20 text-blue-300 border-blue-500/40' },
  preparing:  { label: 'Preparing',     color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40' },
  ready:      { label: 'Ready',         color: 'bg-green-500/20 text-green-300 border-green-500/40' },
  served:     { label: 'Served',        color: 'bg-purple-500/20 text-purple-300 border-purple-500/40' },
  billed:     { label: 'Billed',        color: 'bg-gray-500/20 text-gray-300 border-gray-500/40' },
  cancelled:  { label: 'Cancelled',     color: 'bg-red-500/20 text-red-300 border-red-500/40' },
}

export default function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const cfg = statusConfig[status] ?? statusConfig.placed
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>
      {cfg.label}
    </span>
  )
}
