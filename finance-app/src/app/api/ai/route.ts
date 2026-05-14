import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 30

import { createClient } from '@/lib/supabase/server'
import { chatWithFina, analyzePurchase, analyzeInvestments } from '@/lib/ai'
import { AIContext, AIMessage } from '@/types'
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths, addMonths, subDays } from 'date-fns'
import { getCreditCardPaymentDate, isDateInMonth } from '@/lib/finance-dates'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { messages, mode, purchaseItem, purchasePrice, investmentQuestion } = await req.json()
    const allMessages = (messages as AIMessage[] | undefined) || []
    const context = await buildFinancialContext(supabase, user.id)
    const lastMessage = allMessages.filter(m => m.role === 'user').at(-1)?.content || ''
    if (!mode || mode === 'chat') {
      const actionText = resolveActionTextFromConversation(allMessages, lastMessage)
      const action = await tryHandleTransactionAction(supabase, user.id, actionText)
      if (action) return NextResponse.json({ response: action })
    }

    if (mode === 'purchase' && purchaseItem && purchasePrice) {
      return NextResponse.json({ response: await analyzePurchase(purchaseItem, purchasePrice, context) })
    }
    if (mode === 'investment' && investmentQuestion) {
      return NextResponse.json({ response: await analyzeInvestments(context, investmentQuestion) })
    }

    return NextResponse.json({ response: await chatWithFina(messages as AIMessage[], context) })
  } catch (error) {
    console.error('AI API error:', error)
    return NextResponse.json({ error: 'Erro interno. Tente novamente.' }, { status: 500 })
  }
}

function parseMoney(text: string) {
  const match = text.match(/[-+]?\s*(?:r\$\s*)?(\d{1,3}(?:\.\d{3})*(?:,\d{2})|\d+(?:[,.]\d{1,2})?|\d+)/i)
  if (!match) return 0
  return Number(match[1].replace(/\./g, '').replace(',', '.'))
}

function parseBRDate(text: string) {
  const match = text.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/)
  if (!match) return null
  return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizeSpaces(value: string) {
  return value.replace(/\s+/g, ' ').replace(/\s+([,.;:!?])/g, '$1').trim()
}

function titleDescription(value: string) {
  const trimmed = normalizeSpaces(value)
  if (!trimmed) return ''
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
}

function cleanupTransactionDescription(raw: string, bankName: string | null, type: 'receita' | 'despesa') {
  let cleaned = raw
    .replace(/\*\*/g, '')
    .replace(/\b(fina|por favor|pfv|por gentileza)\b[,\s]*/gi, ' ')
    .replace(/\b(lance|lanca|lança|lancar|lançar|registre|adicione|adicionar|coloque|colocar|crie|criar)\b/gi, ' ')
    .replace(/(?:r\$\s*)?\d{1,3}(?:\.\d{3})*(?:,\d{2})?|(?:r\$\s*)?\d+(?:[,.]\d{1,2})?/gi, ' ')
    .replace(/\b(reais|real|brl)\b/gi, ' ')
    .replace(/\b(data|dia)\s+(de|do|da|em|para)?\s*\d{0,2}\/?\d{0,2}\/?\d{0,4}/gi, ' ')
    .replace(/\b(hoje|ontem|amanha|amanhã)\b/gi, ' ')
    .replace(/\b(no|na|num|numa|em|com|via|forma|pagamento|pix|boleto|debito|débito|credito|crédito|cartao|cartão)\b/gi, ' ')
    .replace(/\b(conta|banco|cartao|cartão)\s+(do|da|de)?\s*/gi, ' ')
    .replace(/\b(para|pra)\s+(a\s+)?(conta|banco|cartao|cartão)\b/gi, ' ')

  if (bankName) cleaned = cleaned.replace(new RegExp(`\\b${escapeRegex(bankName)}\\b`, 'gi'), ' ')

  cleaned = cleaned
    .replace(type === 'receita'
      ? /\b(uma|um|a|o)?\s*(receita|recebi|ganhei|entrada|pagamento)\s+(de|do|da)?\b/gi
      : /\b(uma|um|a|o)?\s*(despesa|gasto|compra|comprei|paguei)\s+(de|do|da)?\b/gi, ' ')
    .replace(/\b(de|do|da|dos|das|para|pra|por)\b/gi, ' ')
    .replace(/[!?.:,;]+/g, ' ')

  return titleDescription(cleaned)
}

