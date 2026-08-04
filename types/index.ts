// ============================================================
// TypeScript types for all VibeAthon DB tables
// ============================================================

export type UserRole = 'customer' | 'owner' | 'waiter' | 'cook' | 'manager'

export type InviteCode = {
  id: string
  code: string
  role: 'waiter' | 'cook' | 'manager'
  staff_name: string
  staff_email: string
  status: 'unused' | 'used' | 'expired'
  created_by: string
  created_at: string
}


export type ReservationRequest = {
  id: string
  customer_name: string
  party_size: number
  requested_time: string
  status: 'pending' | 'approved' | 'rejected' | 'arrived' | 'completed'
  unique_code: string | null
  table_id: string | null
  created_at: string
}

export type UserProfile = {
  id: string
  email: string
  role: UserRole
  created_at: string
}

// ---- Menu ----
export type MenuItem = {
  id: string
  name: string
  description: string | null
  price: number
  category: string
  image_url: string | null
  is_available: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

// ---- Tables ----
export type TableStatus = 'available' | 'occupied' | 'reserved'

export type RestaurantTable = {
  id: string
  table_number: number
  capacity: number
  occupied_seats: number
  status: TableStatus
  reserved_from?: string | null
  created_at: string
}

// ---- Waitlist ----
export type WaitlistStatus = 'waiting' | 'seated' | 'cancelled'

export type WaitlistEntry = {
  id: string
  customer_id: string | null
  customer_name: string
  party_size: number
  phone: string | null
  status: WaitlistStatus
  table_id: string | null
  joined_at: string
  seated_at: string | null
}

// ---- Orders ----
export type OrderStatus = 'placed' | 'preparing' | 'ready' | 'served' | 'billed' | 'cancelled'

export type Order = {
  id: string
  table_id: string | null
  customer_id: string | null
  status: OrderStatus
  subtotal: number
  service_charge_applied: boolean
  service_charge_amount: number
  total: number
  party_size?: number | null
  is_priority: boolean
  daily_number: number | null
  cancellation_reason?: string
  cancellation_category?: 'fire' | 'food_safety' | 'natural_disaster' | 'other' | 'manual'
  created_at: string
  updated_at: string
}

// ---- Order Items ----
export type OrderItem = {
  id: string
  order_id: string
  menu_item_id: string
  quantity: number
  unit_price: number
  item_total: number
  notes: string | null
}

// Order with items joined (for billing/display)
export type OrderWithItems = Order & {
  order_items: (OrderItem & { menu_items: MenuItem })[]
}

// ---- Feedback ----
export type Feedback = {
  id: string
  order_id: string | null
  menu_item_id: string | null
  customer_id: string | null
  thumbs_up: boolean | null
  comment: string | null
  created_at: string
}

// ---- Cart (client-only, localStorage) ----
export type CartItem = {
  menuItem: MenuItem
  quantity: number
  notes?: string
}
