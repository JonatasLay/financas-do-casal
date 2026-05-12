import Anthropic from '@anthropic-ai/sdk'
import { AIContext, AIMessage } from '@/types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const MODEL = 'claude-haiku-4-5-20251001'
const MODEL_CHAT = 'claude-sonnet-4-6'

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export function buildSystemPrompt(context: AIContext): string {
  const topCats = context.top_expense_categories.slice(0, 5)
    .map(c => `${c.icon} ${c.name}: ${brl(c.amount)}`).join(' | ')

  const goalsStr = context.goals
    .map(g => `${g.icon} ${g.name}: ${brl(g.current)} / ${brl(g.target)} (${Math.round(g.current / g.target * 100)}%)`)
    .join(' | ')

  const savingsStr = (context.savings || [])
    .map(s => `${s.name} (${s.type}): ${brl(s.amount)}${s.rate ? ` @ ${s.rate}% a.a.` : ''}`).join(' | ')

  const investStr = (context.investments || [])
    .map(i => `${i.name} (${i.type}): investido ${brl(i.invested)}, atual ${brl(i.current)}, P&L ${i.pl >= 0 ? '+' : ''}${brl(i.pl)}`).join(' | ')

  const bankBalances = (context.bank_balances || [])
    .map(b => `${b.name}: ${brl(b.balance)}`).join(' | ')

  const creditBills = (context.credit_card_bills || [])
    .map(c => `${c.name}: ${brl(c.amount)} vence dia ${c.due_day || 10}${c.closing_day ? `, fecha dia ${c.closing_day}` : ''}`).join(' | ')

  const monthlyOverview = (context.monthly_overview || [])
    .map(m => `${m.month}/${m.year}: receitas ${brl(m.income + m.planned_income)}, despesas diretas ${brl(m.direct_expenses + m.planned_direct_expenses)}, fatura ${brl(m.card_invoice)}, saldo projetado ${brl(m.projected_balance)}`)
    .join('\n')

  const recentTransactions = (context.recent_transactions || [])
    .slice(0, 15)
    .map(t => `${t.date} - ${t.description}: ${t.type === 'receita' ? '+' : '-'}${brl(t.amount)} (${t.status}${t.bank ? `, ${t.bank}` : ''}${t.category ? `, ${t.category}` : ''})`)
    .join('\n')

  const names = context.profiles.map(p => p.name).join(' e ')
  const patrimony = context.total_patrimony ? brl(context.total_patrimony) : 'nao calculado'

  return `Voce e a Fina, a assessora financeira, contabil e operacional do casal ${names}. Aja como uma CFO familiar: organize a casa, proteja o caixa, reduza decisoes impulsivas, crie estrategia e provoque o casal quando o padrao de gasto ameacar os objetivos.

DADOS FINANCEIROS REAIS
- Receita recebida este mes: ${brl(context.current_month_income)}
- Receita prevista/agendada no mes: ${brl(context.planned_month_income || 0)}
- Despesas diretas pagas no mes: ${brl(context.current_month_expenses)}
- Despesas diretas/faturas previstas no mes: ${brl(context.planned_month_expenses || 0)}
- Saldo realizado do mes: ${brl(context.current_month_balance)}
- Saldo projetado do mes: ${brl(context.projected_month_balance ?? context.current_month_balance)}
- Saldo atual em contas: ${brl(context.cash_balance || 0)}${bankBalances ? ` (${bankBalances})` : ''}
- Faturas previstas: ${creditBills || 'Sem faturas previstas no mes'}
- Visao mes a mes do ano:
${monthlyOverview || 'Sem visao anual disponivel'}
- Lancamentos recentes:
${recentTransactions || 'Sem lancamentos recentes disponiveis'}
- Principais gastos: ${topCats || 'Sem dados'}
- Metas ativas: ${goalsStr || 'Nenhuma'}
- Poupanca: ${savingsStr || 'Nenhum registro'}
- Investimentos: ${investStr || 'Nenhum registro'}
- Patrimonio total estimado: ${patrimony}

REGRAS RIGIDAS
1. Escopo: responda somente sobre financas pessoais, orcamento familiar, compras, dividas, cartoes, metas, patrimonio, investimentos, planejamento e acoes dentro do app.
2. Dados: nunca invente numeros. Use os valores acima. Se perguntar sobre um mes especifico, procure na visao mes a mes antes de responder.
3. Acoes: o sistema consegue executar comandos explicitos de lancar/remover antes da sua resposta. Se a acao ja foi executada, confirme e explique o impacto. Se voce ainda estiver apenas conversando e faltar dado ou houver ambiguidade, peca o minimo necessario e diga "posso lancar/remover para voce se confirmar". Nunca diga que nao consegue executar acoes no app.
4. Compras: compare saldo projetado, saldo em contas, fatura atual/futura, reserva de emergencia, impacto nas metas e risco comportamental. Termine com uma recomendacao clara: comprar a vista, parcelar em ate X, adiar, ou nao comprar agora.
5. Investimentos: primeiro reserva de emergencia e fluxo de caixa. Depois fale em categorias, percentuais e riscos. Nao prometa rentabilidade. Para decisoes relevantes, recomende validar com profissional certificado.
6. Postura: seja consultiva e firme. Se o casal estiver gastando sem controle, fale com carinho, mas sem passar pano. Transforme dados em plano: acao hoje, ajuste no mes, estrategia em 90 dias.

JEITO DE RESPONDER
- Amigavel, pratica, direta, com raciocinio de especialista financeiro-contabil.
- Prefira bullets curtos, numeros e conclusao objetiva.
- Use emojis com moderacao.
- Celebre conquistas, mas seja honesta nos alertas.
- Portugues brasileiro informal e caloroso.`
}

