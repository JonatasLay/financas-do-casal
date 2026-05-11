'use client'

import type { Bank } from '@/types'

type BankLogoProps = {
  bank?: Pick<Bank, 'name' | 'color' | 'icon'> | null
  name?: string
  color?: string | null
  icon?: string | null
  size?: 'xs' | 'sm' | 'md'
}

const SIZES = {
  xs: 'w-4 h-4 text-[8px] rounded-md',
  sm: 'w-7 h-7 text-[10px] rounded-lg',
  md: 'w-9 h-9 text-xs rounded-xl',
}

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function brandFor(name: string, fallbackColor?: string | null) {
  const n = normalize(name)

  if (n.includes('nubank') || n === 'nu') {
    return { label: 'Nu', bg: '#820AD1', fg: '#FFFFFF', border: '#B86ADF' }
  }
  if (n.includes('inter')) {
    return { label: 'inter', bg: '#FD540F', fg: '#FFFFFF', border: '#FF8A4C' }
  }
  if (n.includes('banco do brasil') || n === 'bb') {
    return { label: 'BB', bg: '#F2CE1B', fg: '#031CA6', border: '#031CA6' }
  }
  if (n.includes('itau')) {
    return { label: 'itaú', bg: '#EC7000', fg: '#001E62', border: '#FFB366' }
  }
  if (n.includes('bradesco')) {
    return { label: 'b', bg: '#CC092F', fg: '#FFFFFF', border: '#F05A6E' }
  }
  if (n.includes('caixa')) {
    return { label: 'CX', bg: '#005CA9', fg: '#F7941D', border: '#F7941D' }
  }
  if (n.includes('magazine') || n.includes('magalu') || n.includes('luiza')) {
    return { label: 'M', bg: '#0086FF', fg: '#FFFFFF', border: '#67B7FF' }
  }
  if (n.includes('pix')) {
    return { label: 'pix', bg: '#32BCAD', fg: '#062A2A', border: '#7BE0D4' }
  }
  if (n.includes('dinheiro') || n.includes('especie')) {
    return { label: 'R$', bg: '#10B981', fg: '#FFFFFF', border: '#6EE7B7' }
  }

  return {
    label: null,
    bg: fallbackColor || '#6366F1',
    fg: '#FFFFFF',
    border: fallbackColor || '#818CF8',
  }
}

export function BankLogo({ bank, name, color, icon, size = 'md' }: BankLogoProps) {
  const bankName = bank?.name || name || ''
  const fallbackColor = bank?.color || color
  const fallbackIcon = bank?.icon || icon || '🏦'
  const brand = brandFor(bankName, fallbackColor)

  return (
    <span
      className={`${SIZES[size]} inline-flex flex-shrink-0 items-center justify-center overflow-hidden font-black tracking-tight shadow-sm`}
      style={{
        background: brand.bg,
        color: brand.fg,
        border: `1px solid ${brand.border}66`,
        boxShadow: `0 0 14px ${brand.bg}28`,
      }}
      aria-hidden="true"
    >
      {brand.label || fallbackIcon}
    </span>
  )
}
