'use client'

/**
 * CP7: AI Insights page (owner)
 * Calls /api/insights → Gemini API
 * Shows prep forecast, star dishes, dead-weight dishes
 * Wire up Day 3 once GEMINI_API_KEY is set.
 */

import { useState } from 'react'
import Navbar from '@/components/Navbar'

interface InsightResult {
  forecastData: { dish: string; predictedUnits: number; trend: 'up' | 'down' | 'flat'; reason: string }[]
  stars: string[]
  deadweight: string[]
  feedbackSummary: string
}

export default function InsightsPage() {
  const [result, setResult] = useState<InsightResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function generateInsights() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: 7 }),
      })
      if (!res.ok) throw new Error(await res.text())
      setResult(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-10">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">🤖</span>
          <h1 className="text-2xl font-extrabold tracking-tight">AI Insights</h1>
        </div>
        <p className="text-gray-400 mb-8">Gemini-powered demand forecasting and dish classification based on your order history.</p>

        <button
          onClick={generateInsights}
          disabled={loading}
          className="px-6 py-3 bg-accent-indigo hover:bg-accent-indigo-hover text-white font-medium rounded-xl transition-all disabled:opacity-50 shadow-[0_0_20px_rgba(79,70,229,0.3)] mb-8"
        >
          {loading ? (
            <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Generating...</span>
          ) : '✦ Generate Insights'}
        </button>

        {error && (
          <div className="p-4 mb-6 rounded-xl bg-red-500/10 border border-red-500/40 text-red-400 text-sm">
            {error.includes('GEMINI_API_KEY')
              ? '⚠️ Gemini API key not configured. Add GEMINI_API_KEY to .env.local and restart the dev server.'
              : error}
          </div>
        )}

        {result && (
          <div className="space-y-5">
            {/* Forecast */}
            <div>
              <h2 className="font-semibold text-indigo-400 mb-3">📈 Prep Forecast</h2>
              <p className="text-sm text-gray-400 mb-3">
                Predicted units needed tomorrow, based on recent order history. 
                Arrow shows demand trend (↑ rising, ↓ falling, → steady).
              </p>
              {result.forecastData && result.forecastData.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {result.forecastData.map((data, i) => {
                    
                    const trendIcon = data.trend === 'up' ? '↑' : data.trend === 'down' ? '↓' : '→'
                    const trendColor = data.trend === 'up' ? 'text-green-400' : data.trend === 'down' ? 'text-red-400' : 'text-gray-500'

                    return (
                      <div key={i} className="p-4 bg-surface border border-surface-border rounded-card shadow-card">
                        <p className="font-medium text-gray-200 truncate" title={data.dish}>{data.dish}</p>
                        <div className="flex items-center gap-2 mt-2 mb-1">
                          <span className="text-3xl font-bold text-accent-amber">{data.predictedUnits}</span>
                          <span className={`text-xl ${trendColor}`}>{trendIcon}</span>
                        </div>
                        <p className="text-xs text-gray-500 line-clamp-2" title={data.reason}>{data.reason}</p>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="p-6 bg-surface border border-surface-border rounded-card shadow-card text-gray-400">
                  No forecast data available yet.
                </div>
              )}
            </div>

            {/* Customer Feedback Summary */}
            <div>
              <h2 className="font-semibold text-blue-400 mb-3">💬 Customer Feedback Summary</h2>
              <div className="p-6 bg-surface border border-surface-border rounded-card shadow-card text-gray-300 text-sm">
                {result.feedbackSummary}
              </div>
            </div>

            {/* Star dishes */}
            {result.stars.length > 0 && (
              <div className="p-6 bg-surface border border-surface-border rounded-card shadow-card">
                <h2 className="font-semibold text-yellow-400 mb-3">⭐ Star Dishes</h2>
                <div className="flex flex-wrap gap-2">
                  {result.stars.map((dish) => (
                    <span key={dish} className="px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 text-sm">{dish}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Dead-weight dishes */}
            {result.deadweight.length > 0 && (
              <div className="p-6 bg-surface border border-surface-border rounded-card shadow-card">
                <h2 className="font-semibold text-red-400 mb-1">💀 Deadweight Dishes</h2>
                <p className="text-xs text-gray-400 mb-3">Low demand - consider promoting or reviewing these items.</p>
                <div className="flex flex-wrap gap-2">
                  {result.deadweight.map((dish) => (
                    <span key={dish} className="px-3 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-red-300 text-sm">{dish}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {!result && !loading && (
          <div className="border-2 border-dashed border-gray-800 rounded-xl p-10 text-center text-gray-500">
            <div className="text-4xl mb-3">✨</div>
            <p>Click &quot;Generate Insights&quot; to get AI-powered analysis of your menu performance.</p>
            <p className="text-xs mt-2">Requires GEMINI_API_KEY in .env.local (configure Day 3)</p>
          </div>
        )}
      </main>
    </div>
  )
}
