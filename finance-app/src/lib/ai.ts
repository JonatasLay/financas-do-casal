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
- Use portugues brasileiro correto, com acentos, concordancia e frases curtas.
- Se um numero nao estiver nos dados fornecidos, diga que nao ha dado suficiente em vez de estimar.`
}

export async function chatWithFina(messages: AIMessage[], context: AIContext) {
  const response = await anthropic.messages.create({
    model: MODEL_CHAT,
    temperature: 0.1,
    max_tokens: 1100,
    system: buildSystemPrompt(context),
    messages: messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
  })
  return (response.content[0] as { type: string; text: string }).text
}

export async function generateDailyTip(context: AIContext): Promise<string> {
  const response = await anthropic.messages.create({
    model: MODEL,
    temperature: 0.1,
    max_tokens: 360,
    system: buildSystemPrompt(context),
    messages: [{
      role: 'user',
      content: `Gere a Dica da Fina para o dashboard do mes selecionado.
Prioridade de raciocinio:
1. Comece pelo saldo projetado do mes, nao pelo saldo atual em conta.
2. Considere receitas previstas/agendadas, despesas diretas realizadas/agendadas, faturas de cartao, saldo em contas, metas, poupanca e investimentos.
3. Se o saldo em conta estiver apertado, explique que e uma tensao de caixa atual, mas diferencie do resultado previsto do mes.
4. Traga uma orientacao pratica para hoje e uma provocacao curta se houver risco de gasto impulsivo.
Formato: 3 a 5 bullets curtos, com valores reais. Nao seja longa.`,
    }],
  })
  return (response.content[0] as { type: string; text: string }).text
}

export async function generateSavingsInsight(context: AIContext): Promise<string> {
  const savings = context.savings || []
  const totalSaved = savings.reduce((sum, item) => sum + item.amount, 0)
  const weightedRate = totalSaved > 0
    ? savings.reduce((sum, item) => sum + item.amount * (item.rate || 0), 0) / totalSaved
    : 0
  const estimatedYearYield = totalSaved * weightedRate / 100
  const projectedBalance = context.projected_month_balance ?? context.current_month_balance
  const monthlyOutflow = Math.max(0, context.current_month_expenses + (context.planned_month_expenses || 0))
  const emergencyMin = monthlyOutflow * 3
  const emergencyIdeal = monthlyOutflow * 6
  const emergencyCoverage = monthlyOutflow > 0 ? totalSaved / monthlyOutflow : 0
  const action = projectedBalance < 0
    ? 'Pause novos aportes ate o fluxo do mes ficar positivo; preservar caixa agora vale mais que aumentar reserva.'
    : emergencyCoverage < 3
      ? `Priorize reserva: faltam ${brl(Math.max(0, emergencyMin - totalSaved))} para 3 meses de seguranca.`
      : emergencyCoverage < 6
        ? `Continue aportando para chegar perto de 6 meses (${brl(emergencyIdeal)}).`
        : 'Reserva esta forte; avalie separar excedente por metas ou investimentos com prazo maior.'

  return [
    `Diagnostico: voces tem ${brl(totalSaved)} guardados, cobrindo ~${emergencyCoverage.toFixed(1)} mes(es) do fluxo previsto. Minimo sugerido: ${brl(emergencyMin)}; ideal: ${brl(emergencyIdeal)}.`,
    `Rendimento: taxa media cadastrada ~${weightedRate.toFixed(2)}% a.a., estimativa de ${brl(estimatedYearYield)}/ano. Confira se essa taxa esta realista para o produto.`,
    `Acao: ${action}`,
  ].join('\n')
}

export async function generateGoalInsight(context: AIContext, goal: {
  name: string
  target: number
  current: number
  monthly: number
  deadline?: string | null
}): Promise<string> {
  const remaining = Math.max(0, goal.target - goal.current)
  const projectedBalance = context.projected_month_balance ?? context.current_month_balance
  const now = new Date()
  const deadline = goal.deadline ? new Date(`${goal.deadline}T12:00:00`) : null
  const monthsToDeadline = deadline
    ? Math.max(0, (deadline.getFullYear() - now.getFullYear()) * 12 + (deadline.getMonth() - now.getMonth()))
    : null
  const requiredMonthly = monthsToDeadline && monthsToDeadline > 0
    ? remaining / monthsToDeadline
    : remaining
  const monthsAtCurrent = goal.monthly > 0 ? Math.ceil(remaining / goal.monthly) : null
  const deadlineLabel = deadline
    ? `${String(deadline.getMonth() + 1).padStart(2, '0')}/${deadline.getFullYear()}`
    : 'sem prazo'

  const viability = remaining <= 0
    ? 'Meta ja atingida.'
    : goal.monthly <= 0
      ? `Sem contribuicao mensal definida. Para chegar ate ${deadlineLabel}, precisaria de ${brl(requiredMonthly)}/mes.`
      : monthsToDeadline && monthsAtCurrent && monthsAtCurrent > monthsToDeadline
        ? `No ritmo atual (${brl(goal.monthly)}/mes), levaria ~${monthsAtCurrent} meses; o prazo pede ~${brl(requiredMonthly)}/mes.`
        : `No ritmo atual (${brl(goal.monthly)}/mes), a meta fica viavel em ~${monthsAtCurrent} meses.`

  const cashWarning = projectedBalance <= 0
    ? `Fluxo do mes esta negativo (${brl(projectedBalance)}). Nao force aporte agora sem receita confirmada.`
    : requiredMonthly > projectedBalance
      ? `Aporte necessario (${brl(requiredMonthly)}/mes) passa do saldo projetado (${brl(projectedBalance)}). Ajuste prazo ou valor.`
      : `Saldo projetado do mes (${brl(projectedBalance)}) comporta a meta se o aporte for tratado como prioridade.`

  const recommendation = projectedBalance <= 0
    ? 'Prioridade: estabilizar o mes antes de aportar. Quando a receita entrar, separe o aporte no mesmo dia.'
    : goal.monthly <= 0
      ? `Defina uma contribuicao inicial de ate ${brl(Math.min(requiredMonthly, projectedBalance))}/mes e reavalie depois da proxima receita.`
      : monthsToDeadline && monthsAtCurrent && monthsAtCurrent > monthsToDeadline
        ? `Caminhos: aumentar para ${brl(requiredMonthly)}/mes, reduzir a meta ou empurrar o prazo.`
        : 'Mantenha aporte automatico mensal e acompanhe se as faturas nao roubam esse dinheiro.'

  return [
    `Meta: ${goal.name} | guardado ${brl(goal.current)} de ${brl(goal.target)}; falta ${brl(remaining)}.`,
    deadline ? `Prazo: ${deadlineLabel}, faltam ~${monthsToDeadline} mes(es). ${viability}` : `Prazo: nao definido. ${viability}`,
    `Saude financeira: ${cashWarning}`,
    `Proxima acao: ${recommendation}`,
  ].join('\n')
}

export async function analyzePurchase(item: string, price: number, context: AIContext): Promise<string> {
  const response = await anthropic.messages.create({
    model: MODEL_CHAT,
    temperature: 0.1,
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
    temperature: 0.1,
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
    temperature: 0.1,
    max_tokens: 240,
    system: buildSystemPrompt(context),
    messages: [{ role: 'user', content: prompt }],
  })
  return (response.content[0] as { type: string; text: string }).text
}
