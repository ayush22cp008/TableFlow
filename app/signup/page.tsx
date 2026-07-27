import { AuthForm } from '@/components/AuthForm'
import Link from 'next/link'

export default function SignupPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-950 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-bl from-pink-900/20 via-transparent to-transparent blur-3xl opacity-50 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-gradient-to-tr from-indigo-900/30 via-transparent to-transparent blur-3xl opacity-50 pointer-events-none" />
      <div className="absolute top-8 left-8 z-20">
        <Link href="/" className="text-gray-400 hover:text-white transition-colors text-sm">← Home</Link>
      </div>
      <AuthForm view="signup" />
    </main>
  )
}
