# 🚀 Guia Completo — VS Code + Claude Code + GitHub
## Finanças do Casal — Do Zero ao Deploy

---

## ETAPA 1 — Criar o repositório no GitHub

1. Acesse github.com → botão verde **"New"**
2. Nome do repo: `financas-do-casal`
3. Visibilidade: **Private** (seus dados financeiros!)
4. ✅ Add README
5. Clique **Create repository**
6. Botão verde **Code** → **Open with GitHub Desktop** ou copie a URL HTTPS
7. Clone localmente:
   ```
   git clone https://github.com/SEU_USER/financas-do-casal.git
   cd financas-do-casal
   ```

---

## ETAPA 2 — Copiar os arquivos do projeto

1. Extraia o `finance-app.zip` que você baixou
2. Copie **todo o conteúdo** da pasta `finance-app/` para dentro de `financas-do-casal/`
3. Abra a pasta `financas-do-casal` no **VS Code**

---

## ETAPA 3 — Configurar Supabase (5 min)

### 3a. Criar projeto no Supabase
1. Acesse supabase.com → **New Project**
2. Nome: `financas-do-casal`
3. Senha do banco: anote em lugar seguro
4. Região: **South America (São Paulo)**
5. Aguarde ~2 minutos

### 3b. Executar o banco de dados
1. No Supabase: menu lateral → **SQL Editor**
2. Clique **New query**
3. Abra o arquivo `schema.sql` do projeto, copie tudo e cole → clique **Run**
4. Nova query → abra `seed.sql`, cole → clique **Run**
5. ✅ Pronto! Banco configurado com todas categorias e bancos

### 3c. Pegar as chaves
1. Supabase → menu **Settings** → **API**
2. Copie:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## ETAPA 4 — Configurar variáveis de ambiente

No VS Code, crie o arquivo `.env.local` na raiz do projeto:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=cole_a_chave_anon_public_aqui
ANTHROPIC_API_KEY=cole_a_chave_anthropic_aqui
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

> ⚠️ IMPORTANTE: Adicione `.env.local` ao `.gitignore` (já deve estar lá pelo Next.js)

---

## ETAPA 5 — Construir com Claude Code no VS Code

### Como funciona o Claude Code no VS Code:
- Clique no ícone do **Claude** na barra lateral esquerda
- Você vê um chat — é aqui que você cola os prompts abaixo
- O Claude Code lê todos os seus arquivos, escreve código e faz mudanças automaticamente
- Use `@` para referenciar arquivos específicos

---

## PROMPTS — Cole no Claude Code (VS Code)

### 🟢 PROMPT 1 — Setup inicial (cole primeiro)

```
Olá! Estou construindo um app de controle financeiro para mim e minha esposa.

Por favor leia o arquivo CLAUDE.md para entender toda a arquitetura e requisitos do projeto.

Depois faça o seguinte na ordem:
1. Crie o arquivo `middleware.ts` na raiz do projeto para proteger todas as rotas (exceto /login) exigindo autenticação via Supabase
2. Instale todas as dependências do package.json rodando `npm install`
3. Me confirme se o projeto compila rodando `npm run build` e me diz quais erros aparecem

Aguarde minha confirmação antes de continuar.
```

---

### 🟢 PROMPT 2 — Página de Transações

```
Agora crie a página de Lançamentos completa em `src/app/transactions/page.tsx`.

Requisitos:
- Lista de todas as transações do mês selecionado
- Filtros por: tipo (receita/despesa), categoria, quem lançou (Jonatas/Thuany), banco
- Campo de busca por descrição
- Botão FAB (+) que abre modal de adicionar transação
- No mobile: swipe left na transação para aparecer botão de deletar

Crie também o componente `src/components/transactions/AddTransactionModal.tsx` com:
- Campo: Data (default hoje)
- Campo: Descrição (texto livre)
- Campo: Valor (teclado numérico no mobile)
- Campo: Tipo (Receita / Despesa / Fatura / Transferência) — botões de seleção visual
- Campo: Categoria (grade de ícones coloridos buscados do Supabase)
- Campo: Banco/Cartão (lista do Supabase)
- Campo: Status (Realizado ✅ / Pendente ⏳ / Agendado 📅)
- Campo: Quem lançou (Jonatas / Thuany) — detectar automaticamente pelo usuário logado
- Campo: Observação (opcional, textarea pequeno)
- Checkbox: Lançamento recorrente

Use o design system do tailwind.config.js. Cards brancos, bordas suaves, botões em indigo-600.
Use sonner para toast de sucesso/erro.
Integre com Supabase usando o client de src/lib/supabase/client.ts
```

---

### 🟢 PROMPT 3 — Página de Metas

```
Crie a página de Metas em `src/app/goals/page.tsx`.

Requisitos:
- Grid de cards de metas com: ícone grande, nome, barra de progresso animada, valor atual / valor total, % concluído, projeção "em X meses você atinge essa meta"
- Botão "Contribuir" em cada card — abre mini modal para adicionar valor
- Botão "Nova meta" — abre modal com campos: nome, valor alvo, contribuição mensal, prazo (opcional), ícone (grid de emojis: ✈️🏦💰🏠🎓🚗💻📱🎁🐾), cor
- Ao atingir 100%: confetti e badge "Concluída! 🎉"
- Histórico de contribuições de cada meta (accordion expansível)

Crie também `src/components/goals/GoalCard.tsx` e `src/components/goals/AddGoalModal.tsx`

A projeção de meses deve ser: Math.ceil((target - current) / monthly_contribution)
Se monthly_contribution for 0, mostrar "Defina uma contribuição mensal"
```

---

### 🟢 PROMPT 4 — Página de Configurações