function resolveActionTextFromConversation(messages: AIMessage[], lastMessage: string) {
  if (!/^\s*(sim|pode|confirmo|confirmado|ok|isso|isso mesmo|claro|manda|lanca|lança)\s*[!.]*\s*$/i.test(lastMessage)) {
    return lastMessage
  }

  const lastIndex = messages.map(m => m.content).lastIndexOf(lastMessage)
  const previousAssistant = messages.slice(0, lastIndex).reverse().find(m => m.role === 'assistant')?.content || ''
  if (/descri[cç][aã]o\s*:|valor\s*:|data\s*:/i.test(previousAssistant)) {
    return `lance\n${previousAssistant}`
  }

  const previousUser = messages.slice(0, lastIndex).reverse().find(m => m.role === 'user')?.content || ''
  return previousUser || lastMessage
}

function parseStructuredTransaction(raw: string) {
  const field = (label: string) => {
    const match = raw.match(new RegExp(`${label}\\s*:\\s*([^\\n]+)`, 'i'))
    return match?.[1]?.replace(/\*\*/g, '').trim() || null
  }

  const description = field('descri[cç][aã]o')
  const valueText = field('valor')
  const dateText = field('data')
  const bank = field('conta|banco|cart[aã]o')
  const paymentMethodText = field('forma|pagamento')
  const category = field('categoria')
  const amount = valueText ? Math.abs(parseMoney(valueText)) : 0
  const type = valueText?.includes('+') || /\b(receita|recebi|ganhei)\b/i.test(raw)
    ? 'receita'
    : /\b(despesa|gastei|compra|comprei)\b/i.test(raw) || valueText?.includes('-')
      ? 'despesa'
      : null
  const date = dateText ? parseBRDate(dateText) : parseBRDate(raw)

  return { description, amount, date, bank, paymentMethodText, category, type }
}

async function tryHandleTransactionAction(supabase: any, userId: string, raw: string) {
  const text = raw.toLowerCase()
  const wantsDelete = /\b(apague|apaga|remova|remove|exclua|excluir|delete)\b/.test(text)
  const wantsLaunch = /\b(lance|lan[cç]a|lan[cç]ar|registre|adicione|coloque)\b/.test(text)
  if (wantsDelete) return tryDeleteTransactionFromMessage(supabase, userId, raw)
  if (!wantsLaunch) return null

  const structured = parseStructuredTransaction(raw)
  const amount = structured.amount || parseMoney(raw)
  if (!amount || amount <= 0) {
    return 'Consigo lançar sim, mas preciso do valor. Ex: "Lance mercado R$ 200 no cartão Nubank".'
  }

  const { data: profile } = await supabase.from('profiles').select('id, household_id').eq('id', userId).single()
  if (!profile?.household_id) return 'Não encontrei seu perfil para lançar isso.'

  const [banksRes, catsRes] = await Promise.all([
    supabase.from('banks').select('*').eq('household_id', profile.household_id),
    supabase.from('categories').select('*').eq('household_id', profile.household_id),
  ])
  const banks = banksRes.data || []
  const categories = catsRes.data || []
  const type = /\b(recebi|receita|ganhei|sal[aá]rio|pagamento|trabalho)\b/.test(text) ? 'receita' : 'despesa'
  const bankSearchText = `${text} ${structured.bank || ''}`.toLowerCase()
  const categorySearchText = `${text} ${structured.category || ''}`.toLowerCase()
  const bank = banks.find((b: any) => bankSearchText.includes(String(b.name).toLowerCase()))
    || banks.find((b: any) => text.includes('cartao') || text.includes('cartão') ? b.type === 'credito' : false)
    || null
  const category = categories.find((c: any) => c.type !== (type === 'receita' ? 'despesa' : 'receita') && categorySearchText.includes(String(c.name).toLowerCase()))
    || categories.find((c: any) => c.type !== (type === 'receita' ? 'despesa' : 'receita'))
    || null

  const transactionType = structured.type === 'receita' || structured.type === 'despesa' ? structured.type : type
  const cleaned = cleanupTransactionDescription(raw, bank?.name || null, transactionType)
  const description = cleaned.length >= 3 ? cleaned : type === 'receita' ? 'Receita lançada pela Fina' : 'Despesa lançada pela Fina'
  const paymentText = `${text} ${structured.paymentMethodText || ''}`.toLowerCase()
  const paymentMethod = bank?.type === 'credito' ? 'credito'
    : paymentText.includes('pix') ? 'pix'
    : paymentText.includes('boleto') ? 'boleto'
    : bank?.type === 'debito' ? 'debito'
    : bank?.type === 'dinheiro' ? 'dinheiro'
    : 'outro'

  const date = structured.date || (text.includes('ontem')
    ? format(subDays(new Date(), 1), 'yyyy-MM-dd')
    : format(new Date(), 'yyyy-MM-dd'))

  const { error } = await supabase.from('transactions').insert({
    household_id: profile.household_id,
    created_by: profile.id,
    date,
    description: structured.description || description,
    amount,
    type: transactionType,
    category_id: category?.id || null,
    bank_id: bank?.id || null,
    status: 'realizado',
    notes: 'Lançado pela Fina via chat',
    is_recurring: false,
    responsible_party: text.includes('neusa') ? 'sogra' : 'casal',
    is_reimbursed: false,
    payment_method: paymentMethod,
  })

  if (error) {
    console.error('AI transaction insert error:', error)
    return 'Tentei lançar, mas não consegui gravar com segurança. Revise valor, data, conta e categoria, e tente novamente.'
  }
  return `Lançado com sucesso: ${description}, ${type === 'receita' ? 'receita' : 'despesa'} de ${amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}${bank ? ` em ${bank.name}` : ''}.`
}

