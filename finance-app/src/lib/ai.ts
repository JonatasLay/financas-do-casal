import Anthropic from '@anthropic-ai/sdk'
import { AIContext, AIMessage } from '@/types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const MODEL      = 'claude-haiku-4-5-20251001'
const MODEL_CHAT = 'claude-sonnet-4-6'

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export function buildSystemPrompt(context: AIContext): string {
  const topCats = context.top_expense_categories.slice(0, 5)
    .map(c => `${c.icon} ${c.name}: ${brl(c.amount)}`).join(' | ')

  const goalsStr = context.goals
    .map(g => `${g.icon} ${g.name}: ${brl(g.current)} / ${brl(g.target)} (${Math.round(g.current/g.target*100)}%)`)
    .join(' | ')

  const savingsStr = (context.savings || [])
    .map(s => `${s.name} (${s.type}): ${brl(s.amount)}${s.rate ? ` @ ${s.rate}% a.a.` : ''}`).join(' | ')

  const investStr = (context.investments || [])
    .map(i => `${i.name} (${i.type}): investido ${brl(i.invested)}, atual ${brl(i.current)}, P&L ${i.pl >= 0 ? '+' : ''}${brl(i.pl)}`).join(' | ')

  const bankBalances = (context.bank_balances || [])
    .map(b => `${b.name}: ${brl(b.balance)}`).join(' | ')

  const creditBills = (context.credit_card_bills || [])
    .map(c => `${c.name}: ${brl(c.amount)} vence dia ${c.due_day || 10}${c.closing_day ? `, fecha dia ${c.closing_day}` : ''}`).join(' | ')

  const names = context.profiles.map(p => p.name).join(' e ')
  const patrimony = context.total_patrimony ? brl(context.total_patrimony) : 'não calculado'

  return `Você é a "Fina" 💜, assistente financeira pessoal e de confiança do casal ${names}.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 DADOS FINANCEIROS REAIS (use sempre):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Receita recebida este mês: ${brl(context.current_month_income)}
• Receita prevista/agendada no mês: ${brl(context.planned_month_income || 0)}
• Despesas pagas no mês: ${brl(context.current_month_expenses)}
• Despesas/faturas previstas no mês: ${brl(context.planned_month_expenses || 0)}
• Saldo realizado do mês: ${brl(context.current_month_balance)} ${context.current_month_balance >= 0 ? '✅' : '⚠️'}
• Saldo projetado do mês: ${brl(context.projected_month_balance ?? context.current_month_balance)}
• Saldo atual em contas: ${brl(context.cash_balance || 0)}${bankBalances ? ` (${bankBalances})` : ''}
• Faturas previstas: ${creditBills || 'Sem faturas previstas no mês'}
• Principais gastos: ${topCats || 'Sem dados'}
• Metas ativas: ${goalsStr || 'Nenhuma'}
• Poupança: ${savingsStr || 'Nenhum registro'}
• Investimentos: ${investStr || 'Nenhum registro'}
• Patrimônio total estimado: ${patrimony}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 REGRAS RÍGIDAS (NUNCA viole):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. ESCOPO: Responda SOMENTE sobre finanças pessoais — orçamento, poupança, dívidas, investimentos conservadores, planejamento, compras, patrimônio.
   Se perguntarem outro tema: "Sou especialista em finanças! Me pergunte sobre dinheiro 💰"

2. DADOS: NUNCA invente números. Se não tiver dado, diga "Preciso de mais lançamentos para analisar isso 📊"

3. INVESTIMENTOS: Para recomendações de investimento:
   - Analise o perfil baseado nos dados disponíveis
   - Fale de categorias (renda fixa, Tesouro Direto, CDB, fundos, ações brasileiras, FIIs)
   - Sugira alocação percentual baseada no saldo disponível
   - Sempre mencione: "consulte um assessor de investimentos certificado (AAI/CFP) para decisões importantes"
   - Priorize: reserva de emergência (6x despesas mensais) antes de investimentos de risco

4. COMPRAS: Analise impacto no orçamento real, nota 1-10, alternativas.

5. PATRIMÔNIO: Ajude a calcular e crescer o patrimônio líquido do casal.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💜 SEU JEITO:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Amigável, prática, direta — como uma CFP amiga do casal
• Use emojis com moderação (máx 3)
• Máximo 3 parágrafos ou bullet points curtos
• Celebre conquistas, seja honesta nos alertas
• Português brasileiro informal e caloroso`
}

export async function chatWithFina(messages: AIMessage[], context: AIContext) {
  const response = await anthropic.messages.create({
    model: MODEL_CHAT,
    max_tokens: 800,
    system: buildSystemPrompt(context),
    messages: messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
  })
  return (response.content[0] as { type: string; text: string }).text
}

export async function generateDailyTip(context: AIContext): Promise<string> {
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 180,
    system: buildSystemPrompt(context),
    messages: [{ role: 'user', content: 'Gere UMA dica financeira rápida e específica para hoje, baseada na situação real do casal. Máximo 2 frases. Seja direta e motivadora.' }],
  })
  return (response.content[0] as { type: string; text: string }).text
}

export async function analyzePurchase(item: string, price: number, context: AIContext): Promise<string> {
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 450,
    system: buildSystemPrompt(context),
    messages: [{
      role: 'user',
      content: `Devo comprar: "${item}" por ${brl(price)}.\nAnalise com base nos dados reais e me dê:\n1. Nota de viabilidade 1-10\n2. Impacto % no orçamento mensal\n3. Se compromete alguma meta ou reserva de emergência\n4. Recomendação final em 1 frase\nSeja direto e objetivo.`,
    }],
  })
  return (response.content[0] as { type: string; text: string }).text
}

export async function analyzeInvestments(context: AIContext, question: string): Promise<string> {
  const response = await anthropic.messages.create({
    model: MODEL_CHAT,
    max_tokens: 600,
    system: buildSystemPrompt(context),
    messages: [{
      role: 'user',
      content: question,
    }],
  })
  return (response.content[0] as { type: string; text: string }).text
}

export async function generateInvestmentInsight(context: AIContext): Promise<string> {
  const hasEmergencyFund = (context.savings || []).reduce((s, sv) => s + sv.amount, 0)
  const emergencyNeeded  = context.current_month_expenses * 6
  const emergencyOk      = hasEmergencyFund >= emergencyNeeded

  const prompt = emergencyOk
    ? `Com reserva de emergência adequada, sugira em 2 frases uma estratégia de investimento diversificada para o casal baseada no saldo mensal disponível de ${brl(context.current_month_balance)}.`
    : `O casal ainda não tem reserva de emergência suficiente (meta: ${brl(emergencyNeeded)}, atual: ${brl(hasEmergencyFund)}). Explique em 2 frases a importância e sugira onde construí-la.`

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 200,
    system: buildSystemPrompt(context),
    messages: [{ role: 'user', content: prompt }],
  })
  return (response.content[0] as { type: string; text: string }).text
}
