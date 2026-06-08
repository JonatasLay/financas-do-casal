# PROJECT_STATUS — Finanças do Casal

> Documento central de saúde do projeto. Atualizado em: 2026-06-08
> Auditoria completa: código-fonte, lógica de negócio, segurança, performance, UX.

---

## 1. VISÃO GERAL DO PROJETO

| Item | Detalhe |
|------|---------|
| **App** | Controle financeiro para casal (Jonatas + Thuany) |
| **Stack** | Next.js 16 · Supabase · Tailwind CSS · Claude API (Haiku 4.5 / Sonnet 4.6) |
| **Deploy** | Vercel + Supabase Cloud |
| **Status geral** | ✅ Funcional — com bugs identificados a corrigir |
| **Maturidade** | MVP completo com features avançadas |

---

## 2. MAPA DO PROJETO

### Páginas
| Rota | Arquivo | Status |
|------|---------|--------|
| `/` | `src/app/page.tsx` | ✅ Funciona — 2 bugs de perf |
| `/transactions` | `src/app/transactions/page.tsx` | ✅ Funciona — cálculo inconsistente |
| `/goals` | `src/app/goals/page.tsx` | ✅ Funciona |
| `/savings` | `src/app/savings/page.tsx` | ✅ Funciona |
| `/investments` | `src/app/investments/page.tsx` | ✅ Funciona |
| `/ai` | `src/app/ai/page.tsx` | ✅ Funciona |
| `/settings` | `src/app/settings/page.tsx` | ✅ Funciona |
| `/reports/neusa` | `src/app/reports/neusa/page.tsx` | ✅ Funciona |
| `/login` | `src/app/login/page.tsx` | ✅ Funciona |

### API Routes
| Rota | Status |
|------|--------|
| `POST/GET/DELETE /api/ai` | ✅ Funciona — vulnerabilidade de segurança |
| `GET /api/ai/tip` | ✅ Funciona |
| `GET /api/ai/savings-tip` | ✅ Funciona |
| `GET /api/ai/goal-tip` | ✅ Funciona |
| `POST /api/admin/mfa/reset` | ✅ Funciona |

---

## 3. BUGS CRÍTICOS

### 🔴 BUG-001 — Vulnerabilidade de segurança: tokens de confirmação injetáveis
**Arquivo:** `src/app/api/ai/route.ts` — linhas 235, 331  
**Gravidade:** CRÍTICA  
**Descrição:**  
O fluxo de confirmação de lançamentos usa marcadores de string `[CONFIRMAR_LANCAMENTO]` e `[EXCLUIR_ID:uuid]` incorporados no histórico de conversa. Um usuário pode enviar mensagens contendo esses tokens diretamente para:
- Criar transações sem passar pelo fluxo de confirmação/revisão
- Deletar uma transação específica (informando o UUID) sem confirmação

```typescript
// route.ts linha 235
const confirmedAction = raw.includes('[CONFIRMAR_LANCAMENTO]')
// route.ts linha 331
const confirmedId = raw.match(/\[EXCLUIR_ID:([0-9a-f-]+)\]/i)?.[1]
```

**Impacto:** Usuário pode manipular seu próprio histórico financeiro sem validação adequada.  
**Correção sugerida:**
- Armazenar o estado de confirmação pendente no banco de dados (tabela `ai_conversations`) com TTL curto
- Ou usar um token de sessão assinado no servidor que expire após uso
- Nunca confiar em marcadores no conteúdo da mensagem para autorizar ações

---

### 🔴 BUG-002 — N+1 Queries no Dashboard: histórico mensal faz 6 queries sequenciais
**Arquivo:** `src/app/page.tsx` — linhas 431–441  
**Gravidade:** CRÍTICA (performance)  
**Descrição:**  
O cálculo do histórico dos últimos 6 meses executa uma query separada para cada mês dentro de um loop `for`, totalizando 6 queries sequenciais extras a cada carregamento do Dashboard.

