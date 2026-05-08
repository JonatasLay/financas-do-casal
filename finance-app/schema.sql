-- ============================================================
-- FINANÇAS DO CASAL — Schema Supabase
-- Execute este arquivo no SQL Editor do Supabase
-- ============================================================

-- Habilitar extensões
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- HOUSEHOLDS (o "casal" como unidade)
-- ============================================================
CREATE TABLE households (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'Nosso Lar',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PROFILES (estende auth.users)
-- ============================================================
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  household_id UUID REFERENCES households(id),
  name TEXT NOT NULL,
  avatar_color TEXT DEFAULT '#6366F1',
  avatar_emoji TEXT DEFAULT '👤',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CATEGORIES
-- ============================================================
CREATE TABLE categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('receita', 'despesa', 'ambos')),
  icon TEXT DEFAULT '📦',
  color TEXT DEFAULT '#6366F1',
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- BANKS / CARTÕES
-- ============================================================
CREATE TABLE banks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('conta', 'credito', 'debito', 'dinheiro', 'investimento')),
  color TEXT DEFAULT '#6366F1',
  icon TEXT DEFAULT '🏦',
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TRANSACTIONS
-- ============================================================
CREATE TABLE transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  household_id UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  created_by UUID REFERENCES profiles(id),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('receita', 'despesa', 'fatura', 'transferencia')),
  category_id UUID REFERENCES categories(id),
  bank_id UUID REFERENCES banks(id),
  status TEXT NOT NULL DEFAULT 'realizado' CHECK (status IN ('realizado', 'pendente', 'agendado')),
  notes TEXT,
  is_recurring BOOLEAN DEFAULT FALSE,
  recurring_months INTEGER,
  month TEXT GENERATED ALWAYS AS (TO_CHAR(date, 'MON')) STORED,
  year INTEGER GENERATED ALWAYS AS (EXTRACT(YEAR FROM date)::INTEGER) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- GOALS (Metas)
-- ============================================================
CREATE TABLE goals (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  household_id UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  target_amount DECIMAL(12,2) NOT NULL,
  current_amount DECIMAL(12,2) DEFAULT 0,
  icon TEXT DEFAULT '🎯',
  color TEXT DEFAULT '#6366F1',
  deadline DATE,
  monthly_contribution DECIMAL(12,2) DEFAULT 0,
  is_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- GOAL CONTRIBUTIONS
-- ============================================================
CREATE TABLE goal_contributions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  goal_id UUID REFERENCES goals(id) ON DELETE CASCADE NOT NULL,
  household_id UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  created_by UUID REFERENCES profiles(id),
  amount DECIMAL(12,2) NOT NULL,
  date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- BUDGETS (Orçamentos mensais por categoria)
-- ============================================================
CREATE TABLE budgets (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  household_id UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES categories(id) ON DELETE CASCADE NOT NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INTEGER NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(household_id, category_id, month, year)
);

-- ============================================================
-- AI CONVERSATIONS (histórico de chat)
-- ============================================================
CREATE TABLE ai_conversations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  household_id UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  created_by UUID REFERENCES profiles(id),
  messages JSONB NOT NULL DEFAULT '[]',
  context_snapshot JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE banks ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;

-- Helper function: retorna o household_id do usuário logado
CREATE OR REPLACE FUNCTION auth_household_id()
RETURNS UUID AS $$
  SELECT household_id FROM profiles WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER;

-- POLICIES: cada tabela só acessível pelo próprio household
CREATE POLICY "household_access" ON households
  FOR ALL USING (id = auth_household_id());

CREATE POLICY "household_access" ON profiles
  FOR ALL USING (household_id = auth_household_id());

CREATE POLICY "household_access" ON categories
  FOR ALL USING (household_id = auth_household_id());

CREATE POLICY "household_access" ON banks
  FOR ALL USING (household_id = auth_household_id());

CREATE POLICY "household_access" ON transactions
  FOR ALL USING (household_id = auth_household_id());

CREATE POLICY "household_access" ON goals
  FOR ALL USING (household_id = auth_household_id());

CREATE POLICY "household_access" ON goal_contributions
  FOR ALL USING (household_id = auth_household_id());

CREATE POLICY "household_access" ON budgets
  FOR ALL USING (household_id = auth_household_id());

CREATE POLICY "household_access" ON ai_conversations
  FOR ALL USING (household_id = auth_household_id());

-- ============================================================
-- TRIGGER: criar profile automaticamente no cadastro
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, name, avatar_color)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    CASE WHEN (SELECT COUNT(*) FROM profiles) % 2 = 0 THEN '#6366F1' ELSE '#EC4899' END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- TRIGGER: updated_at automático
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_goals_updated_at BEFORE UPDATE ON goals FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- ÍNDICES para performance
-- ============================================================
CREATE INDEX idx_transactions_household ON transactions(household_id);
CREATE INDEX idx_transactions_date ON transactions(date DESC);
CREATE INDEX idx_transactions_year_month ON transactions(year, month);
CREATE INDEX idx_transactions_category ON transactions(category_id);
CREATE INDEX idx_goals_household ON goals(household_id);
