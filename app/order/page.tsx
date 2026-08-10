'use client'

/**
 * CP2: Live Menu page (customer-facing)
 * - Fetches menu items from Supabase
 * - Subscribes to Realtime changes on menu_items table
 * - Cart stored in localStorage
 * - Category filter tabs
 */

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { MenuItem, CartItem } from '@/types'
import MenuItemCard from '@/components/MenuItemCard'
import Navbar from '@/components/Navbar'
import { PageLoader } from '@/components/LoadingSpinner'
import Link from 'next/link'

function loadCart(): CartItem[] {
  try {
    return JSON.parse(localStorage.getItem('tableflow_cart') || '[]')
  } catch {
    return []
  }
}

function saveCart(cart: CartItem[]) {
  localStorage.setItem('tableflow_cart', JSON.stringify(cart))
}

export default function OrderPage() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState<string>('all')

  // Fetch menu items
  const fetchMenu = useCallback(async () => {
    const { data } = await supabase
      .from('menu_items')
      .select('*')
      .eq('is_available', true)
      .eq('is_active', true)
      .order('category')
      .order('name')
    setMenuItems((data as MenuItem[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    setCart(loadCart())
    fetchMenu()

    // Realtime subscription — live menu updates (CP2)
    const channel = supabase
      .channel('menu_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items' }, () => {
        fetchMenu()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchMenu])

  const categories = ['all', ...Array.from(new Set(menuItems.map((i) => i.category)))]
  const filtered = activeCategory === 'all' ? menuItems : menuItems.filter((i) => i.category === activeCategory)

  function addToCart(item: MenuItem) {
    setCart((prev) => {
      const existing = prev.find((c) => c.menuItem.id === item.id)
      const updated = existing
        ? prev.map((c) => c.menuItem.id === item.id ? { ...c, quantity: c.quantity + 1 } : c)
        : [...prev, { menuItem: item, quantity: 1 }]
      saveCart(updated)
      return updated
    })
  }

  function removeFromCart(item: MenuItem) {
    setCart((prev) => {
      const updated = prev
        .map((c) => c.menuItem.id === item.id ? { ...c, quantity: c.quantity - 1 } : c)
        .filter((c) => c.quantity > 0)
      saveCart(updated)
      return updated
    })
  }

  const cartCount = cart.reduce((sum, c) => sum + c.quantity, 0)

  if (loading) return <PageLoader />

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white">Menu</h1>
            <p className="text-gray-400 text-sm mt-0.5">Fresh items, updated in real time</p>
          </div>
          {cartCount > 0 && (
            <Link
              href="/order/cart"
              className="flex items-center gap-2 px-4 py-2 bg-accent-indigo hover:bg-accent-indigo-hover text-white rounded-xl transition-all font-medium"
            >
              🛒 Cart
              <span className="bg-white text-accent-indigo text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                {cartCount}
              </span>
            </Link>
          )}
        </div>

        {/* Category tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-hide">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                activeCategory === cat
                  ? 'bg-accent-indigo text-white'
                  : 'bg-transparent border border-surface-border text-text-secondary hover:bg-surface'
              }`}
            >
              {cat === 'all' ? 'All Items' : cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <div className="text-4xl mb-3">🍽️</div>
            <p>No items available right now. Check back soon!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.map((item) => (
              <MenuItemCard
                key={item.id}
                item={item}
                cartItem={cart.find((c) => c.menuItem.id === item.id)}
                onAdd={addToCart}
                onRemove={removeFromCart}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