```typescript
// page.tsx linhas 431-441
for (let i = 5; i >= 0; i--) {
  const d = subMonths(currentDate, i)
  const s = format(startOfMonth(subMonths(d, 2)), 'yyyy-MM-dd')
  const e = format(endOfMonth(d), 'yyyy-MM-dd')
  const { data } = await supabase.from('transactions').select(...) // ← QUERY DENTRO DO LOOP
    .eq('household_id', hid).eq('status', 'realizado').gte('date', s).lte('date', e)
  ...
}
```

**Impacto:** +6 round-trips ao banco por carregamento. Em redes lentas, soma ~1-3s de latência extra.  
**Correção sugerida:**
- Fazer uma única query que busque os últimos 8 meses (cobrindo o range de crédito)
- Calcular os 6 pontos do histórico no cliente com os dados já carregados

```typescript
// Substituir o loop por:
const historyStart = format(startOfMonth(subMonths(currentDate, 7)), 'yyyy-MM-dd')
const historyEnd = format(endOfMonth(currentDate), 'yyyy-MM-dd')
const { data: historyData } = await supabase.from('transactions').select(...).gte('date', historyStart).lte('date', historyEnd)
// Depois calcular os 6 pontos com historyData
```

---

## 4. BUGS DE ALTA PRIORIDADE

### 🟠 BUG-003 — `monthly_history` no AIContext sempre retorna array vazio
**Arquivo:** `src/lib/server/financial-context.ts` — linha 131  
**Gravidade:** ALTA  
**Descrição:**  
O campo `monthly_history` do `AIContext` nunca é populado, retornando sempre `[]`. O tipo define o campo mas nenhum dado é enviado para a IA.

```typescript
// financial-context.ts linha 131
monthly_history: [],  // ← SEMPRE VAZIO
```

**Impacto:** A IA não tem acesso ao histórico de receitas/despesas mensais via esse campo. O `monthly_overview` cobre parcialmente esse caso, mas com estrutura diferente.  
**Correção:** Remover o campo do tipo se não for utilizado, ou populá-lo com os dados do `monthly_overview`.

---

### 🟠 BUG-004 — `getHouseholdId` chamado duas vezes por request da IA
**Arquivo:** `src/app/api/ai/route.ts` — linhas 93–96, 131–134  
**Gravidade:** ALTA (performance/redundância)  
**Descrição:**  
As funções `saveConversation` e `refreshFinancialMemory` são chamadas em paralelo com `Promise.allSettled`, mas cada uma faz sua própria query `SELECT household_id FROM profiles WHERE id = userId`.

```typescript
// Linha 21-24 em route.ts
const persistenceResults = await Promise.allSettled([
  saveConversation(supabase, user.id, ...),   // ← query household_id
  refreshFinancialMemory(supabase, user.id, ...) // ← query household_id novamente
])
```

**Impacto:** 2 queries duplicadas por mensagem enviada à Fina.  
**Correção:**
```typescript
const householdId = await getHouseholdId(supabase, user.id)
await Promise.allSettled([
  saveConversation(supabase, user.id, householdId, ...),
  refreshFinancialMemory(supabase, user.id, householdId, ...)
])
```

---

### 🟠 BUG-005 — Corrupção de encoding nos comentários de `page.tsx`
**Arquivo:** `src/app/page.tsx` — múltiplas linhas (ex: 39, 146, 192...)  
**Gravidade:** ALTA (indica problema de encoding no arquivo)  
**Descrição:**  
Os separadores de seção nos comentários estão corrompidos:
```typescript
// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Helpers Ã¢â€â‚¬...
// Original era: // ─── Helpers ────────
```
Isso é double-encoding UTF-8→Latin-1. Indica que o arquivo foi salvo ou aberto com encoding errado em algum momento.  
**Impacto:** Cosmético mas pode causar problemas em ferramentas de análise de código e diff.  
**Correção:** Re-salvar o arquivo com UTF-8 corretamente, substituindo os comentários corrompidos.

---

### 🟠 BUG-006 — `supabase` client não memoizado nas páginas principais
**Arquivos:** `src/app/page.tsx:339`, `src/app/transactions/page.tsx:396`, `src/app/settings/page.tsx:...`  
**Gravidade:** ALTA  
**Descrição:**  
O cliente Supabase é instanciado diretamente no corpo do componente sem `useMemo`:

