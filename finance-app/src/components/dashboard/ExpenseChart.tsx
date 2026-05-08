'use client'

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts'

interface ExpenseChartProps {
  data: { month: string; income: number; expenses: number }[]
  loading: boolean
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  return (
    <div style={{
      background: 'rgba(17,17,36,0.95)',
      border: '1px solid rgba(129,140,248,0.3)',
      borderRadius: '12px',
      padding: '10px 14px',
      fontSize: '12px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    }}>
      <p style={{ fontWeight: 600, color: '#F1F5F9', marginBottom: 4, textTransform: 'capitalize' }}>{label}</p>
      <p style={{ color: '#34D399' }}>Receita: {fmt(payload[0]?.value || 0)}</p>
      <p style={{ color: '#F87171' }}>Despesa: {fmt(payload[1]?.value || 0)}</p>
    </div>
  )
}

export function ExpenseChart({ data, loading }: ExpenseChartProps) {
  if (loading) return <div className="card skeleton h-56 rounded-2xl" />

  return (
    <div className="card">
      <h2 className="font-semibold mb-4" style={{ color: '#F1F5F9' }}>Últimos 6 meses</h2>
      <div className="flex gap-3 text-xs mb-3" style={{ color: '#64748B' }}>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: '#34D399' }} />Receita
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: '#F87171' }} />Despesa
        </span>
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data} barGap={2} barCategoryGap="30%">
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(129,140,248,0.08)" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} />
          <YAxis hide />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(129,140,248,0.06)' }} />
          <Bar dataKey="income" fill="#34D399" radius={[4, 4, 0, 0]} />
          <Bar dataKey="expenses" fill="#F87171" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
