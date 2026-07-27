'use client'

/**
 * CP2: Owner menu management
 * - List all menu items (including unavailable)
 * - Add/Edit modal
 * - Availability toggle (live)
 * - Soft delete (is_active = false)
 */

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { MenuItem } from '@/types'
import Navbar from '@/components/Navbar'
import { PageLoader } from '@/components/LoadingSpinner'

const EMPTY_FORM = { name: '', description: '', price: '', category: 'general', image_url: '' }

export default function MenuManagementPage() {
  const [items, setItems] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<MenuItem | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchItems = useCallback(async () => {
    const { data } = await supabase
      .from('menu_items')
      .select('*')
      .eq('is_active', true)
      .order('category').order('name')
    setItems((data as MenuItem[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchItems() }, [fetchItems])

  function openAdd() {
    setEditItem(null)
    setForm(EMPTY_FORM)
    setError(null)
    setShowModal(true)
  }

  function openEdit(item: MenuItem) {
    setEditItem(item)
    setForm({ name: item.name, description: item.description ?? '', price: String(item.price), category: item.category, image_url: item.image_url ?? '' })
    setError(null)
    setShowModal(true)
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      price: parseFloat(form.price),
      category: form.category.trim() || 'general',
      image_url: form.image_url.trim() || null,
      updated_at: new Date().toISOString(),
    }

    if (editItem) {
      const { error: err } = await supabase.from('menu_items').update(payload).eq('id', editItem.id)
      if (err) { setError(err.message); setSaving(false); return }
    } else {
      const { error: err } = await supabase.from('menu_items').insert(payload)
      if (err) { setError(err.message); setSaving(false); return }
    }

    setSaving(false)
    setShowModal(false)
    fetchItems()
  }

  async function toggleAvailability(item: MenuItem) {
    await supabase.from('menu_items').update({ is_available: !item.is_available, updated_at: new Date().toISOString() }).eq('id', item.id)
    fetchItems()
  }

  async function softDelete(item: MenuItem) {
    if (!confirm(`Remove "${item.name}" from menu?`)) return
    await supabase.from('menu_items').update({ is_active: false }).eq('id', item.id)
    fetchItems()
  }

  if (loading) return <PageLoader />

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Menu Management</h1>
          <button onClick={openAdd} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-all">
            + Add Item
          </button>
        </div>

        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-4 p-4 bg-gray-900/50 border border-gray-800 rounded-xl">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-white truncate">{item.name}</p>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">{item.category}</span>
                </div>
                <p className="text-sm text-gray-400 mt-0.5">₹{item.price.toFixed(2)}{item.description && ` — ${item.description.slice(0, 60)}`}</p>
              </div>
              <div className="flex items-center gap-2">
                {/* Availability toggle */}
                <button
                  onClick={() => toggleAvailability(item)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all ${
                    item.is_available
                      ? 'bg-green-500/10 border-green-500/40 text-green-400 hover:bg-red-500/10 hover:border-red-500/40 hover:text-red-400'
                      : 'bg-red-500/10 border-red-500/40 text-red-400 hover:bg-green-500/10 hover:border-green-500/40 hover:text-green-400'
                  }`}
                >
                  {item.is_available ? 'Available' : 'Hidden'}
                </button>
                <button onClick={() => openEdit(item)} className="px-3 py-1 rounded-lg text-xs font-medium bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 transition-all">Edit</button>
                <button onClick={() => softDelete(item)} className="px-3 py-1 rounded-lg text-xs font-medium bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 transition-all">Remove</button>
              </div>
            </div>
          ))}
          {items.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <div className="text-4xl mb-3">🍽️</div>
              <p>No menu items yet. Add your first item!</p>
            </div>
          )}
        </div>

        {/* Add/Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-md space-y-4">
              <h2 className="text-xl font-bold">{editItem ? 'Edit Item' : 'Add Menu Item'}</h2>
              <div className="space-y-3">
                {[
                  { label: 'Name', key: 'name', placeholder: 'e.g. Butter Chicken', type: 'text' },
                  { label: 'Category', key: 'category', placeholder: 'e.g. main, starter, drinks', type: 'text' },
                  { label: 'Price (₹)', key: 'price', placeholder: '0.00', type: 'number' },
                  { label: 'Description', key: 'description', placeholder: 'Short description...', type: 'text' },
                  { label: 'Image URL', key: 'image_url', placeholder: 'https://...', type: 'url' },
                ].map(({ label, key, placeholder, type }) => (
                  <div key={key}>
                    <label className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
                    <input
                      type={type}
                      value={form[key as keyof typeof form]}
                      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                      placeholder={placeholder}
                      className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    />
                  </div>
                ))}
              </div>
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 text-white rounded-xl text-sm transition-all">Cancel</button>
                <button onClick={handleSave} disabled={saving || !form.name || !form.price} className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium disabled:opacity-50 transition-all">
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