```typescript
// Errado (Dashboard, Transactions, Settings):
export default function DashboardPage() {
  const supabase = createClient()  // ← recriado a cada render
```

```typescript
// Correto (usado apenas no AI page):
const supabase = useMemo(() => createClient(), [])
```

**Impacto:** Nova instância criada em cada re-render. Pode causar:
- Subscriptions de realtime duplicadas
- Instabilidade em ambientes de desenvolvimento com strict mode
- Pequeno overhead de memória

**Correção:** Usar `useMemo(() => createClient(), [])` em todas as páginas.

---

### 🟠 BUG-007 — Visão mensal no contexto da IA limitada ao ano selecionado
**Arquivo:** `src/lib/server/financial-context.ts` — linhas 71–84  
**Gravidade:** ALTA  
**Descrição:**  
O `monthlyOverview` enviado para a IA sempre gera os 12 meses do **ano do `selectedDate`**, não os últimos 12 meses:

```typescript
const monthlyOverview = Array.from({ length: 12 }, (_, index) => {
  const monthDate = new Date(selectedDate.getFullYear(), index, 1) // ← ano fixo
  ...
})
```

**Impacto:** Se o usuário consulta a Fina em junho de 2026, ela recebe Jan-Dez/2026. Se quiser ver análise de dez/2025, a IA não terá dados de 2026 para contexto.  
**Correção:** Gerar os últimos 13 meses a partir de hoje:
```typescript
const monthlyOverview = Array.from({ length: 13 }, (_, index) => {
  const monthDate = subMonths(new Date(), 12 - index)
  ...
})
```

---

## 5. BUGS DE MÉDIA PRIORIDADE

### 🟡 BUG-008 — `neusaReceivable` calculado de forma inconsistente
**Arquivos:** `src/app/page.tsx` (linhas 507–510) vs `src/app/transactions/page.tsx` (linhas 580–583)  
**Gravidade:** MÉDIA  
**Descrição:**  
O valor "a receber da Neuza" pode mostrar números diferentes no Dashboard e na página de Transações para o mesmo mês.

- **Dashboard:** usa `creditInvoiceDueThisMonth` (transações de cartão filtradas pelo ciclo de fechamento/vencimento)
- **Transactions:** usa `creditInvoiceTransactions` filtrado por comparação direta de data

A diferença está na lógica de inclusão de transações de cartão que pertencem a faturas de meses diferentes.

**Correção:** Extrair a lógica de cálculo Neuza para uma função compartilhada em `finance-summary.ts`, garantindo consistência.

---

### 🟡 BUG-009 — `generateSavingsInsight` declarada como `async` sem nenhum `await`
**Arquivo:** `src/lib/ai.ts` — linha 155  
**Gravidade:** BAIXA/MÉDIA  
**Descrição:**  
```typescript
export async function generateSavingsInsight(context: AIContext): Promise<string> {
  // ... sem nenhum await
  return [...].join('\n')
}
```
A função é `async` mas nunca usa `await`. Ela simplesmente calcula e retorna uma string. Deve ser síncrona.  
**Impacto:** Nenhum funcional, mas é enganoso para quem lê o código.

---

### 🟡 BUG-010 — Comportamento contraditório: `paymentMethod = 'credito'` mas banco não é crédito
**Arquivo:** `src/components/transactions/AddTransactionModal.tsx` — linhas 127–131  
**Gravidade:** MÉDIA (UX)  
**Descrição:**  
A flag `isCreditExpense` que habilita o formulário de parcelas requer:
```typescript
const isCreditExpense = paymentMethod === 'credito' && !!selectedBank && selectedBank.type === 'credito' && type !== 'receita'
```

Se o usuário seleciona "Cartão Crédito" como forma de pagamento mas a conta selecionada é do tipo `conta` (corrente), `isCreditExpense = false` e o formulário de parcelas/fatura não aparece. O feedback visual é ausente, confundindo o usuário.  
**Correção:** Adicionar aviso "Selecione um banco do tipo crédito para parcelar" quando `paymentMethod === 'credito'` mas `selectedBank?.type !== 'credito'`.

