# 💰 Finanças do Casal — Projeto Completo

## Visão Geral
App de controle financeiro para o casal Jonatas e Thuany. Web app responsivo (mobile + desktop), com IA integrada via Claude API, autenticação, sync em tempo real via Supabase e interface bonita/divertida.

## Stack
- **Next.js 14** (App Router + TypeScript)
- **Supabase** (auth + banco + realtime)
- **Tailwind CSS** + **shadcn/ui**
- **Recharts** (gráficos)
- **Claude API** (IA financeira)
- **Vercel** (deploy)

## Setup Inicial

### 1. Instalar dependências
```bash
npm install
```

### 2. Variáveis de ambiente
Copie `.env.example` para `.env.local` e preencha:
- `NEXT_PUBLIC_SUPABASE_URL` → URL do projeto Supabase
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` → chave anon do Supabase
- `ANTHROPIC_API_KEY` → sua chave da API Claude (NUNCA expor no frontend)

### 3. Banco de dados Supabase
Execute o arquivo `schema.sql` no SQL Editor do Supabase.
Depois execute `seed.sql` para popular categorias e bancos padrão.

### 4. Rodar em desenvolvimento
```bash
npm run dev
```

### 5. Deploy na Vercel
```bash
npx vercel --prod
```
Adicione as variáveis de ambiente na Vercel também.

---

## Arquitetura do App

### Páginas
| Rota | Descrição |
|------|-----------|
| `/login` | Tela de login (email + senha) |
| `/` | Dashboard principal |
| `/transactions` | Lista + lançamento de transações |
| `/goals` | Metas do casal |
| `/ai` | Chat com IA financeira |
| `/settings` | Categorias, bancos, cartões |

### Regras de negócio
- Toda transação tem: data, descrição, valor, categoria, banco/cartão, tipo (receita/despesa/fatura), status (realizado/pendente), quem lançou, observação opcional
- Metas têm nome, valor alvo, valor atual, ícone, cor, prazo, contribuições mensais
- Orçamentos mensais por categoria
- A IA acessa os dados reais do banco via API route segura

---

## IA Financeira — Regras CRÍTICAS

### System prompt da IA (implementar em `/api/ai/route.ts`)
A IA deve:
1. **SOMENTE falar de finanças pessoais** — rejeitar qualquer pergunta fora do tema
2. **Usar dados reais do banco** — sempre buscar transações, saldo, metas antes de responder
3. **NUNCA inventar números** — se não tiver dado, dizer "não tenho esse dado ainda"
4. **Ser prática e direta** — máximo 3 parágrafos, use bullet points
5. **Ser divertida** — tom amigável, emojis com moderação, encorajadora
6. **Ajudar em decisões de compra** — quando perguntarem "devo comprar X?", analisar:
   - Impacto no orçamento do mês
   - Impacto nas metas
   - Alternativas melhores se houver
   - Dar uma nota de 1-10 para a compra

### System prompt template:
```
Você é a "Fina", assistente financeira do casal {nome_casal}. 
Sua missão: ajudá-los a prosperar financeiramente de forma divertida e prática.

DADOS FINANCEIROS ATUAIS (sempre use estes):
- Renda mensal: R$ {renda_total}
- Saldo este mês: R$ {saldo_mes}  
- Gastado este mês: R$ {gasto_mes}
- Principais gastos: {top_categorias}
- Metas ativas: {metas}
- Reserva de emergência: R$ {reserva}

REGRAS RÍGIDAS:
1. Só responda sobre finanças pessoais, orçamento, investimentos, poupança, compras
2. Se perguntarem algo fora disso, diga: "Sou especialista em finanças! Me pergunte sobre dinheiro 💰"
3. NUNCA invente valores ou projete dados que não existam
4. Se o dado não existir no sistema, diga que precisa de mais lançamentos
5. Para pedidos de compra: analise impacto real no orçamento e dê nota de viabilidade

