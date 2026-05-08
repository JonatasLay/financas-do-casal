'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard, List, Target, Bot, Settings, LogOut,
  TrendingUp, Plus, PiggyBank, LineChart, Wallet,
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

const NAV_ITEMS = [
  { href: '/',             label: 'Dashboard',     icon: LayoutDashboard, emoji: '🏠', color: '#818CF8' },
  { href: '/transactions', label: 'Lançamentos',   icon: List,            emoji: '📋', color: '#22D3EE' },
  { href: '/goals',        label: 'Metas',          icon: Target,          emoji: '🎯', color: '#F472B6' },
  { href: '/savings',      label: 'Poupança',       icon: PiggyBank,       emoji: '💰', color: '#34D399' },
  { href: '/investments',  label: 'Investimentos',  icon: LineChart,       emoji: '📈', color: '#FBBF24' },
  { href: '/ai',           label: 'Fina IA',        icon: Bot,             emoji: '🤖', color: '#C084FC' },
  { href: '/settings',     label: 'Config',         icon: Settings,        emoji: '⚙️', color: '#94A3B8' },
]

const MOBILE_NAV = [
  { href: '/',             label: 'Home',       emoji: '🏠', color: '#818CF8' },
  { href: '/transactions', label: 'Gastos',     emoji: '📋', color: '#22D3EE' },
  { href: '/savings',      label: 'Poupança',   emoji: '💰', color: '#34D399' },
  { href: '/investments',  label: 'Invest.',    emoji: '📈', color: '#FBBF24' },
  { href: '/ai',           label: 'Fina IA',    emoji: '🤖', color: '#C084FC' },
]

interface AppLayoutProps {
  children: React.ReactNode
  profile?: any
  onPlusClick?: () => void
}

export function AppLayout({ children, profile, onPlusClick }: AppLayoutProps) {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()
  const [loggingOut, setLoggingOut] = useState(false)

  const handleLogout = async () => {
    setLoggingOut(true)
    await supabase.auth.signOut()
    router.push('/login')
    toast.success('Até logo! 👋')
  }

  const initials = profile?.name?.split(' ').slice(0, 2).map((n: string) => n[0]).join('') || '?'

  return (
    <div className="min-h-screen" style={{ background: '#08080F' }}>

      {/* ── Desktop Sidebar ─────────────────────────────────────────── */}
      <aside className="hidden md:flex fixed left-0 top-0 h-full w-64 flex-col z-40"
        style={{
          background: 'rgba(13,13,26,0.95)',
          borderRight: '1px solid rgba(129,140,248,0.1)',
          backdropFilter: 'blur(20px)',
        }}>

        {/* Logo */}
        <div className="p-5" style={{ borderBottom: '1px solid rgba(129,140,248,0.08)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #818CF8, #F472B6)', boxShadow: '0 0 20px rgba(129,140,248,0.4)' }}>
              <Wallet className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-bold text-sm" style={{ color: '#F1F5F9' }}>Finanças do Casal</p>
              <p className="text-xs" style={{ color: '#475569' }}>Juntos é melhor 💜</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map(item => {
            const active = pathname === item.href
            return (
              <Link key={item.href} href={item.href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150 group"
                style={{
                  background: active ? `${item.color}18` : 'transparent',
                  color: active ? item.color : '#94A3B8',
                  boxShadow: active ? `0 0 12px ${item.color}15` : 'none',
                  border: active ? `1px solid ${item.color}25` : '1px solid transparent',
                }}>
                <span className="text-base transition-transform group-hover:scale-110">{item.emoji}</span>
                <span className="font-medium">{item.label}</span>
                {active && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full" style={{ background: item.color, boxShadow: `0 0 8px ${item.color}` }} />
                )}
              </Link>
            )
          })}
        </nav>

        {/* User */}
        <div className="p-3" style={{ borderTop: '1px solid rgba(129,140,248,0.08)' }}>
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.03)' }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
              style={{ background: profile?.avatar_color || '#818CF8', boxShadow: `0 0 12px ${profile?.avatar_color || '#818CF8'}60` }}>
              {profile?.avatar_emoji || initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: '#F1F5F9' }}>{profile?.name || '...'}</p>
              <p className="text-xs" style={{ color: '#34D399' }}>● Online</p>
            </div>
            <button onClick={handleLogout} disabled={loggingOut}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: '#475569' }}
              title="Sair">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main ──────────────────────────────────────────────────────── */}
      <main className="md:ml-64 min-h-screen">

        {/* Mobile header */}
        <header className="md:hidden sticky top-0 z-30 px-4 py-3 flex items-center justify-between"
          style={{
            background: 'rgba(8,8,15,0.9)',
            borderBottom: '1px solid rgba(129,140,248,0.08)',
            backdropFilter: 'blur(20px)',
          }}>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #818CF8, #F472B6)' }}>
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-sm" style={{ color: '#F1F5F9' }}>Finanças do Casal</span>
          </div>
          <div className="flex items-center gap-2">
            {onPlusClick ? (
              <button onClick={onPlusClick}
                className="w-8 h-8 rounded-xl flex items-center justify-center active:scale-95 transition-transform"
                style={{ background: 'linear-gradient(135deg, #818CF8, #6366F1)', boxShadow: '0 0 16px rgba(129,140,248,0.4)' }}>
                <Plus className="w-4 h-4 text-white" />
              </button>
            ) : (
              <Link href="/transactions?add=true"
                className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #818CF8, #6366F1)', boxShadow: '0 0 16px rgba(129,140,248,0.4)' }}>
                <Plus className="w-4 h-4 text-white" />
              </Link>
            )}
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
              style={{ background: profile?.avatar_color || '#818CF8' }}>
              {profile?.avatar_emoji || initials}
            </div>
          </div>
        </header>

        <div className="p-4 md:p-6 pb-24 md:pb-6">
          {children}
        </div>
      </main>

      {/* ── Mobile bottom nav ─────────────────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bottom-nav-safe"
        style={{
          background: 'rgba(13,13,26,0.97)',
          borderTop: '1px solid rgba(129,140,248,0.1)',
          backdropFilter: 'blur(20px)',
        }}>
        <div className="flex items-center justify-around px-1 py-2">
          {MOBILE_NAV.map(item => {
            const active = pathname === item.href
            return (
              <Link key={item.href} href={item.href}
                className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-all duration-150 min-w-0 flex-1">
                <span className={`text-xl transition-all duration-150 ${active ? 'scale-115' : 'opacity-50'}`}
                  style={{ filter: active ? `drop-shadow(0 0 8px ${item.color})` : 'none' }}>
                  {item.emoji}
                </span>
                <span className="text-[10px] font-medium truncate transition-colors"
                  style={{ color: active ? item.color : '#475569' }}>
                  {item.label}
                </span>
                {active && (
                  <div className="w-4 h-0.5 rounded-full mt-0.5" style={{ background: item.color, boxShadow: `0 0 8px ${item.color}` }} />
                )}
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
