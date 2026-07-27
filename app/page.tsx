import Link from 'next/link'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-950 relative overflow-hidden">
      {/* Background gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-gradient-to-b from-indigo-500/20 to-transparent blur-3xl rounded-full opacity-60 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-gradient-to-t from-purple-500/20 to-transparent blur-3xl rounded-full opacity-50 pointer-events-none" />

      <div className="z-10 text-center space-y-8 p-12 backdrop-blur-md bg-gray-900/30 border border-gray-800/50 rounded-3xl shadow-2xl max-w-3xl w-full mx-4">
        <div className="flex items-center justify-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white shadow-lg text-xl">TF</div>
          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">
            TableFlow
          </h1>
        </div>

        <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
          Smart dining, simplified. Real-time menu, digital waitlist, live order tracking — all in one place for modern restaurants.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
          <Link
            href="/order"
            className="w-full sm:w-auto px-8 py-3 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-all transform hover:scale-105 shadow-[0_0_20px_rgba(79,70,229,0.3)]"
          >
            🍽️ Browse Menu
          </Link>
          <Link
            href="/login"
            className="w-full sm:w-auto px-8 py-3 rounded-full bg-gray-800/50 hover:bg-gray-800 border border-gray-700 text-gray-200 font-medium transition-all hover:border-gray-600 backdrop-blur-sm"
          >
            Sign In / Sign Up
          </Link>
        </div>

        <div className="flex items-center justify-center gap-8 pt-4 text-sm text-gray-500">
          <span>✦ Real-time updates</span>
          <span>✦ Waitlist management</span>
          <span>✦ AI-powered insights</span>
        </div>
      </div>
    </main>
  )
}