Responda sempre em português brasileiro. Seja a melhor amiga financeira do casal!
```

---

## Design System

### Cores (Tailwind config)
```js
primary: { DEFAULT: '#6366F1', dark: '#4F46E5' }  // Indigo vibrante
success: { DEFAULT: '#10B981' }  // Verde
danger: { DEFAULT: '#EF4444' }   // Vermelho
warning: { DEFAULT: '#F59E0B' }  // Âmbar
```

### Estilo
- Fundo: gradiente suave `from-indigo-50 to-purple-50` (light) / `from-gray-900 to-indigo-950` (dark)
- Cards: `bg-white rounded-2xl shadow-sm border border-gray-100`
- Botão primário: `bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl`
- Fonte: Inter (Google Fonts)
- Animações: `transition-all duration-200`
- Mobile: bottom navigation bar com 5 ícones
- Desktop: sidebar esquerda colapsável

### Componentes principais a criar
1. `<BottomNav>` — navegação mobile (Dashboard, Lançar, Metas, IA, Config)
2. `<Sidebar>` — navegação desktop
3. `<TransactionCard>` — card de transação com swipe para deletar no mobile
4. `<GoalCard>` — card de meta com progress bar animada
5. `<AIChat>` — chat completo com bolhas, typing indicator, sugestões rápidas
6. `<AddTransaction>` — modal/sheet para adicionar transação
7. `<CategoryPicker>` — seletor de categoria com ícones coloridos
8. `<BankPicker>` — seletor de banco/cartão
9. `<MonthSelector>` — seletor de mês com swipe
10. `<SummaryCard>` — card de resumo com valor e variação

---

## Funcionalidades Detalhadas

### Dashboard
- Resumo do mês: Receita | Despesa | Saldo
- Gráfico de barras: últimos 6 meses
- Gráfico de pizza: despesas por categoria
- Card de metas (3 principais com progress)
- Últimos 5 lançamentos
- Insight da IA do dia (gerado automaticamente)
- Indicador "online" mostrando quem está ativo

### Lançamentos
- Lista filtrada por mês
- Filtros: categoria, tipo, quem lançou, banco
- Busca por texto
- Ordenação: data, valor, categoria
- Swipe left para deletar (mobile)
- FAB (+) para adicionar
- Modal de adição com todos os campos:
  - Data (default hoje)
  - Descrição
  - Valor
  - Tipo: Receita / Despesa / Fatura / Transferência
  - Categoria (com ícone)
  - Banco / Cartão
  - Status: Realizado / Pendente / Agendado
  - Quem lançou (Jonatas / Thuany)
  - Observação (opcional)
  - Recorrente? (checkbox)

### Metas
- Cards com animação de progresso
- Histórico de contribuições
- Projeção: "em X meses você atinge essa meta"
- Adicionar contribuição com 1 clique
- Ícones divertidos: ✈️ 🏦 💰 🏠 🎓 🚗 💻

### IA (Fina)
- Chat completo com histórico da sessão
- Sugestões rápidas na abertura
- Modo "Devo comprar?" — formulário especial
- Análise mensal automática
- Dica do dia na home
- Resposta streamada (typewriter effect)
- Indicador de "Fina está digitando..."

### Configurações
- Gerenciar categorias (nome, ícone, cor, tipo)
- Gerenciar bancos/cartões (nome, tipo: conta/crédito/débito, cor)
- Metas de poupança mensal
- Orçamento mensal por categoria
- Perfis (Jonatas e Thuany com avatares)

---

## Integração Futura: Telegram Bot (GRATUITO)

### Setup (implementar depois)
```bash
npm install node-telegram-bot-api
```

### Comandos do bot
- `/saldo` → saldo do mês atual
- `/lancar 50 Almoço Alimentação` → lança transação
- `/metas` → status das metas
- `/dica` → dica da IA
- `/comprar Celular 1500` → análise de compra

### Route: `/api/telegram/webhook`
- Recebe mensagens do Telegram
- Processa comandos
- Responde com dados do Supabase
- Pode chamar a IA Claude
- **Totalmente gratuito** — usar Telegram Bot API

---

## Realtime (Supabase)

### Sincronização entre Jonatas e Thuany
Usar `supabase.channel()` para escutar mudanças em:
- `transactions` — quando um lança, o outro vê em tempo real
- `goals` — atualização de metas
- Indicador de presença (quem está online)

```typescript
// Exemplo de realtime
const channel = supabase
  .channel('transactions')
  .on('postgres_changes', 
    { event: '*', schema: 'public', table: 'transactions' },
    (payload) => { /* atualizar estado */ }
  )
  .subscribe()
```

---

## Segurança (importante para Head de Cybersegurança!)

### Row Level Security (RLS) no Supabase
- Cada registro pertence ao household (não ao usuário individual)
- Ambos Jonatas e Thuany pertencem ao mesmo `household_id`
- Nenhum dado é acessível sem autenticação
- A chave da API Claude fica SOMENTE no servidor (API routes)

### Headers de segurança (next.config.js)
```js
headers: [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=()' },
]
```