async function tryDeleteTransactionFromMessage(supabase: any, userId: string, raw: string) {
  const text = raw.toLowerCase()
  const amount = parseMoney(raw)
  const { data: profile } = await supabase.from('profiles').select('household_id').eq('id', userId).single()
  if (!profile?.household_id) return 'Nao encontrei seu perfil para remover o lancamento.'

  const search = raw
    .replace(/(?:apague|apaga|remova|remove|exclua|excluir|delete)\s*/i, '')
    .replace(/(?:r\$\s*)?\d{1,3}(?:\.\d{3})*(?:,\d{2})?|(?:r\$\s*)?\d+(?:[,.]\d{1,2})?/i, '')
    .replace(/\b(lancamento|lan[cç]amento|despesa|receita|de|do|da|no|na|com|hoje|ontem)\b/gi, '')
    .trim()

  if (search.length < 3 && !amount) {
    return 'Consigo remover, mas preciso identificar melhor. Ex: "remova mercado R$ 200" ou "apague salario de ontem".'
  }

  let query = supabase
    .from('transactions')
    .select('id, date, description, amount, type, status, recurring_group_id')
    .eq('household_id', profile.household_id)
    .order('date', { ascending: false })
    .limit(6)

  if (search.length >= 3) query = query.ilike('description', `%${search}%`)
  if (amount > 0) query = query.eq('amount', amount)

  const { data: matches, error } = await query
  if (error) {
    console.error('AI transaction lookup error:', error)
    return 'Tentei procurar esse lançamento, mas não consegui consultar com segurança agora. Tente novamente em instantes.'
  }
  if (!matches?.length) return 'Nao achei um lancamento com esses dados. Me diga a descricao e o valor para eu remover com seguranca.'
  if (matches.length > 1) {
    const options = matches.map((tx: any) => `- ${tx.description}, ${Number(tx.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}, ${tx.date}`).join('\n')
    return `Encontrei mais de um possivel lancamento. Me diga qual deles devo apagar:\n${options}`
  }

  const tx = matches[0]
  const removeFutureSeries = tx.recurring_group_id && /\b(recorrente|recorrencia|recorrencias|futuros|proximos)\b/.test(text)
  const deleteQuery = removeFutureSeries
    ? supabase.from('transactions').delete().eq('recurring_group_id', tx.recurring_group_id).gte('date', tx.date)
    : supabase.from('transactions').delete().eq('id', tx.id)
  const { error: deleteError } = await deleteQuery
  if (deleteError) {
    console.error('AI transaction delete error:', deleteError)
    return 'Encontrei o lançamento, mas não consegui remover com segurança. Tente novamente ou remova pela tela de lançamentos.'
  }

  return removeFutureSeries
    ? `Removi "${tx.description}" e as recorrencias futuras a partir de ${tx.date}. Isso melhora a previsao dos proximos meses.`
    : `Removi "${tx.description}" de ${Number(tx.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}. Vou considerar essa retirada nas proximas analises.`
}

