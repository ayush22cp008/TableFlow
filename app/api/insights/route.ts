import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { GoogleGenAI } from '@google/genai'

/**
 * CP7: AI Insights API Route
 * POST /api/insights
 * Body: { days: number }
 *
 * Queries order history → builds prompt → calls Gemini → returns structured JSON.
 * Requires GEMINI_API_KEY in .env.local
 *
 * Uses @google/genai (new unified SDK):
 *   new GoogleGenAI({ apiKey })
 *   ai.models.generateContent({ model, contents })
 *   response.text  ← getter, not a method call
 */
export async function POST(request: Request) {
  try {
    const { days = 7 } = await request.json()

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY not configured in .env.local' },
        { status: 503 }
      )
    }

    const supabase = createClient()
    const weekStart = new Date()
    weekStart.setDate(weekStart.getDate() - days)

    // Fetch order items with menu item names
    const { data: items, error } = await supabase
      .from('order_items')
      .select('quantity, menu_items(name), orders!inner(created_at)')
      .gte('orders.created_at', weekStart.toISOString())

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Aggregate demand per dish — Supabase returns joined rows as arrays
    const dishMap: Record<string, number> = {}
    items?.forEach((item: { quantity: number; menu_items: { name: string }[] | { name: string } | null }) => {
      const menuItem = Array.isArray(item.menu_items) ? item.menu_items[0] : item.menu_items
      const name = menuItem?.name ?? 'Unknown'
      dishMap[name] = (dishMap[name] ?? 0) + item.quantity
    })

    if (Object.keys(dishMap).length === 0) {
      return NextResponse.json({
        forecastData: [],
        stars: [],
        deadweight: [],
      })
    }

    const sortedDishes = Object.entries(dishMap).sort(([, a], [, b]) => b - a)
    const dishSummary = sortedDishes.map(([name, qty]) => `${name}: ${qty} units`).join('\n')

    const prompt = `You are a restaurant operations AI assistant.

Here is the order data for the last ${days} days (dish name: units sold):
${dishSummary}

Based on this data, provide:
1. For each of the top 6 dishes by volume, a predicted units count for tomorrow and a trend ("up", "down", or "flat") vs the recent period.
2. Top 3 "star dishes" (high demand, keep well-stocked).
3. Top 2 "dead-weight dishes" (very low demand, consider removing).

CRITICAL: A dish must NEVER appear in both "stars" and "deadweight". These two lists must be mutually exclusive with zero overlap.

Respond ONLY with valid JSON in this exact format (no markdown, no code fences):
{
  "forecastData": [
    {"dish": "Dish A", "predictedUnits": 12, "trend": "up"}
  ],
  "stars": ["Dish A", "Dish B", "Dish C"],
  "deadweight": ["Dish X", "Dish Y"]
}`

    // @google/genai new SDK:
    // - Constructor: new GoogleGenAI({ apiKey })
    // - Call: ai.models.generateContent({ model, contents })
    // - Result: response.text (getter, not a function)
    const ai = new GoogleGenAI({ apiKey })
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    })

    const text = (response.text ?? '').replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed = JSON.parse(text)

    // Code-level safety net: filter deadweight to remove any dish name also present in stars
    if (parsed.stars && parsed.deadweight) {
      const lowerStars = parsed.stars.map((s: string) => s.toLowerCase())
      parsed.deadweight = parsed.deadweight.filter((d: string) => !lowerStars.includes(d.toLowerCase()))
    }

    return NextResponse.json(parsed)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to generate insights' },
      { status: 500 }
    )
  }
}
