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
    <div className="bg-white border border-gray-100 rounded-xl shadow-card p-3 text-xs">
      <p className="font-semibold text-gray-700 mb-1 capitalize">{label}</p>
      <p className="text-emerald-600">Receita: {fmt(payload[0]?.value || 0)}</p>
      <p className="text-red-500">Despesa: {fmt(payload[1]?.value || 0)}</p>
    </div>
  )
}

export function ExpenseChart({ data, loading }: ExpenseChartProps) {
  if (loading) return <div className="card skeleton h-56 rounded-2xl" />

  return (
    <div className="card">
      <h2 className="font-semibold text-gray-900 mb-4">Últimos 6 meses</h2>
      <div className="flex gap-3 text-xs text-gray-500 mb-3">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />Receita</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-400 inline-block" />Despesa</span>
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data} barGap={2} barCategoryGap="30%">
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
          <YAxis hide />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F3F4F6' }} />
          <Bar dataKey="income" fill="#10B981" radius={[4, 4, 0, 0]} />
          <Bar dataKey="expenses" fill="#F87171" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