async function buildFinancialContext(supabase: any, userId: string): Promise<AIContext> {
  const now    = new Date()
  const start  = format(startOfMonth(now), 'yyyy-MM-dd')
  const end    = format(endOfMonth(now),   'yyyy-MM-dd')
  const creditStart = format(startOfMonth(subMonths(now, 2)), 'yyyy-MM-dd')
  const creditEnd = format(endOfMonth(addMonths(now, 1)), 'yyyy-MM-dd')
  const yearStart = format(startOfYear(now), 'yyyy-MM-dd')
  const yearEnd = format(endOfYear(now), 'yyyy-MM-dd')
  const annualCreditStart = format(startOfMonth(subMonths(startOfYear(now), 2)), 'yyyy-MM-dd')

  const { data: profile } = await supabase.from('profiles').select('household_id, name').eq('id', userId).single()
  if (!profile) throw new Error('Profile not found')

  const hid = profile.household_id
  const { data: allProfiles } = await supabase.from('profiles').select('name').eq('household_id', hid)

  const [txRes, creditTxRes, goalsRes, savingsRes, investRes, banksRes, yearTxRes, annualCreditTxRes, recentTxRes] = await Promise.all([
    supabase.from('transactions').select('*, category:categories(name,icon), bank:banks(*)').eq('household_id', hid).gte('date',start).lte('date',end),
    supabase.from('transactions').select('*, category:categories(name,icon), bank:banks(*)').eq('household_id', hid).eq('status','realizado').gte('date',creditStart).lte('date',creditEnd),
    supabase.from('goals').select('name,target_amount,current_amount,icon').eq('household_id', hid).eq('is_completed', false),
    supabase.from('savings').select('name,type,current_amount,interest_rate').eq('household_id', hid),
    supabase.from('investments').select('name,type,total_invested,current_price,quantity,avg_price').eq('household_id', hid),
    supabase.from('banks').select('*').eq('household_id', hid),
    supabase.from('transactions').select('*, category:categories(name,icon), bank:banks(*)').eq('household_id', hid).gte('date', yearStart).lte('date', yearEnd),
    supabase.from('transactions').select('*, category:categories(name,icon), bank:banks(*)').eq('household_id', hid).eq('status','realizado').gte('date', annualCreditStart).lte('date', yearEnd),
    supabase.from('transactions').select('id,date,description,amount,type,status,category:categories(name),bank:banks(name)').eq('household_id', hid).order('date', { ascending: false }).limit(20),
  ])

  const txs      = txRes.data || []
  const banks    = banksRes.data || []
  const bankById = new Map<string, any>(banks.map((bank: any) => [bank.id, bank]))
  const isCreditTx = (tx: any) => bankById.get(tx.bank_id || '')?.type === 'credito'
  const cashTxs = txs.filter((tx: any) => !isCreditTx(tx))
  const creditInvoiceTxs = (creditTxRes.data || []).filter((tx: any) => {
    const bank = bankById.get(tx.bank_id || '')
    if (!bank || bank.type !== 'credito' || tx.type === 'receita') return false
    return isDateInMonth(getCreditCardPaymentDate(tx.date, bank.due_day, bank.closing_day), now)
  })

  const income = txs
    .filter((t: any) => t.type === 'receita' && t.status === 'realizado')
    .reduce((s: number, t: any) => s + Number(t.amount), 0)
  const plannedIncome = txs
    .filter((t: any) => t.type === 'receita' && t.status !== 'realizado')
    .reduce((s: number, t: any) => s + Number(t.amount), 0)
  const expenses = cashTxs
    .filter((t: any) => t.type !== 'receita' && t.status === 'realizado')
    .reduce((s: number, t: any) => s + Number(t.amount), 0)
  const plannedExpenses = cashTxs
    .filter((t: any) => t.type !== 'receita' && t.status !== 'realizado')
    .reduce((s: number, t: any) => s + Number(t.amount), 0)
    + creditInvoiceTxs.reduce((s: number, t: any) => s + Number(t.amount), 0)

  const catMap: Record<string, { name: string; icon: string; amount: number }> = {}
  for (const tx of [...cashTxs, ...creditInvoiceTxs] as any[]) {
    if (tx.type !== 'receita' && tx.category) {
      const k = tx.category.name
      if (!catMap[k]) catMap[k] = { name: k, icon: tx.category.icon, amount: 0 }
      catMap[k].amount += Number(tx.amount)
    }
  }

  const savings    = (savingsRes.data || []).map((s: any) => ({ name: s.name, type: s.type, amount: Number(s.current_amount), rate: s.interest_rate ? Number(s.interest_rate) : null }))
  const totalSaved = savings.reduce((s: number, sv: any) => s + sv.amount, 0)

  const investments = (investRes.data || []).map((i: any) => {
    const currentVal = Number(i.quantity) * Number(i.current_price)
    const invested   = Number(i.total_invested)
    return { name: i.name, type: i.type, invested, current: currentVal, pl: currentVal - invested }
  })
  const totalInvested = investments.reduce((s: number, i: any) => s + i.invested, 0)
  const totalInvestValue = investments.reduce((s: number, i: any) => s + i.current, 0)
  const bankBalances = banks
    .filter((bank: any) => bank.type !== 'credito')
    .map((bank: any) => ({ name: bank.name, type: bank.type, balance: Number(bank.current_balance || 0) }))
  const cashBalance = bankBalances.reduce((s: number, bank: any) => s + bank.balance, 0)
  const creditCardBills = banks
    .filter((bank: any) => bank.type === 'credito')
    .map((bank: any) => ({
      name: bank.name,
      due_day: bank.due_day,
      closing_day: bank.closing_day,
      amount: creditInvoiceTxs
        .filter((tx: any) => tx.bank_id === bank.id)
        .reduce((s: number, tx: any) => s + Number(tx.amount), 0),
    }))
    .filter((bill: any) => bill.amount > 0)
  const yearTxs = yearTxRes.data || []
  const annualCreditTxs = annualCreditTxRes.data || []
  const monthlyOverview = Array.from({ length: 12 }, (_, index) => {
    const monthDate = new Date(now.getFullYear(), index, 1)
    const monthStart = format(startOfMonth(monthDate), 'yyyy-MM-dd')
    const monthEnd = format(endOfMonth(monthDate), 'yyyy-MM-dd')
    const monthTxs = yearTxs.filter((tx: any) => tx.date >= monthStart && tx.date <= monthEnd)
    const monthCashTxs = monthTxs.filter((tx: any) => !isCreditTx(tx))
    const monthCreditTxs = annualCreditTxs.filter((tx: any) => {
      const bank = bankById.get(tx.bank_id || '')
      if (!bank || bank.type !== 'credito' || tx.type === 'receita') return false
      return isDateInMonth(getCreditCardPaymentDate(tx.date, bank.due_day, bank.closing_day), monthDate)
    })
    const monthIncome = monthTxs.filter((tx: any) => tx.type === 'receita' && tx.status === 'realizado').reduce((s: number, tx: any) => s + Number(tx.amount), 0)
    const monthPlannedIncome = monthTxs.filter((tx: any) => tx.type === 'receita' && tx.status !== 'realizado').reduce((s: number, tx: any) => s + Number(tx.amount), 0)
    const monthDirectExpenses = monthCashTxs.filter((tx: any) => tx.type !== 'receita' && tx.status === 'realizado').reduce((s: number, tx: any) => s + Number(tx.amount), 0)
    const monthPlannedDirectExpenses = monthCashTxs.filter((tx: any) => tx.type !== 'receita' && tx.status !== 'realizado').reduce((s: number, tx: any) => s + Number(tx.amount), 0)
    const monthCardInvoice = monthCreditTxs.reduce((s: number, tx: any) => s + Number(tx.amount), 0)

    return {
      month: format(monthDate, 'MM'),
      year: now.getFullYear(),
      income: monthIncome,
      planned_income: monthPlannedIncome,
      direct_expenses: monthDirectExpenses,
      planned_direct_expenses: monthPlannedDirectExpenses,
      card_invoice: monthCardInvoice,
      projected_balance: monthIncome + monthPlannedIncome - monthDirectExpenses - monthPlannedDirectExpenses - monthCardInvoice,
    }
  })
  const recentTransactions = (recentTxRes.data || []).map((tx: any) => ({
    id: tx.id,
    date: tx.date,
    description: tx.description,
    amount: Number(tx.amount),
    type: tx.type,
    status: tx.status,
    bank: tx.bank?.name || null,
    category: tx.category?.name || null,
  }))

  return {
    current_month_income:    income,
    current_month_expenses:  expenses,
    current_month_balance:   income - expenses,
    planned_month_income: plannedIncome,
    planned_month_expenses: plannedExpenses,
    projected_month_balance: income + plannedIncome - expenses - plannedExpenses,
    projected_cash_balance: cashBalance + income + plannedIncome - expenses - plannedExpenses,
    cash_balance: cashBalance,
    bank_balances: bankBalances,
    credit_card_bills: creditCardBills,
    monthly_overview: monthlyOverview,
    recent_transactions: recentTransactions,
    top_expense_categories:  Object.values(catMap).sort((a, b) => b.amount - a.amount).slice(0, 5),
    goals: (goalsRes.data || []).map((g: any) => ({ name: g.name, target: Number(g.target_amount), current: Number(g.current_amount), icon: g.icon })),
    monthly_history: [],
    profiles: allProfiles || [{ name: profile.name }],
    savings,
    investments,
    total_patrimony: totalSaved + totalInvestValue,
  }
}
