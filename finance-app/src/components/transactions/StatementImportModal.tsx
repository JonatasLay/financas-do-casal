'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BankLogo } from '@/components/ui/BankLogo'
import { FileUp, X } from 'lucide-react'
import { toast } from 'sonner'
import type { Bank, Category, PaymentMethod, Transaction } from '@/types'

const brl = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

type ImportRow = {
  id: string
  date: string
  description: string
  amount: number
  type: 'receita' | 'despesa'
  category_id: string
  selected: boolean
  duplicate: boolean
  matchReason?: string
}

interface StatementImportModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  banks: Bank[]
  categories: Category[]
  existingTransactions: Transaction[]
  householdId?: string
  profileId?: string
}

function splitCsvLine(line: string, delimiter: string) {
  const cells: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    const next = line[i + 1]
    if (char === '"' && next === '"') {
      current += '"'
      i++
    } else if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === delimiter && !inQuotes) {
      cells.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }

  cells.push(current.trim())
  return cells.map(cell => cell.replace(/^"|"$/g, '').trim())
}

function parseDate(value: string) {
  const clean = value.trim()
  const br = clean.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/)
  if (br) {
    const year = br[3].length === 2 ? `20${br[3]}` : br[3]
    return `${year}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`
  }

  const iso = clean.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`
  return ''
}

function parseMoney(value: string) {
  const clean = value
    .replace(/\s/g, '')
    .replace(/[R$]/gi, '')
    .replace(/[^\d,.-]/g, '')
  if (!clean) return 0

  const hasComma = clean.includes(',')
  const normalized = hasComma ? clean.replace(/\./g, '').replace(',', '.') : clean.replace(/,/g, '')
  return Number(normalized)
}

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  mercado: ['mercado', 'supermercado', 'atacadao', 'atacadista', 'carrefour', 'assai', 'extra', 'hortifruti'],
  alimentacao: ['ifood', 'restaurante', 'lanchonete', 'padaria', 'pizza', 'burger', 'hamburguer', 'lanche'],
  comida: ['ifood', 'restaurante', 'lanchonete', 'padaria', 'pizza', 'burger', 'hamburguer', 'lanche'],
  transporte: ['uber', '99', 'posto', 'combustivel', 'gasolina', 'estacionamento', 'pedagio'],
  saude: ['farmacia', 'drogaria', 'hospital', 'clinica', 'medico', 'dentista'],
  educacao: ['faculdade', 'escola', 'curso', 'educacao', 'graduacao'],
  lazer: ['cinema', 'viagem', 'hotel', 'pousada', 'show', 'pesca'],
  casa: ['condominio', 'aluguel', 'energia', 'sabesp', 'agua', 'internet', 'vivo', 'claro', 'tim'],
  salario: ['salario', 'pagamento salario', 'folha'],
  renda: ['freela', 'freelance', 'servico', 'trabalho'],
}

function inferCategoryId(description: string, type: 'receita' | 'despesa', categories: Category[]) {
  const text = normalizeText(description)
  const candidates = categories.filter(cat =>
    type === 'receita'
      ? cat.type === 'receita' || cat.type === 'ambos'
      : cat.type === 'despesa' || cat.type === 'ambos'
  )

  const direct = candidates.find(cat => {
    const name = normalizeText(cat.name)
    return name.length >= 3 && text.includes(name)
  })
  if (direct) return direct.id

  for (const cat of candidates) {
    const name = normalizeText(cat.name)
    const words = CATEGORY_KEYWORDS[name] || []
    if (words.some(word => text.includes(normalizeText(word)))) return cat.id
  }

  return ''
}

function findDuplicate(row: ImportRow, existing: Transaction[]) {
  const rowDescription = normalizeText(row.description)
  const exact = existing.some(tx =>
    tx.date === row.date
    && Math.abs(Number(tx.amount) - row.amount) < 0.01
    && normalizeText(tx.description) === rowDescription
  )
  if (exact) return { duplicate: true, reason: 'mesma data, valor e descrição' }

  const sameDayAmount = existing.some(tx =>
    tx.date === row.date
    && Math.abs(Number(tx.amount) - row.amount) < 0.01
  )
  if (sameDayAmount) return { duplicate: true, reason: 'mesma data e valor' }

  return { duplicate: false, reason: undefined }
}

function parseStatement(text: string, categories: Category[]) {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  if (lines.length < 2) return []

  const delimiter = (lines[0].match(/;/g) || []).length >= (lines[0].match(/,/g) || []).length ? ';' : ','
  const headers = splitCsvLine(lines[0], delimiter).map(normalizeText)
  const findIndex = (names: string[]) => headers.findIndex(header => names.some(name => header.includes(normalizeText(name))))
  const dateIndex = findIndex(['data', 'date'])
  const descriptionIndex = findIndex(['descricao', 'descrição', 'historico', 'histórico', 'lancamento', 'lançamento', 'memo'])
  const amountIndex = findIndex(['valor', 'amount', 'quantia'])
  const debitIndex = findIndex(['debito', 'débito', 'saida', 'saída'])
  const creditIndex = findIndex(['credito', 'crédito', 'entrada'])

  return lines.slice(1).map((line, index) => {
    const cells = splitCsvLine(line, delimiter)
    const date = parseDate(cells[dateIndex] || '')
    const description = (cells[descriptionIndex] || `Importado ${index + 1}`).trim()
    const debit = debitIndex >= 0 ? Math.abs(parseMoney(cells[debitIndex] || '0')) : 0
    const credit = creditIndex >= 0 ? Math.abs(parseMoney(cells[creditIndex] || '0')) : 0
    const rawAmount = amountIndex >= 0 ? parseMoney(cells[amountIndex] || '0') : credit - debit
    const signedAmount = debit > 0 ? -debit : credit > 0 ? credit : rawAmount
    const type = signedAmount >= 0 ? 'receita' : 'despesa'
    const amount = Math.abs(signedAmount)

    return {
      id: `${date}-${index}`,
      date,
      description,
      amount,
      type,
      category_id: inferCategoryId(description, type, categories),
      selected: !!date && amount > 0,
      duplicate: false,
    } as ImportRow
  }).filter(row => row.date && row.amount > 0)
}

export function StatementImportModal({
  open,
  onClose,
  onSuccess,
  banks,
  categories,
  existingTransactions,
  householdId,
  profileId,
}: StatementImportModalProps) {
  const supabase = createClient()
  const [rows, setRows] = useState<ImportRow[]>([])
  const [bankId, setBankId] = useState('')
  const [expenseCategoryId, setExpenseCategoryId] = useState('')
  const [incomeCategoryId, setIncomeCategoryId] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) {
      setRows([])
      setBankId('')
      setExpenseCategoryId('')
      setIncomeCategoryId('')
    }
  }, [open])

  const selectedRows = rows.filter(row => row.selected)
  const selectedBank = banks.find(bank => bank.id === bankId)
  const paymentMethod: PaymentMethod = selectedBank?.type === 'credito'
    ? 'credito'
    : selectedBank?.type === 'debito'
      ? 'debito'
      : selectedBank?.type === 'dinheiro'
        ? 'dinheiro'
        : 'outro'

  const totals = useMemo(() => ({
    income: selectedRows.filter(row => row.type === 'receita').reduce((sum, row) => sum + row.amount, 0),
    expenses: selectedRows.filter(row => row.type === 'despesa').reduce((sum, row) => sum + row.amount, 0),
  }), [selectedRows])

  const handleFile = async (file?: File) => {
    if (!file) return
    const text = await file.text()
    const parsed = parseStatement(text, categories)
    if (!parsed.length) {
      setRows([])
      toast.error('Não encontrei linhas válidas. Use CSV com data, descrição e valor.')
      return
    }

    let existing = existingTransactions
    if (householdId) {
      const dates = parsed.map(row => row.date).sort()
      const { data } = await supabase
        .from('transactions')
        .select('id,date,description,amount,type,category_id,bank_id,status,notes,is_recurring,month,year,created_at')
        .eq('household_id', householdId)
        .gte('date', dates[0])
        .lte('date', dates[dates.length - 1])
      existing = (data || []) as Transaction[]
    }

    setRows(parsed.map(row => {
      const match = findDuplicate(row, existing)
      return {
        ...row,
        duplicate: match.duplicate,
        matchReason: match.reason,
        selected: row.selected && !match.duplicate,
      }
    }))
    toast.success(`${parsed.length} linha(s) encontradas no extrato`)
  }

  const updateRow = (id: string, patch: Partial<ImportRow>) => {
    setRows(prev => prev.map(row => row.id === id ? { ...row, ...patch } : row))
  }

  const toggleRow = (id: string) => {
    setRows(prev => prev.map(row => row.id === id ? { ...row, selected: !row.selected } : row))
  }

  const selectOnlyNew = () => setRows(prev => prev.map(row => ({ ...row, selected: !row.duplicate })))

  const toggleAll = () => {
    const hasUnselected = rows.some(row => !row.duplicate && !row.selected)
    setRows(prev => prev.map(row => row.duplicate ? row : { ...row, selected: hasUnselected }))
  }

  const saveRows = async () => {
    if (!householdId || !profileId) return void toast.error('Perfil não carregado')
    if (!selectedRows.length) return void toast.error('Selecione pelo menos um lançamento')

    setSaving(true)
    const payload = selectedRows.map(row => ({
      household_id: householdId,
      created_by: profileId,
      date: row.date,
      description: row.description.trim(),
      amount: row.amount,
      type: row.type,
      category_id: row.category_id || (row.type === 'receita' ? incomeCategoryId || null : expenseCategoryId || null),
      bank_id: bankId || null,
      status: 'realizado',
      notes: 'Importado por extrato CSV',
      is_recurring: false,
      responsible_party: 'casal',
      is_reimbursed: false,
      payment_method: paymentMethod,
    }))
    const { error } = await supabase.from('transactions').insert(payload)
    setSaving(false)
    if (error) return void toast.error('Não consegui importar o extrato')
    toast.success(`${payload.length} lançamento(s) importados`)
    onSuccess()
    onClose()
  }

  if (!open) return null

  const expenseCategories = categories.filter(cat => cat.type === 'despesa' || cat.type === 'ambos')
  const incomeCategories = categories.filter(cat => cat.type === 'receita' || cat.type === 'ambos')
  const categoriesForRow = (row: ImportRow) => row.type === 'receita' ? incomeCategories : expenseCategories

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full md:max-w-5xl max-h-[92dvh] rounded-t-3xl md:rounded-2xl flex flex-col"
        style={{ background: 'rgba(17,17,36,0.98)', border: '1px solid rgba(129,140,248,0.22)' }}>
        <div className="flex items-center justify-between gap-3 px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div>
            <h2 className="font-bold" style={{ color: '#F1F5F9' }}>Importar extrato CSV</h2>
            <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>Revise, categorize e importe apenas o que falta no sistema.</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl" style={{ color: '#64748B' }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <label className="rounded-2xl p-5 flex flex-col items-center justify-center gap-2 cursor-pointer"
            style={{ background: 'rgba(129,140,248,0.08)', border: '1px dashed rgba(129,140,248,0.38)' }}>
            <FileUp className="w-6 h-6" style={{ color: '#A5B4FC' }} />
            <span className="text-sm font-semibold" style={{ color: '#F1F5F9' }}>Selecionar arquivo CSV</span>
            <span className="text-xs" style={{ color: '#64748B' }}>Colunas aceitas: data, descrição e valor; ou débito/crédito separados.</span>
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={event => handleFile(event.target.files?.[0])} />
          </label>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <select value={bankId} onChange={event => setBankId(event.target.value)} className="input">
              <option value="">Banco/conta opcional</option>
              {banks.map(bank => <option key={bank.id} value={bank.id}>{bank.name}</option>)}
            </select>
            <select value={expenseCategoryId} onChange={event => setExpenseCategoryId(event.target.value)} className="input">
              <option value="">Categoria padrão para despesas</option>
              {expenseCategories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
            </select>
            <select value={incomeCategoryId} onChange={event => setIncomeCategoryId(event.target.value)} className="input">
              <option value="">Categoria padrão para receitas</option>
              {incomeCategories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
            </select>
          </div>

          {rows.length > 0 && (
            <>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl p-3" style={{ background: 'rgba(52,211,153,0.09)', border: '1px solid rgba(52,211,153,0.18)' }}>
                  <p className="text-[10px] uppercase" style={{ color: '#64748B' }}>Receitas</p>
                  <p className="font-bold" style={{ color: '#34D399' }}>{brl(totals.income)}</p>
                </div>
                <div className="rounded-xl p-3" style={{ background: 'rgba(248,113,113,0.09)', border: '1px solid rgba(248,113,113,0.18)' }}>
                  <p className="text-[10px] uppercase" style={{ color: '#64748B' }}>Despesas</p>
                  <p className="font-bold" style={{ color: '#F87171' }}>{brl(totals.expenses)}</p>
                </div>
                <div className="rounded-xl p-3" style={{ background: 'rgba(129,140,248,0.09)', border: '1px solid rgba(129,140,248,0.18)' }}>
                  <p className="text-[10px] uppercase" style={{ color: '#64748B' }}>Selecionados</p>
                  <p className="font-bold" style={{ color: '#A5B4FC' }}>{selectedRows.length}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs" style={{ color: '#64748B' }}>
                  {rows.filter(row => row.duplicate).length} possível(is) duplicado(s). Linhas duplicadas ficam desmarcadas.
                </p>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={selectOnlyNew} className="px-3 py-1.5 rounded-xl text-xs font-semibold"
                    style={{ background: 'rgba(52,211,153,0.10)', border: '1px solid rgba(52,211,153,0.22)', color: '#34D399' }}>
                    Selecionar novos
                  </button>
                  <button type="button" onClick={toggleAll} className="px-3 py-1.5 rounded-xl text-xs font-semibold"
                    style={{ background: 'rgba(129,140,248,0.10)', border: '1px solid rgba(129,140,248,0.22)', color: '#A5B4FC' }}>
                    Marcar/desmarcar todos
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {rows.map(row => (
                  <div key={row.id}
                    className="rounded-xl px-3 py-2.5 grid grid-cols-[auto_1fr] md:grid-cols-[auto_1fr_190px_130px] items-center gap-3"
                    style={{ background: row.selected ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.025)', border: row.duplicate ? '1px solid rgba(251,191,36,0.22)' : '1px solid rgba(255,255,255,0.07)' }}>
                    <input type="checkbox" checked={row.selected} onChange={() => toggleRow(row.id)} className="w-4 h-4 accent-indigo-500" />
                    <div className="min-w-0">
                      <input
                        value={row.description}
                        onChange={event => updateRow(row.id, { description: event.target.value })}
                        className="w-full bg-transparent text-sm font-semibold outline-none"
                        style={{ color: '#F1F5F9' }}
                      />
                      <p className="text-xs flex flex-wrap items-center gap-1.5" style={{ color: '#64748B' }}>
                        <span>{row.date}</span>
                        {selectedBank && <span className="inline-flex items-center gap-1">· <BankLogo bank={selectedBank} size="xs" /> {selectedBank.name}</span>}
                        {row.duplicate && <span style={{ color: '#FBBF24' }}>· possível duplicado ({row.matchReason})</span>}
                      </p>
                    </div>
                    <select
                      value={row.category_id}
                      onChange={event => updateRow(row.id, { category_id: event.target.value })}
                      className="input h-9 text-xs col-span-2 md:col-span-1"
                    >
                      <option value="">Sem categoria</option>
                      {categoriesForRow(row).map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                    </select>
                    <p className="text-sm font-bold md:text-right" style={{ color: row.type === 'receita' ? '#34D399' : '#F87171' }}>
                      {row.type === 'receita' ? '+' : '-'}{brl(row.amount)}
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="px-5 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <button onClick={saveRows} disabled={saving || selectedRows.length === 0} className="btn-primary w-full">
            {saving ? 'Importando...' : `Importar ${selectedRows.length} lançamento(s)`}
          </button>
        </div>
      </div>
    </div>
  )
}