---

### 🟡 BUG-011 — `DailyTip`: `fetchTip` como dependência ausente no `useEffect`
**Arquivo:** `src/components/dashboard/DailyTip.tsx` — linhas 56–71  
**Gravidade:** MÉDIA  
**Descrição:**  
```typescript
const fetchTip = async () => { ... } // captura `month` em closure
useEffect(() => {
  ...
  else fetchTip() // ESLint: react-hooks/exhaustive-deps warning
}, [cacheKey])
```
`fetchTip` captura `month` via closure. Se `month` mudar sem que `cacheKey` mude (improvável mas possível), a função chamada seria stale.  
**Correção:** Envolver `fetchTip` em `useCallback` com `[month, cacheKey]` como dependências.

---

### 🟡 BUG-012 — `handlePay` em Transactions: dependência silenciosa de `bank_id`
**Arquivo:** `src/app/transactions/page.tsx` — linhas 488–496  
**Gravidade:** MÉDIA (UX)  
**Descrição:**  
```typescript
const handlePay = async (tx: Transaction) => {
  if (!tx.bank_id) return void toast.error('Selecione a conta usada antes de marcar como pago')
  ...
}
```
O botão "Pagar" aparece mesmo quando não há banco selecionado, mas clicando ele apenas mostra um erro. O botão deveria ser desabilitado ou mostrar um tooltip indicando que o banco precisa ser preenchido primeiro.  
**Correção:** Desabilitar o botão se `!tx.bank_id` e adicionar `title` explicativo.

---

### 🟡 BUG-013 — Recorrência anual: loop para em dezembro, sem aviso ao usuário
**Arquivo:** `src/components/transactions/AddTransactionModal.tsx` — linhas 183–184  
**Gravidade:** MÉDIA (UX)  
**Descrição:**  
```typescript
const recurringMonths = isRecurring ? 12 - startDate.getMonth() : 1
```
Uma transação recorrente criada em dezembro cria apenas 1 lançamento. Em novembro, cria 2. Em janeiro, cria 12. Nenhum feedback é dado ao usuário sobre quantos meses serão criados.  
**Correção:** Mostrar "Serão criados X lançamentos até dezembro/YYYY" antes de salvar.

---

## 6. MELHORIAS IMPORTANTES

### 💡 MELHORIA-001 — Rate limiting na API de IA
**Arquivo:** `src/app/api/ai/route.ts`  
**Prioridade:** ALTA  
**Descrição:** Não existe controle de rate limiting nos endpoints `/api/ai/*`. Um usuário poderia enviar centenas de mensagens em sequência, gerando custos altos com a API Anthropic.  
**Sugestão:** Implementar limite de X requisições por minuto por usuário (ex: usando Redis ou uma tabela `rate_limits` no Supabase com TTL).

---

### 💡 MELHORIA-002 — `projectedCashBalance` com potencial dupla contagem
**Arquivo:** `src/lib/finance-summary.ts` — linhas 114–142  
**Prioridade:** ALTA  
**Descrição:**  
`projectedCashBalance = cashBalance + accumulatedResult`

O `cashBalance` é o saldo manual das contas. O `accumulatedResult` inclui **todas** as transações realizadas E planejadas do mês. Se o saldo manual não foi atualizado desde o início do mês, transações já realizadas são contadas novamente.

**Impacto:** O "caixa previsto no fim do mês" pode estar inflado dependendo de quando o saldo foi atualizado pela última vez.  
**Sugestão:**
1. Documentar claramente para o usuário que o saldo precisa ser mantido atualizado
2. Ou implementar atualização automática de saldo (via webhook Supabase quando transações são marcadas como realizadas)
3. Ou adicionar aviso quando o `balance_tracking_started_at` for de mais de X dias atrás

---

### 💡 MELHORIA-003 — Falta indicação de "saldo desatualizado" nas contas
**Arquivo:** `src/app/page.tsx` — `AccountBalancesCard`  
**Prioridade:** MÉDIA  
**Descrição:** O saldo das contas (`bank.current_balance`) é atualizado manualmente. Não há nenhuma indicação visual de quando foi a última atualização (`balance_tracking_started_at`).  
**Sugestão:** Adicionar "atualizado há X dias" em cada conta, com destaque amarelo se > 7 dias.

