import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { GoogleGenAI } from '@google/genai'

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
    
    const recentHalfDays = Math.ceil(days / 2)
    const priorHalfDays = days - recentHalfDays

    const now = new Date()
    const recentStart = new Date(now)
    recentStart.setDate(recentStart.getDate() - recentHalfDays)
    
    const priorStart = new Date(recentStart)
    priorStart.setDate(priorStart.getDate() - priorHalfDays)

    // Fetch order items with menu item names
    const { data: items, error } = await supabase
      .from('order_items')
      .select('quantity, menu_items(name), orders!inner(created_at)')
      .gte('orders.created_at', priorStart.toISOString())

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const recentDishMap: Record<string, number> = {}
    const priorDishMap: Record<string, number> = {}
    const totalDishMap: Record<string, number> = {}

    // Aggregate demand per dish — Supabase returns joined rows as arrays
    items?.forEach((item: { quantity: number; menu_items: { name: string }[] | { name: string } | null; orders: { created_at: string } | { created_at: string }[] | null }) => {
      const menuItem = Array.isArray(item.menu_items) ? item.menu_items[0] : item.menu_items
      const name = menuItem?.name ?? 'Unknown'
      
      const order = Array.isArray(item.orders) ? item.orders[0] : item.orders
      const isRecent = order?.created_at && new Date(order.created_at) >= recentStart

      totalDishMap[name] = (totalDishMap[name] ?? 0) + item.quantity
      if (isRecent) {
        recentDishMap[name] = (recentDishMap[name] ?? 0) + item.quantity
      } else {
        priorDishMap[name] = (priorDishMap[name] ?? 0) + item.quantity
      }
    })

    if (Object.keys(totalDishMap).length === 0) {
      return NextResponse.json({
        forecastData: [],
        stars: [],
        deadweight: [],
        feedbackSummary: "Not enough data yet"
      })
    }

    const sortedDishes = Object.entries(totalDishMap).sort(([, a], [, b]) => b - a)
    const dishSummary = sortedDishes.map(([name, qty]) => `${name}: ${qty} units`).join('\n')

    // Fetch Feedback
    const { data: feedbackData } = await supabase
      .from('feedback')
      .select('thumbs_up, comment, menu_items(name)')
      .gte('created_at', priorStart.toISOString())
      .order('created_at', { ascending: false })
      .limit(30)

    let feedbackContext = ""
    let hasFeedback = false
    if (feedbackData && feedbackData.length > 0) {
       hasFeedback = true
       const up = feedbackData.filter(f => f.thumbs_up === true).length
       const down = feedbackData.filter(f => f.thumbs_up === false).length
       const comments = feedbackData.filter(f => f.comment).map(f => {
           const dishNameObj = Array.isArray(f.menu_items) ? f.menu_items[0] : f.menu_items
           const dishName = dishNameObj?.name
           return `- ${dishName ? `[${dishName}] ` : ''}${f.comment}`
       }).join('\n')

       feedbackContext = `Customer Feedback (Last ${days} days):\nThumbs up: ${up}\nThumbs down: ${down}\nRecent comments:\n${comments}`
    }

    const prompt = `You are a restaurant operations AI assistant.

Here is the order data for the last ${days} days (dish name: units sold):
${dishSummary}
${hasFeedback ? `\n${feedbackContext}\n` : ''}
Based on this data, provide:
1. For each of the top 6 dishes by volume, a predicted units count for tomorrow and a short "reason" string (max ~12 words) explaining why.
2. Top 3 "star dishes" (high demand, keep well-stocked).
3. Top 2 "dead-weight dishes" (very low demand, consider removing).
${hasFeedback ? '4. A short one-paragraph summary of the customer feedback (feedbackSummary).' : ''}

CRITICAL: A dish must NEVER appear in both "stars" and "deadweight". These two lists must be mutually exclusive with zero overlap.

Respond ONLY with valid JSON in this exact format (no markdown, no code fences):
{
  "forecastData": [
    {"dish": "Dish A", "predictedUnits": 12, "reason": "Consistent high volume"}
  ],
  "stars": ["Dish A", "Dish B", "Dish C"],
  "deadweight": ["Dish X", "Dish Y"]${hasFeedback ? ',\n  "feedbackSummary": "Overall positive..."' : ''}
}`

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

    // Trend logic
    if (parsed.forecastData) {
       parsed.forecastData.forEach((f: { dish: string; trend: string }) => {
           const recent = recentDishMap[f.dish] || 0
           const prior = priorDishMap[f.dish] || 0
           if (recent > prior * 1.15) f.trend = 'up'
           else if (recent < prior * 0.85) f.trend = 'down'
           else f.trend = 'flat'
       })
    }

    if (!hasFeedback) {
       parsed.feedbackSummary = "Not enough feedback data yet"
    }

    return NextResponse.json(parsed)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to generate insights' },
      { status: 500 }
    )
  }
}
