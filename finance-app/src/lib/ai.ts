import Anthropic from '@anthropic-ai/sdk'
import { AIContext, AIMessage } from '@/types'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

// ============================================================
// SYSTEM PROMPT DA "FINA" — IA Financeira do Casal
// ============================================================
export function buildSystemPrompt(context: AIContext): string {
  const topCats = context.top_expense_categories
    .slice(0, 5)
    .map(c => `${c.icon} ${c.name}: R$ ${c.amount.toFixed(2)}`)
    .join(', ')

  const goalsStr = context.goals
    .map(g => `${g.icon} ${g.name}: R$ ${g.current.toFixed(2)} de R$ ${g.target.toFixed(2)} (${Math.round(g.current / g.target * 100)}%)`)
    .join(' | ')

  const names = context.profiles.map(p => p.name).join(' e ')

  return `Você é a "Fina" 💜, assistente financeira pessoal e de confiança do casal ${names}.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 DADOS FINANCEIROS REAIS DO CASAL (use sempre estes):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Receita deste mês: R$ ${context.current_month_income.toFixed(2)}
• Despesas deste mês: R$ ${context.current_month_expenses.toFixed(2)}
• Saldo deste mês: R$ ${context.current_month_balance.toFixed(2)} ${context.current_month_balance >= 0 ? '✅' : '⚠️'}
• Principais gastos: ${topCats || 'Sem dados ainda'}
• Metas ativas: ${goalsStr || 'Nenhuma meta cadastrada'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 REGRAS RÍGIDAS (NUNCA viole):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. ESCOPO: Responda SOMENTE sobre finanças pessoais — orçamento, poupança, dívidas, investimentos conservadores, planejamento, compras. Se perguntarem sobre outro tema, diga: "Sou especialista em finanças! Me pergunte sobre dinheiro 💰"

2. DADOS: NUNCA invente números, percentuais ou projeções que não estejam nos dados acima. Se não tiver informação suficiente, diga: "Preciso de mais lançamentos para analisar isso com precisão 📊"

3. INVESTIMENTOS: Não recomende ativos específicos (ações, fundos, criptos individuais). Fale de categorias gerais (renda fixa, Tesouro Direto, CDB) como conceito educativo, sempre sugerindo consultar um especialista.

4. COMPRAS: Quando perguntarem "devo comprar X?", analise com base NOS DADOS REAIS:
   - Impacto percentual no orçamento mensal
   - Se está dentro do saldo disponível
   - Se compromete alguma meta
   - Dê uma nota de viabilidade de 1-10
   - Sugira alternativas se houver

5. PRECISÃO: Baseie-se nos dados acima. Calcule antes de responder.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💜 SEU JEITO DE SER:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Amigável, encorajadora e divertida — como uma amiga expert em finanças
• Direta e prática — sem enrolação
• Use emojis com moderação (1-3 por resposta)
• Máximo 3 parágrafos OU use bullet points curtos
• Chame pelo nome quando souber quem está perguntando
• Celebre conquistas! Se o saldo está positivo, comemore! 🎉
• Se as contas estão ruins, seja honesta mas empática

Responda sempre em português brasileiro informal e caloroso.`
}

// ============================================================
// FUNÇÃO PRINCIPAL DE CHAT
// ============================================================
export async function chatWithFina(
  messages: AIMessage[],
  context: AIContext,
  stream = false
) {
  const systemPrompt = buildSystemPrompt(context)

  const anthropicMessages = messages.map(m => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))

  if (stream) {
    return anthropic.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      system: systemPrompt,
      messages: anthropicMessages,
    })
  }

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 800,
    system: systemPrompt,
    messages: anthropicMessages,
  })

  return (response.content[0] as { type: string; text: string }).text
}

// ============================================================
// GERAR DICA DIÁRIA AUTOMÁTICA
// ============================================================
export async function generateDailyTip(context: AIContext): Promise<string> {
  const systemPrompt = buildSystemPrompt(context)

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 200,
    system: systemPrompt,
    messages: [{
      role: 'user',
      content: 'Gere UMA dica financeira rápida e prática para hoje, baseada na situação atual do casal. Seja específica e motivadora. Máximo 2 frases.'
    }],
  })

  return (response.content[0] as { type: string; text: string }).text
}

// ============================================================
// ANÁLISE DE COMPRA
// ============================================================
export async function analyzePurchase(
  item: string,
  price: number,
  context: AIContext
): Promise<string> {
  const systemPrompt = buildSystemPrompt(context)

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    system: systemPrompt,
    messages: [{
      role: 'user',
      content: `Devo comprar: "${item}" por R$ ${price.toFixed(2)}. 
Analise com base nos meus dados financeiros reais e me dê:
1. Uma nota de viabilidade de 1-10
2. O impacto percentual no orçamento mensal
3. Se compromete alguma meta
4. Sua recomendação final em 1 frase
Seja direta e objetiva!`
    }],
  })

  return (response.content[0] as { type: string; text: string }).text
}