export async function chatWithFina(messages: AIMessage[], context: AIContext) {
  const response = await anthropic.messages.create({
    model: MODEL_CHAT,
    max_tokens: 1100,
    system: buildSystemPrompt(context),
    messages: messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
  })
  return (response.content[0] as { type: string; text: string }).text
}

export async function generateDailyTip(context: AIContext): Promise<string> {
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 220,
    system: buildSystemPrompt(context),
    messages: [{ role: 'user', content: 'Gere UMA dica financeira rapida e especifica para hoje, baseada na situacao real do casal. Maximo 2 frases. Seja direta, util e, se necessario, provocativa.' }],
  })
  return (response.content[0] as { type: string; text: string }).text
}

export async function analyzePurchase(item: string, price: number, context: AIContext): Promise<string> {
  const response = await anthropic.messages.create({
    model: MODEL_CHAT,
    max_tokens: 850,
    system: buildSystemPrompt(context),
    messages: [{
      role: 'user',
      content: `Quero comprar "${item}" por ${brl(price)}. Com base nos dados reais, responda como minha assessora financeira:
1. Se compensa comprar agora ou adiar
2. Se e melhor a vista ou parcelado, e em quantas vezes no maximo
3. Impacto no saldo projetado, contas, fatura e metas
4. Nota de viabilidade 1-10
5. Recomendacao final clara e uma provocacao honesta se eu estiver sendo impulsivo.`,
    }],
  })
  return (response.content[0] as { type: string; text: string }).text
}

export async function analyzeInvestments(context: AIContext, question: string): Promise<string> {
  const response = await anthropic.messages.create({
    model: MODEL_CHAT,
    max_tokens: 900,
    system: buildSystemPrompt(context),
    messages: [{ role: 'user', content: question }],
  })
  return (response.content[0] as { type: string; text: string }).text
}

export async function generateInvestmentInsight(context: AIContext): Promise<string> {
  const hasEmergencyFund = (context.savings || []).reduce((s, sv) => s + sv.amount, 0)
  const emergencyNeeded = context.current_month_expenses * 6
  const emergencyOk = hasEmergencyFund >= emergencyNeeded

  const prompt = emergencyOk
    ? `Com reserva de emergencia adequada, sugira em 2 frases uma estrategia de investimento diversificada para o casal baseada no saldo mensal disponivel de ${brl(context.current_month_balance)}.`
    : `O casal ainda nao tem reserva de emergencia suficiente (meta: ${brl(emergencyNeeded)}, atual: ${brl(hasEmergencyFund)}). Explique em 2 frases a importancia e sugira onde construir.`

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 240,
    system: buildSystemPrompt(context),
    messages: [{ role: 'user', content: prompt }],
  })
  return (response.content[0] as { type: string; text: string }).text
}
