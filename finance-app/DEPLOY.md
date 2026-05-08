# 🚀 Guia de Deploy — Finanças do Casal

## Passo a Passo Completo (com Claude Code)

---

### PASSO 1 — Abrir o Claude Code

```bash
claude
```

Cole este prompt para o Claude Code construir o resto:

```
Preciso que você complete e corrija o projeto Next.js em /finance-app.
Leia o CLAUDE.md para entender a arquitetura completa.

Tarefas:
1. Crie as páginas /transactions, /goals e /settings completas
2. Crie o componente AddTransaction (modal para adicionar transação com todos os campos)
3. Corrija qualquer import faltando
4. Certifique-se que tudo compila sem erro
5. Adicione middleware.ts para proteger rotas autenticadas

Siga o design system do Tailwind definido no tailwind.config.js.
Use os tipos definidos em src/types/index.ts.
```

---

### PASSO 2 — Supabase

1. Acesse **supabase.com** → seu projeto
2. Vá em **SQL Editor**
3. Cole e execute o conteúdo de `schema.sql`
4. Cole e execute o conteúdo de `seed.sql`
5. Vá em **Authentication > Settings**:
   - Site URL: `http://localhost:3000` (dev) ou sua URL Vercel (prod)
   - Allowed redirect URLs: `http://localhost:3000/**`

---

### PASSO 3 — Variáveis de ambiente

```bash
cp .env.example .env.local
```

Preencha `.env.local`:
- Supabase URL → Settings > API > Project URL
- Supabase Anon Key → Settings > API > Project API keys > anon public
- Anthropic API Key → console.anthropic.com > API Keys

---

### PASSO 4 — Instalar e rodar

```bash
npm install
npm run dev
```

Acesse: http://localhost:3000

---

### PASSO 5 — Criar contas do casal

1. Acesse /login
2. Crie a conta do **Jonatas** (primeiro)
3. No Supabase > Table Editor > households, copie o ID criado
4. Crie a conta da **Thuany**
5. No Supabase > profiles, atualize o `household_id` da Thuany para o mesmo ID
   (assim vocês compartilham os dados)

---

### PASSO 6 — Deploy na Vercel

```bash
npx vercel
```

Adicione as variáveis de ambiente na Vercel:
- Dashboard > seu projeto > Settings > Environment Variables

---

### PASSO 7 — Bot Telegram (FUTURO — GRATUITO)

1. Fale com @BotFather no Telegram → `/newbot`
2. Copie o token gerado para `TELEGRAM_BOT_TOKEN`
3. Adicione a route `/api/telegram/webhook`
4. Configure o webhook:
   ```bash
   curl -X POST "https://api.telegram.org/bot{TOKEN}/setWebhook?url=https://seusite.vercel.app/api/telegram/webhook"
   ```

Comandos do bot:
- `/saldo` → saldo do mês
- `/lancar 50 Almoço` → registra despesa
- `/metas` → status das metas
- `/dica` → dica da Fina
- `/comprar Tênis 300` → analisa se deve comprar

---

## Dicas de Uso do Claude Code

Para adicionar novas features, use prompts como:

```
Adicione uma página /reports com:
- Gráfico comparativo de receita vs despesa por categoria nos últimos 12 meses
- Exportação para PDF
- Filtro por período customizável
```

```
Adicione notificações push quando:
- O casal ultrapassar o orçamento de uma categoria
- Uma meta atingir 50%, 75% e 100%
- Uma transação recorrente estiver vencendo
```

```
Implemente o bot do Telegram com os comandos descritos no CLAUDE.md
```
