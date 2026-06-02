import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 30

import { createClient } from '@/lib/supabase/server'
import { chatWithFina, analyzePurchase, analyzeInvestments, updateFinancialMemory } from '@/lib/ai'
import { AIContext, AIMessage } from '@/types'
import { format, subDays } from 'date-fns'
import { buildFinancialContext as buildSharedFinancialContext } from '@/lib/server/financial-context'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { messages, mode, purchaseItem, purchasePrice, investmentQuestion } = await req.json()
    const allMessages = normalizeMessages(messages)
    const context = await buildSharedFinancialContext(supabase, user.id)
    const respond = async (response: string) => {
      const persistenceResults = await Promise.allSettled([
        saveConversation(supabase, user.id, allMessages, response, context),
        refreshFinancialMemory(supabase, user.id, allMessages, context.fina_memory || ''),
      ])
      for (const result of persistenceResults) {
        if (result.status === 'rejected') console.error('Fina persistence error:', result.reason)
      }
      return NextResponse.json({ response })
    }
    const lastMessage = allMessages.filter(m => m.role === 'user').at(-1)?.content || ''
    if (!mode || mode === 'chat') {
      const actionText = resolveActionTextFromConversation(allMessages, lastMessage)
      const action = await tryHandleTransactionAction(supabase, user.id, actionText)
      if (action) return respond(action)
    }

    if (mode === 'purchase' && purchaseItem && purchasePrice) {
      return respond(await analyzePurchase(purchaseItem, purchasePrice, context))
    }
    if (mode === 'investment' && investmentQuestion) {
      return respond(await analyzeInvestments(context, investmentQuestion))
    }

    return respond(await chatWithFina(allMessages, context))
  } catch (error) {
    console.error('AI API error:', error)
    return NextResponse.json({ error: 'Erro interno. Tente novamente.' }, { status: 500 })
  }
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('ai_conversations')
    .select('messages')
    .eq('created_by', user.id)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('Fina history lookup error:', error)
    return NextResponse.json({ error: 'Nao foi possivel carregar o historico' }, { status: 500 })
  }
  return NextResponse.json({ messages: normalizeMessages(data?.messages) })
}

export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase.from('ai_conversations').delete().eq('created_by', user.id)
  if (error) return NextResponse.json({ error: 'Nao foi possivel iniciar uma nova conversa' }, { status: 500 })
  return NextResponse.json({ ok: true })
}

function normalizeMessages(messages: unknown): AIMessage[] {
  if (!Array.isArray(messages)) return []
  return messages
    .filter((message): message is AIMessage => message?.role === 'user' || message?.role === 'assistant')
    .map(message => ({
      role: message.role,
      content: String(message.content || '').slice(0, 6000),
      timestamp: message.timestamp || new Date().toISOString(),
    }))
    .slice(-60)
}

async function getHouseholdId(supabase: any, userId: string) {
  const { data } = await supabase.from('profiles').select('household_id').eq('id', userId).single()
  return data?.household_id as string | undefined
}