---

### 💡 MELHORIA-004 — Erro silencioso na Fina ao carregar histórico
**Arquivo:** `src/app/ai/page.tsx` — linha 46  
**Prioridade:** MÉDIA  
**Descrição:**  
```typescript
const history = historyResponse.ok ? await historyResponse.json() : { messages: [] }
```
Se a API falha ao carregar o histórico, o erro é silenciado e a conversa começa vazia, sem avisar o usuário que o histórico não foi carregado.  
**Sugestão:** Exibir um aviso discreto "Histórico não carregado" se `!historyResponse.ok`.

---

### 💡 MELHORIA-005 — Sem feedback de loading ao trocar de mês no Dashboard
**Arquivo:** `src/app/page.tsx` — linha 652  
**Prioridade:** MÉDIA  
**Descrição:**  
```typescript
onChange={d => { setCurrentDate(d); setLoading(true) }}
```
O estado de loading é setado mas há um breve flash onde os valores antigos aparecem antes de `loading = true` propagar para todos os componentes filhos, pois o estado `loading` e `currentDate` são setados em renders distintos.  
**Sugestão:** Considerar resetar os dados de transações no mesmo `setState` da mudança de mês para evitar o flash de dados antigos.

---

### 💡 MELHORIA-006 — CLAUDE.md documentação desatualizada
**Arquivo:** `CLAUDE.md`  
**Prioridade:** BAIXA  
**Descrição:** O `CLAUDE.md` descreve "Next.js 14" mas o projeto roda Next.js 16. O design system descrito também não reflete o que está implementado (usa Tailwind customizado, não `shadcn/ui`).  
**Sugestão:** Atualizar `CLAUDE.md` para refletir o estado real do projeto.

---

### 💡 MELHORIA-007 — Ausência de ErrorBoundary nos componentes de IA
**Arquivo:** `src/app/ai/page.tsx`, `src/components/dashboard/DailyTip.tsx`  
**Prioridade:** MÉDIA  
**Descrição:** Se o componente da Fina ou a DailyTip lançar uma exceção em runtime, toda a página quebra. Existe um `ErrorBoundary.tsx` no projeto mas não é usado nesses componentes.  
**Sugestão:** Envolver componentes de IA com `<ErrorBoundary>`.

---

### 💡 MELHORIA-008 — Sem aviso antes de deletar recorrências futuras
**Arquivo:** `src/app/transactions/page.tsx` — linhas 476–481  
**Prioridade:** MÉDIA  
**Descrição:**  
```typescript
const query = deletingTx.recurring_group_id
  ? supabase.from('transactions').delete().eq('recurring_group_id', deletingTx.recurring_group_id).gte('date', deletingTx.date)
  : supabase.from('transactions').delete().eq('id', deletingTx.id)
```
Ao apagar uma transação recorrente, o `ConfirmDialog` avisa "e as recorrências futuras serão apagadas", mas não informa **quantas** serão deletadas. Isso pode ser surpreendente.  
**Sugestão:** Antes de confirmar, fazer query para contar quantas recorrências futuras existem e mostrar o número.

---

### 💡 MELHORIA-009 — Sem paginação em listas longas
**Arquivo:** `src/app/transactions/page.tsx`  
**Prioridade:** MÉDIA  
**Descrição:** A página de transações carrega **todas** as transações do mês de uma vez. Para meses com muitos lançamentos (100+), isso pode ser lento e gerar listas muito longas.  
**Sugestão:** Implementar paginação ou virtualização de lista (`react-window` ou `@tanstack/virtual`).

---

### 💡 MELHORIA-010 — `StatementImportModal`: sem validação de duplicatas cross-mês
**Arquivo:** `src/components/transactions/StatementImportModal.tsx`  
**Prioridade:** MÉDIA  
**Descrição:** A detecção de duplicatas na importação de extrato compara apenas com `existingTransactions` que são as transações do mês **atual** carregadas na página de transações. Se o extrato importado tiver transações de meses anteriores, não haverá detecção de duplicata.  
**Sugestão:** Na importação, buscar do banco as transações das datas do extrato, não usar apenas as transações em memória.

