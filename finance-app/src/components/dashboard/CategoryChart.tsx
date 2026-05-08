'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { Category } from '@/types'

interface CategoryChartProps {
  data: { category: Category; total: number }[]
  loading: boolean
}

const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div style={{
      background: 'rgba(17,17,36,0.95)',
      border: '1px solid rgba(129,140,248,0.3)',
      borderRadius: '12px',
      padding: '10px 14px',
      fontSize: '12px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    }}>
      <p style={{ fontWeight: 600, color: '#F1F5F9' }}>{d.category.icon} {d.category.name}</p>
      <p style={{ color: '#94A3B8' }}>{fmt(d.total)}</p>
    </div>
  )
}

export function CategoryChart({ data, loading }: CategoryChartProps) {
  if (loading) return <div className="card skeleton h-56 rounded-2xl" />

  const top5 = data.slice(0, 5)
  const total = top5.reduce((s, d) => s + d.total, 0)

  return (
    <div className="card">
      <h2 className="font-semibold mb-4" style={{ color: '#F1F5F9' }}>Por categoria</h2>
      {top5.length === 0 ? (
        <div className="h-40 flex items-center justify-center">
          <p className="text-sm" style={{ color: '#475569' }}>Nenhum gasto ainda este mês</p>
        </div>
      ) : (
        <div className="flex gap-3">
          <ResponsiveContainer width={120} height={120}>
            <PieChart>
              <Pie data={top5} dataKey="total" cx="50%" cy="50%" innerRadius={32} outerRadius={52} paddingAngle={2}>
                {top5.map((entry, i) => (
                  <Cell key={i} fill={entry.category.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex-1 space-y-1.5">
            {top5.map((d, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: d.category.color }} />
                <span className="text-xs flex-1 truncate" style={{ color: '#94A3B8' }}>{d.category.icon} {d.category.name}</span>
                <span className="text-xs font-medium" style={{ color: '#F1F5F9' }}>
                  {total > 0 ? Math.round(d.total / total * 100) : 0}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