```
Crie a página de Configurações em `src/app/settings/page.tsx` com 4 seções em abas:

ABA 1 — Perfil:
- Nome do usuário (editável)
- Cor do avatar (color picker com cores predefinidas)
- Emoji do avatar

ABA 2 — Categorias:
- Lista de todas as categorias com ícone e cor
- Botão para adicionar nova categoria (nome, tipo, ícone emoji, cor)
- Swipe/botão para deletar categorias personalizadas (não deixar deletar as padrão)

ABA 3 — Bancos e Cartões:
- Lista de bancos/cartões cadastrados
- Botão para adicionar novo (nome, tipo: conta/crédito/débito/dinheiro, cor)
- Cores pré-definidas por banco popular (Inter laranja, Nubank roxo, BB amarelo)

ABA 4 — Orçamentos:
- Por categoria, definir limite mensal de gasto
- Barra de progresso mostrando quanto já foi usado do orçamento
- Alerta visual quando ultrapassar 80% do orçamento

Salve tudo no Supabase com feedback de toast para o usuário.
```

---

### 🟢 PROMPT 5 — Melhorar o Dashboard

```
Melhore a página principal `src/app/page.tsx`:

1. Corrija o bug da variável `monthEnd` que está fora do componente
2. Adicione um card de "Orçamentos do mês" mostrando as categorias com orçamento definido e quanto foi usado
3. Adicione animações suaves com framer-motion na entrada dos cards (staggered)
4. No mobile, o botão (+) do header deve abrir o modal de adicionar transação diretamente
5. Adicione pull-to-refresh no mobile

Certifique-se que todos os imports estão corretos e o TypeScript não tem erros.
```

---

### 🟢 PROMPT 6 — Polimento e PWA

```
Finalize o app com:

1. Crie `public/manifest.json` para PWA (Progressive Web App — instalar no celular como app):
   - name: "Finanças do Casal"
   - short_name: "Finanças"
   - theme_color: "#6366F1"
   - background_color: "#EEF2FF"
   - display: "standalone"
   - icons com tamanhos 192x192 e 512x512

2. Adicione loading states bonitos (skeleton) em todas as páginas

3. Adicione error boundaries para tratar erros graciosamente

4. Garanta que o app é 100% responsivo — teste mentalmente em tela de 375px (iPhone SE) e 1440px (desktop)

5. Adicione na página /ai um botão "Compartilhar análise" que copia um resumo financeiro do mês para a área de transferência

6. Rode `npm run build` e corrija TODOS os erros TypeScript que aparecerem
```

---

### 🟢 PROMPT 7 — Deploy na Vercel

```
Me ajude a fazer o deploy na Vercel:

1. Verifique se tem algum arquivo de configuração necessário para Vercel
2. Confirme que o `next.config.js` está correto
3. Me diz exatamente quais variáveis de ambiente devo adicionar na Vercel
4. Há algum problema com as API routes que precisa de atenção?
5. O Supabase precisa de alguma configuração adicional de CORS ou redirect URLs para produção?

Após o deploy, me diz como testar se tudo está funcionando.
```

---

## ETAPA 6 — Criar contas do casal

Após o primeiro deploy:

1. Acesse o app → `/login` → **Criar conta** (Jonatas primeiro)
2. No Supabase → **Table Editor** → tabela `households` → copie o `id` criado
3. Acesse o app novamente → **Criar conta** (Thuany)
4. No Supabase → **Table Editor** → tabela `profiles` → encontre o registro da Thuany
5. Edite o campo `household_id` e coloque o mesmo ID do Jonatas
6. ✅ Agora vocês dois compartilham os mesmos dados em tempo real!

---

## ETAPA 7 — Commitar no GitHub

No VS Code, use o painel **Source Control** (ícone de ramificação na barra lateral):
1. Clique no `+` para adicionar todos os arquivos
2. Mensagem: `feat: projeto inicial financas do casal`
3. Clique **Commit & Push**

---

## FUTURO — Bot do Telegram (Gratuito)

Quando quiser adicionar, use este prompt no Claude Code:

```
Adicione integração com Telegram Bot ao projeto.

1. Instale: npm install node-telegram-bot-api @types/node-telegram-bot-api

2. Crie `src/app/api/telegram/webhook/route.ts` que:
   - Recebe mensagens do Telegram via webhook
   - Verifica o secret token no header para segurança
   - Suporta os comandos:
     /saldo — retorna receita, despesa e saldo do mês atual
     /lancar [valor] [descrição] — lança uma despesa (ex: /lancar 50 Almoço)
     /metas — lista todas as metas com % de progresso
     /dica — chama a API da Fina e retorna uma dica financeira
     /comprar [item] [valor] — ex: /comprar Tênis 300 — analisa a compra com IA
   
3. Adicione TELEGRAM_BOT_TOKEN e TELEGRAM_WEBHOOK_SECRET ao .env.example

4. Crie um arquivo TELEGRAM_SETUP.md explicando como:
   - Criar o bot no @BotFather
   - Configurar o webhook após o deploy

O bot deve ser capaz de identificar quem está enviando (Jonatas ou Thuany) 
pelo Telegram user_id, que deve ser configurado nas Settings do app.
```

---

## Dicas Gerais para usar Claude Code no VS Code

- **Seja específico**: quanto mais detalhado o prompt, melhor o resultado
- **Um passo de cada vez**: não tente fazer tudo em um prompt gigante
- **Confirme antes de continuar**: peça para ele confirmar que compilou sem erros
- **Use @arquivo**: mencione `@src/types/index.ts` para ele focar nos tipos certos
- **Peça revisão**: após cada prompt, peça "revise se há algum erro TypeScript"
- **Salve frequentemente**: faça commits no GitHub após cada etapa que funcionar