async function saveConversation(supabase: any, userId: string, messages: AIMessage[], response: string, context: AIContext) {
  const householdId = await getHouseholdId(supabase, userId)
  if (!householdId) return
  const storedMessages = normalizeMessages([...messages, { role: 'assistant', content: response, timestamp: new Date().toISOString() }])
  const snapshot = {
    cash_balance: context.cash_balance,
    projected_cash_balance: context.projected_cash_balance,
    projected_month_balance: context.projected_month_balance,
  }
  const { data: latest, error: latestError } = await supabase
    .from('ai_conversations')
    .select('id')
    .eq('created_by', userId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (latestError) throw latestError

  if (latest?.id) {
    const { error } = await supabase.from('ai_conversations').update({ messages: storedMessages, context_snapshot: snapshot }).eq('id', latest.id)
    if (error) throw error
    return
  }

  const { error } = await supabase.from('ai_conversations').insert({
    household_id: householdId,
    created_by: userId,
    messages: storedMessages,
    context_snapshot: snapshot,
  })
  if (error) throw error
}

async function refreshFinancialMemory(supabase: any, userId: string, messages: AIMessage[], existingMemory: string) {
  if (!messages.some(message => message.role === 'user')) return
  const householdId = await getHouseholdId(supabase, userId)
  if (!householdId) return
  const profileSummary = await updateFinancialMemory(existingMemory, messages)
  if (!profileSummary || profileSummary === existingMemory) return
  const { error } = await supabase.from('fina_financial_profiles').upsert({
    household_id: householdId,
    updated_by: userId,
    profile_summary: profileSummary,
  }, { onConflict: 'household_id' })
  if (error) throw error
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
  const confirmedAction = raw.includes('[CONFIRMAR_LANCAMENTO]')
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
  const bank = banks.find((b: any) => bankSearchText.includes(String(b.name).toLowerCase())) || null
  const category = categories.find((c: any) => c.type !== (type === 'receita' ? 'despesa' : 'receita') && categorySearchText.includes(String(c.name).toLowerCase()))
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

  if ((text.includes('cartao') || text.includes('cartão')) && !bank) {
    return 'Qual cartão devo usar? Diga o nome exato, por exemplo: "Magazine Luiza" ou "Cartão BB".'
  }

  if (!confirmedAction) {
    return [
      '[CONFIRMAR_LANCAMENTO]',
      'Revise antes de eu gravar:',
      `- Descrição: ${description}`,
      `- Tipo: ${transactionType === 'receita' ? 'receita' : 'despesa'}`,
      `- Valor: ${amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
      `- Data: ${date.split('-').reverse().join('/')}`,
      `- Conta/cartão: ${bank?.name || 'não informado'}`,
      `- Categoria: ${category?.name || 'sem categoria'}`,
      `- Responsável: ${text.includes('neusa') ? 'Neusa' : 'casal'}`,
      '',
      'Posso confirmar este lançamento? Responda "sim" para gravar.',
    ].join('\n')
  }

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
    affects_household_cash: !text.includes('neusa') || bank?.type === 'credito',
    payment_method: paymentMethod,
  })

  if (error) {
    console.error('AI transaction insert error:', error)
    return 'Tentei lançar, mas não consegui gravar com segurança. Revise valor, data, conta e categoria, e tente novamente.'
  }
  return `Lançado com sucesso: ${description}, ${transactionType === 'receita' ? 'receita' : 'despesa'} de ${amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}${bank ? ` em ${bank.name}` : ''}.`
}

async function tryDeleteTransactionFromMessage(supabase: any, userId: string, raw: string) {
  const text = raw.toLowerCase()
  const amount = parseMoney(raw)
  const { data: profile } = await supabase.from('profiles').select('household_id').eq('id', userId).single()
  if (!profile?.household_id) return 'Nao encontrei seu perfil para remover o lancamento.'
  const confirmedId = raw.match(/\[EXCLUIR_ID:([0-9a-f-]+)\]/i)?.[1]

  if (confirmedId) {
    const { data: confirmedTx } = await supabase
      .from('transactions')
      .select('id, date, description, amount, type, status, recurring_group_id')
      .eq('household_id', profile.household_id)
      .eq('id', confirmedId)
      .single()
    if (!confirmedTx) return 'Nao encontrei mais esse lancamento. Ele pode ter sido removido em outra tela.'
    return deleteMatchedTransaction(supabase, confirmedTx, text)
  }

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
  return [
    `[EXCLUIR_ID:${tx.id}]`,
    'Revise antes de eu excluir:',
    `- Descricao: ${tx.description}`,
    `- Valor: ${Number(tx.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
    `- Data: ${tx.date.split('-').reverse().join('/')}`,
    '',
    'Posso confirmar? Responda "sim, exclua" para remover.',
  ].join('\n')
}

async function deleteMatchedTransaction(supabase: any, tx: any, text: string) {
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
