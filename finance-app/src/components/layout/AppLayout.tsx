'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard, List, Target, Bot, Settings, LogOut,
  TrendingUp, Menu, X, Plus
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, emoji: '🏠' },
  { href: '/transactions', label: 'Lançamentos', icon: List, emoji: '📋' },
  { href: '/goals', label: 'Metas', icon: Target, emoji: '🎯' },
  { href: '/ai', label: 'Fina IA', icon: Bot, emoji: '💜' },
  { href: '/settings', label: 'Config', icon: Settings, emoji: '⚙️' },
]

interface AppLayoutProps {
  children: React.ReactNode
  profile?: any
  onPlusClick?: () => void
}

export function AppLayout({ children, profile, onPlusClick }: AppLayoutProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    toast.success('Até logo! 👋')
  }

  const initials = profile?.name
    ?.split(' ')
    .slice(0, 2)
    .map((n: string) => n[0])
    .join('') || '?'

  return (
    <div className="min-h-screen bg-gradient-app">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 h-full w-60 bg-white border-r border-gray-100 flex-col z-40">
        {/* Logo */}
        <div className="p-5 border-b border-gray-50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-card rounded-xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-bold text-gray-900 text-sm">Finanças do Casal</p>
              <p className="text-xs text-gray-400">Juntos é melhor 💜</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1">
          {NAV_ITEMS.map(item => {
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150
                  ${active
                    ? 'bg-primary-50 text-primary-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
              >
                <span className="text-base">{item.emoji}</span>
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* User */}
        <div className="p-3 border-t border-gray-50">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
              style={{ backgroundColor: profile?.avatar_color || '#6366F1' }}
            >
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{profile?.name}</p>
              <p className="text-xs text-gray-400">Conectado</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              title="Sair"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="md:ml-60 min-h-screen">
        {/* Mobile header */}
        <header className="md:hidden sticky top-0 z-30 bg-white/90 backdrop-blur-sm border-b border-gray-100 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-gradient-card rounded-lg flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-gray-900 text-sm">Finanças do Casal</span>
          </div>
          <div className="flex items-center gap-2">
            {onPlusClick ? (
              <button
                onClick={onPlusClick}
                className="w-8 h-8 bg-primary-600 rounded-xl flex items-center justify-center active:scale-95 transition-transform"
              >
                <Plus className="w-4 h-4 text-white" />
              </button>
            ) : (
              <Link
                href="/transactions?add=true"
                className="w-8 h-8 bg-primary-600 rounded-xl flex items-center justify-center"
              >
                <Plus className="w-4 h-4 text-white" />
              </Link>
            )}
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
              style={{ backgroundColor: profile?.avatar_color || '#6366F1' }}
            >
              {initials}
            </div>
          </div>
        </header>

        <div className="p-4 md:p-6">
          {children}
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 bottom-nav-safe z-40">
        <div className="flex items-center justify-around px-2 py-1">
          {NAV_ITEMS.map(item => {
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all duration-150 min-w-0
                  ${active ? 'text-primary-600' : 'text-gray-400'}`}
              >
                <span className={`text-xl transition-transform ${active ? 'scale-110' : ''}`}>
                  {item.emoji}
                </span>
                <span className={`text-xs font-medium truncate ${active ? 'text-primary-600' : 'text-gray-400'}`}>
                  {item.label}
                </span>
                {active && (
                  <div className="w-1 h-1 rounded-full bg-primary-600 mt-0.5" />
                )}
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
