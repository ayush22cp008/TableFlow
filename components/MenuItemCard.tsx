import { MenuItem, CartItem } from '@/types'

interface MenuItemCardProps {
  item: MenuItem
  cartItem?: CartItem
  onAdd: (item: MenuItem) => void
  onRemove: (item: MenuItem) => void
}

export default function MenuItemCard({ item, cartItem, onAdd, onRemove }: MenuItemCardProps) {
  const qty = cartItem?.quantity ?? 0

  return (
    <div className="bg-surface border border-surface-border rounded-card shadow-card overflow-hidden hover:border-accent-indigo/50 transition-colors group">
      {item.image_url && (
        <div className="h-40 overflow-hidden bg-gray-800">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.image_url}
            alt={item.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>
      )}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-semibold text-white text-sm leading-snug">{item.name}</h3>
          <span className="text-accent-amber font-bold text-sm whitespace-nowrap">₹{item.price.toFixed(2)}</span>
        </div>
        {item.description && (
          <p className="text-gray-400 text-xs mb-3 line-clamp-2">{item.description}</p>
        )}

        {qty === 0 ? (
          <button
            onClick={() => onAdd(item)}
            className="w-full py-2 bg-accent-indigo hover:bg-accent-indigo-hover text-white text-sm font-medium rounded-lg transition-all"
          >
            Add to Cart
          </button>
        ) : (
          <div className="flex items-center justify-between">
            <button
              onClick={() => onRemove(item)}
              className="w-8 h-8 flex items-center justify-center bg-transparent border border-surface-border text-text-secondary hover:bg-surface rounded-lg transition-all font-bold"
            >
              −
            </button>
            <span className="text-white font-semibold">{qty}</span>
            <button
              onClick={() => onAdd(item)}
              className="w-8 h-8 flex items-center justify-center bg-accent-indigo hover:bg-accent-indigo-hover text-white rounded-lg transition-all font-bold"
            >
              +
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
