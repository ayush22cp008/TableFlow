import { supabase } from './supabase'
import {
  MenuItem,
  RestaurantTable,
  WaitlistEntry,
  Order,
  OrderWithItems,
  Feedback,
} from '@/types'

// ---- Menu ----

export async function getMenuItems(): Promise<MenuItem[]> {
  const { data, error } = await supabase
    .from('menu_items')
    .select('*')
    .eq('is_available', true)
    .eq('is_active', true)
    .order('category')
    .order('name')
  if (error) throw error
  return data as MenuItem[]
}

export async function getAllMenuItems(): Promise<MenuItem[]> {
  const { data, error } = await supabase
    .from('menu_items')
    .select('*')
    .eq('is_active', true)
    .order('category')
    .order('name')
  if (error) throw error
  return data as MenuItem[]
}

// ---- Tables ----

export async function getRestaurantTables(): Promise<RestaurantTable[]> {
  const { data, error } = await supabase
    .from('restaurant_tables')
    .select('*')
    .order('table_number')
  if (error) throw error
  return data as RestaurantTable[]
}

export async function updateTableStatus(
  tableId: string,
  status: RestaurantTable['status']
) {
  const { error } = await supabase
    .from('restaurant_tables')
    .update({ status })
    .eq('id', tableId)
  if (error) throw error
}

// ---- Waitlist ----

export async function getWaitlist(): Promise<WaitlistEntry[]> {
  const { data, error } = await supabase
    .from('waitlist')
    .select('*')
    .eq('status', 'waiting')
    .order('joined_at')
  if (error) throw error
  return data as WaitlistEntry[]
}

// ---- Orders ----

export async function getOrders(status?: Order['status']): Promise<Order[]> {
  let query = supabase.from('orders').select('*').order('created_at', { ascending: false })
  if (status) query = query.eq('status', status)
  const { data, error } = await query
  if (error) throw error
  return data as Order[]
}

export async function getOrderWithItems(orderId: string): Promise<OrderWithItems | null> {
  const { data, error } = await supabase
    .from('orders')
    .select(`*, order_items(*, menu_items(*))`)
    .eq('id', orderId)
    .single()
  if (error) throw error
  return data as OrderWithItems
}

export async function updateOrderStatus(orderId: string, status: Order['status']) {
  const { error } = await supabase
    .from('orders')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', orderId)
  if (error) throw error
}

// ---- Feedback ----

export async function submitFeedback(
  data: Pick<Feedback, 'order_id' | 'menu_item_id' | 'customer_id' | 'thumbs_up' | 'comment'>
) {
  const { error } = await supabase.from('feedback').insert(data)
  if (error) throw error
}

// ---- Analytics (owner-only) ----

export async function getAnalyticsSummary() {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  // Today's orders
  const { data: todayOrders } = await supabase
    .from('orders')
    .select('total, status')
    .gte('created_at', todayStart.toISOString())
    .neq('status', 'cancelled')

  const revenue = todayOrders?.reduce((sum, o) => sum + (o.total ?? 0), 0) ?? 0
  const orderCount = todayOrders?.length ?? 0
  const avgOrderValue = orderCount > 0 ? revenue / orderCount : 0

  // Top dishes today
  const { data: topDishes } = await supabase
    .from('order_items')
    .select(`quantity, menu_items(name)`)
    .gte('created_at' as never, todayStart.toISOString())

  // Aggregate top dishes client-side (simpler than a view for hackathon speed)
  const dishMap: Record<string, number> = {}
  topDishes?.forEach((item: { quantity: number; menu_items: { name: string }[] | { name: string } | null }) => {
    const menuItem = Array.isArray(item.menu_items) ? item.menu_items[0] : item.menu_items
    const name = menuItem?.name ?? 'Unknown'
    dishMap[name] = (dishMap[name] ?? 0) + item.quantity
  })
  const topDishList = Object.entries(dishMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }))

  return { revenue, orderCount, avgOrderValue, topDishes: topDishList }
}
