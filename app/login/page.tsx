import { AuthForm } from '@/components/AuthForm'
import Link from 'next/link'

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-950 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-br from-indigo-900/30 via-transparent to-transparent blur-3xl opacity-50 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-gradient-to-tl from-purple-900/30 via-transparent to-transparent blur-3xl opacity-50 pointer-events-none" />
      <div className="absolute top-8 left-8 z-20">
        <Link href="/" className="text-gray-400 hover:text-white transition-colors text-sm">← Home</Link>
      </div>
      <AuthForm view="login" />
    </main>
  )
}