---

## 7. SEGURANÇA — CHECKLIST

| Item | Status | Observação |
|------|--------|------------|
| RLS ativado em todas as tabelas | ✅ | Confirmado no schema |
| ANTHROPIC_API_KEY server-side only | ✅ | Apenas em API routes |
| Headers de segurança (X-Frame, CSP) | ✅ | Configurado em next.config |
| Autenticação MFA suportada | ✅ | `/login` verifica aal2 |
| Marcadores de confirmação injetáveis | ❌ | **BUG-001** — crítico |
| Rate limiting na API de IA | ❌ | **MELHORIA-001** |
| Validação de input nos formulários | ⚠️ | Básica — sem sanitização de XSS em `notes` |
| Secrets no git | ✅ | `.env.local` no .gitignore |
| SQL injection | ✅ | Supabase client parametriza automaticamente |

---

## 8. PERFORMANCE — CHECKLIST

| Item | Status | Observação |
|------|--------|------------|
| Queries em paralelo com `Promise.all` | ✅ | Maioria das páginas |
| N+1 no histórico do Dashboard | ❌ | **BUG-002** — 6 queries sequenciais |
| `supabase` client não memoizado | ❌ | **BUG-006** — 3 páginas afetadas |
| `getHouseholdId` duplicado por request | ❌ | **BUG-004** |
| Cache de dica da Fina em sessionStorage | ✅ | Evita chamada a cada reload |
| Realtime subscriptions | ✅ | Dashboard + Transactions |
| Dedup de transações com `Map` | ✅ | `dedupeTransactionsById` |

---

## 9. DATABASE — ESTADO DAS MIGRATIONS

| Migration | Status | Descrição |
|-----------|--------|-----------|
| Schema base (`schema.sql`) | ✅ Aplicado | Estrutura principal |
| `migration-responsible-party.sql` | ✅ Aplicado | Campo `sogra` |
| `migration-payment-method.sql` | ✅ Aplicado | `payment_method` |
| `migration-recurring-series.sql` | ✅ Aplicado | `recurring_group_id` |
| `migration-neusa-cost-sharing.sql` | ✅ Aplicado | `neusa_share_amount` |
| `migration-settlement-date-and-bank-balance.sql` | ✅ Aplicado | `settled_at`, `current_balance` |
| `migration-card-cycle-and-bank-balance.sql` | ✅ Aplicado | `due_day`, `closing_day` |
| `migration-fina-memory.sql` | ✅ Aplicado | `fina_financial_profiles` |
| `migration-admin-invites-futures.sql` | ✅ Aplicado | Controle de convites |
| `migration-security-hardening.sql` | ✅ Aplicado | Triggers de segurança |
| `migration-card-ledger-integrity.sql` | ✅ Aplicado | Integridade de fatura |
| `migration-dashboard-balance-integrity.sql` | ✅ Aplicado | Integridade de saldo |
| `migration-final-financial-integrity.sql` | ✅ Aplicado | Validações finais |

**Nota sobre `month` e `year`:** Esses campos são `GENERATED ALWAYS AS ... STORED` no PostgreSQL. São calculados automaticamente a partir de `date` e **não devem ser inseridos manualmente**. O código está correto por não os incluir nos inserts.

---

## 10. PLANO DE CORREÇÃO PRIORIZADO

### Sprint 1 — Crítico (fazer imediatamente)
1. **[BUG-001]** Redesenhar fluxo de confirmação da Fina: armazenar estado de confirmação no banco, não no conteúdo da mensagem
2. **[BUG-002]** Eliminar N+1 no histórico do Dashboard: uma única query para o range de 8 meses

### Sprint 2 — Alta prioridade
3. **[BUG-006]** Memoizar `supabase` client com `useMemo` em Dashboard, Transactions e Settings
4. **[BUG-004]** Resolver `getHouseholdId` duplicado passando `householdId` como parâmetro
5. **[BUG-007]** Corrigir `monthlyOverview` para gerar últimos 13 meses, não ano fixo
6. **[MELHORIA-001]** Implementar rate limiting na API de IA
7. **[BUG-003]** Corrigir ou remover `monthly_history: []` do AIContext

### Sprint 3 — Melhoria de qualidade
8. **[BUG-005]** Corrigir encoding do `page.tsx` (re-salvar com UTF-8)
9. **[BUG-008]** Unificar cálculo de `neusaReceivable` em função compartilhada
10. **[BUG-010]** Feedback visual quando `paymentMethod=credito` mas banco não é crédito
11. **[BUG-013]** Mostrar quantos lançamentos recorrentes serão criados
12. **[MELHORIA-007]** Adicionar ErrorBoundary nos componentes de IA
13. **[MELHORIA-003]** Indicar quando saldo das contas está desatualizado

### Sprint 4 — Polimento
14. **[MELHORIA-006]** Atualizar `CLAUDE.md` com stack real (Next.js 16, sem shadcn/ui)
15. **[MELHORIA-008]** Mostrar contagem de recorrências antes de deletar
16. **[MELHORIA-010]** Validação cross-mês na importação de extrato

---

## 11. FUNCIONALIDADES DOCUMENTADAS MAS NÃO IMPLEMENTADAS

| Feature | Arquivo referência | Status |
|---------|-------------------|--------|
| Telegram Bot | `CLAUDE.md` | ⏳ Pendente |
| Notificações Push | `CLAUDE.md` | ⏳ Pendente |
| Reports/PDF por categoria | `CLAUDE.md` | ⏳ Pendente |
| Mobile App React Native | `CLAUDE.md` | ⏳ Pendente |
| `monthly_history` no AI context | `src/types/index.ts` | ❌ Campo existe, nunca populado |

---

## 12. DEPENDÊNCIAS EXTERNAS

| Dependência | Versão | Observação |
|-------------|--------|------------|
| Next.js | 16.2.6 | OK |
| React | 18 | OK |
| @supabase/supabase-js | Latest | OK |
| @anthropic-ai/sdk | Latest | `claude-haiku-4-5-20251001` + `claude-sonnet-4-6` |
| framer-motion | Latest | Animações dashboard |
| recharts | Latest | Gráficos |
| date-fns | Latest | Datas |
| react-number-format | Latest | Input de valor monetário |
| sonner | Latest | Toasts |
| lucide-react | Latest | Ícones |

---

## 13. ARQUITETURA DA LÓGICA FINANCEIRA

### Fluxo de cálculo mensal
```
transactions + banks
      ↓
calculateMonthProjection(targetMonth)
      ├── cashRows: transações em conta (não crédito) no mês
      │   ├── realizedOperationalIncome  (receitas casal realizadas)
      │   ├── plannedOperationalIncome   (receitas casal agendadas)
      │   ├── realizedReimbursementIncome (reembolsos Neuza realizados)
      │   ├── realizedDirectExpenses     (despesas casal realizadas, líquidas de Neuza)
      │   └── plannedDirectExpenses      (despesas casal agendadas, líquidas de Neuza)
      └── cardRows: transações de crédito com fatura vencendo no mês
          ├── cardInvoice                (fatura líquida do casal)
          └── grossCardInvoice           (fatura total incluindo Neuza)
            ↓
      householdResult = operationalIncome - directExpenses - cardInvoice
      result (cashResult) = income - grossDirectExpenses - grossCardInvoice
```

### Distinção `householdResult` vs `cashResult`
- **`householdResult`**: resultado operacional líquido do casal (exclui Neuza)
- **`cashResult`**: impacto real no caixa (inclui todos os fluxos que passam pelas contas)

### Modelo Neuza
```
responsible_party = 'sogra'          → despesa inteiramente dela
neusa_share_amount > 0               → parte da despesa do casal é dela
is_neusa_reimbursement = true        → receita = reembolso dela
affects_household_cash = false       → despesa dela que NÃO sai das contas do casal
```

---

*Última auditoria: 2026-06-08 | Próxima revisão sugerida: após Sprint 1*
