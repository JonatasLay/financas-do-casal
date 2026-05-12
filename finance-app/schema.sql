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
  email TEXT,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  avatar_color TEXT DEFAULT '#6366F1',
  avatar_emoji TEXT DEFAULT '👤',
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- HOUSEHOLD INVITES (cadastro apenas por convite)
-- ============================================================
CREATE TABLE household_invites (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  household_id UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked')),
  invited_by UUID REFERENCES profiles(id),
  accepted_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  UNIQUE(household_id, email)
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
  limit_amount DECIMAL(12,2),
  due_day INTEGER CHECK (due_day BETWEEN 1 AND 31),
  closing_day INTEGER CHECK (closing_day BETWEEN 1 AND 31),
  opening_day INTEGER CHECK (opening_day BETWEEN 1 AND 31),
  current_balance DECIMAL(12,2) DEFAULT 0,
  balance_tracking_started_at TIMESTAMPTZ DEFAULT NOW(),
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
  recurring_group_id UUID,
  recurring_index INTEGER,
  recurring_total INTEGER,
  responsible_party TEXT NOT NULL DEFAULT 'casal' CHECK (responsible_party IN ('casal', 'sogra')),
  is_reimbursed BOOLEAN NOT NULL DEFAULT FALSE,
  payment_method TEXT NOT NULL DEFAULT 'outro' CHECK (payment_method IN ('credito', 'debito', 'boleto', 'pix', 'dinheiro', 'transferencia', 'outro')),
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
-- SAVINGS / POUPANCA
-- ============================================================
CREATE TABLE savings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  household_id UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  institution TEXT,
  type TEXT NOT NULL DEFAULT 'outro' CHECK (type IN ('poupança', 'cdb', 'lci', 'lca', 'tesouro', 'fundo', 'outro')),
  current_amount DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (current_amount >= 0),
  target_amount DECIMAL(12,2) CHECK (target_amount IS NULL OR target_amount >= 0),
  interest_rate DECIMAL(8,4) CHECK (interest_rate IS NULL OR interest_rate >= 0),
  icon TEXT DEFAULT '💰',
  color TEXT DEFAULT '#22D3EE',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE savings_history (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  savings_id UUID REFERENCES savings(id) ON DELETE CASCADE NOT NULL,
  household_id UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(12,2) NOT NULL CHECK (amount <> 0),
  date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INVESTMENTS
-- ============================================================
CREATE TABLE investments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  household_id UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  ticker TEXT,
  type TEXT NOT NULL DEFAULT 'outro' CHECK (type IN ('acao', 'fii', 'etf', 'cripto', 'renda_fixa', 'fundo', 'outro')),
  quantity DECIMAL(18,8) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  avg_price DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (avg_price >= 0),
  current_price DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (current_price >= 0),
  total_invested DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (total_invested >= 0),
  icon TEXT DEFAULT '📈',
  color TEXT DEFAULT '#FBBF24',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE investment_transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  investment_id UUID REFERENCES investments(id) ON DELETE CASCADE NOT NULL,
  household_id UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('compra', 'venda', 'dividendo')),
  quantity DECIMAL(18,8) CHECK (quantity IS NULL OR quantity >= 0),
  price DECIMAL(12,2) CHECK (price IS NULL OR price >= 0),
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
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
ALTER TABLE household_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE banks ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE investment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;

-- Helper function: retorna o household_id do usuário logado
CREATE OR REPLACE FUNCTION auth_household_id()
RETURNS UUID AS $$
  SELECT household_id FROM public.profiles WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION auth_is_household_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND household_id IS NOT NULL
      AND role = 'admin'
  )
$$ LANGUAGE SQL SECURITY DEFINER SET search_path = public;

-- POLICIES: cada tabela só acessível pelo próprio household
CREATE POLICY "household_access" ON households
  FOR ALL USING (id = auth_household_id());

CREATE POLICY "profiles_select_household" ON profiles
  FOR SELECT USING (household_id = auth_household_id());

CREATE POLICY "profiles_self_update" ON profiles
  FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_admin_update" ON profiles
  FOR UPDATE USING (household_id = auth_household_id() AND auth_is_household_admin())
  WITH CHECK (household_id = auth_household_id());

CREATE POLICY "invites_admin_access" ON household_invites
  FOR ALL USING (household_id = auth_household_id() AND auth_is_household_admin())
  WITH CHECK (household_id = auth_household_id() AND auth_is_household_admin());

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

CREATE POLICY "household_access" ON savings
  FOR ALL USING (household_id = auth_household_id())
  WITH CHECK (household_id = auth_household_id());

CREATE POLICY "household_access" ON savings_history
  FOR ALL USING (household_id = auth_household_id())
  WITH CHECK (household_id = auth_household_id());

CREATE POLICY "household_access" ON investments
  FOR ALL USING (household_id = auth_household_id())
  WITH CHECK (household_id = auth_household_id());

CREATE POLICY "household_access" ON investment_transactions
  FOR ALL USING (household_id = auth_household_id())
  WITH CHECK (household_id = auth_household_id());

CREATE POLICY "household_access" ON ai_conversations
  FOR ALL USING (household_id = auth_household_id());

-- ============================================================
-- TRIGGER: criar profile automaticamente no cadastro
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  invite household_invites%ROWTYPE;
  new_household_id UUID;
  new_role TEXT := 'member';
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('financas_do_casal_handle_new_user'));

  SELECT * INTO invite
  FROM public.household_invites
  WHERE lower(email) = lower(NEW.email)
    AND status = 'pending'
  ORDER BY created_at ASC
  LIMIT 1;

  IF invite.id IS NULL THEN
    IF (SELECT COUNT(*) FROM public.profiles) = 0 THEN
      INSERT INTO public.households (name) VALUES ('Nossa Família') RETURNING id INTO new_household_id;
      new_role := 'admin';
    ELSE
      RAISE EXCEPTION 'Cadastro permitido apenas por convite.';
    END IF;
  ELSE
    new_household_id := invite.household_id;
    new_role := invite.role;
  END IF;

  INSERT INTO public.profiles (id, household_id, email, name, role, avatar_color)
  VALUES (
    NEW.id,
    new_household_id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    new_role,
    CASE WHEN (SELECT COUNT(*) FROM public.profiles) % 2 = 0 THEN '#6366F1' ELSE '#EC4899' END
  );

  IF invite.id IS NOT NULL THEN
    UPDATE public.household_invites
    SET status = 'accepted', accepted_by = NEW.id, accepted_at = NOW()
    WHERE id = invite.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION protect_profile_admin_fields()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.role = 'admin'
    AND NEW.role IS DISTINCT FROM 'admin'
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE household_id = OLD.household_id
        AND role = 'admin'
        AND id <> OLD.id
    ) THEN
    RAISE EXCEPTION 'Mantenha pelo menos um administrador no household.';
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role
    OR NEW.household_id IS DISTINCT FROM OLD.household_id
    OR NEW.email IS DISTINCT FROM OLD.email THEN
    IF NOT auth_is_household_admin() THEN
      RAISE EXCEPTION 'Apenas administradores podem alterar permissões de usuários.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION admin_attach_existing_user(target_email TEXT, target_role TEXT DEFAULT 'member')
RETURNS BOOLEAN AS $$
DECLARE
  hid UUID;
  pending_invite_id UUID;
BEGIN
  IF NOT auth_is_household_admin() THEN
    RAISE EXCEPTION 'Apenas administradores podem vincular usuários.';
  END IF;

  SELECT household_id INTO hid FROM public.profiles WHERE id = auth.uid();
  IF hid IS NULL THEN
    RAISE EXCEPTION 'Household do admin não encontrado.';
  END IF;

  SELECT id INTO pending_invite_id
  FROM public.household_invites
  WHERE household_id = hid
    AND lower(email) = lower(target_email)
    AND status = 'pending'
  LIMIT 1;

  IF pending_invite_id IS NULL THEN
    RETURN FALSE;
  END IF;

  UPDATE public.profiles
  SET household_id = hid,
      role = CASE WHEN target_role = 'admin' THEN 'admin' ELSE 'member' END
  WHERE lower(email) = lower(target_email)
    AND (household_id IS NULL OR household_id = hid);

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  UPDATE public.household_invites
  SET status = 'accepted',
      accepted_by = (SELECT id FROM public.profiles WHERE lower(email) = lower(target_email) LIMIT 1),
      accepted_at = NOW()
  WHERE id = pending_invite_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

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
CREATE TRIGGER update_savings_updated_at BEFORE UPDATE ON savings FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_investments_updated_at BEFORE UPDATE ON investments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER protect_profile_admin_fields BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION protect_profile_admin_fields();

-- ============================================================
-- ÍNDICES para performance
-- ============================================================
CREATE INDEX idx_transactions_household ON transactions(household_id);
CREATE INDEX idx_transactions_date ON transactions(date DESC);
CREATE INDEX idx_transactions_year_month ON transactions(year, month);
CREATE INDEX idx_transactions_category ON transactions(category_id);
CREATE INDEX idx_transactions_responsible_party ON transactions(household_id, responsible_party, is_reimbursed);
CREATE INDEX idx_transactions_payment_method ON transactions(household_id, payment_method, status, date);
CREATE INDEX idx_transactions_recurring_group ON transactions(household_id, recurring_group_id, date);
CREATE INDEX idx_savings_household ON savings(household_id);
CREATE INDEX idx_savings_history_household ON savings_history(household_id, savings_id, date DESC);
CREATE INDEX idx_investments_household ON investments(household_id);
CREATE INDEX idx_investment_transactions_household ON investment_transactions(household_id, investment_id, date DESC);

CREATE OR REPLACE FUNCTION transaction_cash_delta(
  p_type TEXT,
  p_status TEXT,
  p_amount NUMERIC,
  p_bank_type TEXT,
  p_transaction_date DATE,
  p_tracking_started_at TIMESTAMPTZ
) RETURNS NUMERIC AS $$
BEGIN
  IF p_status <> 'realizado'
    OR p_bank_type = 'credito'
    OR p_transaction_date < COALESCE(p_tracking_started_at::DATE, CURRENT_DATE)
  THEN
    RETURN 0;
  END IF;

  IF p_type = 'receita' THEN
    RETURN COALESCE(p_amount, 0);
  END IF;

  IF p_type IN ('despesa', 'fatura') THEN
    RETURN -COALESCE(p_amount, 0);
  END IF;

  RETURN 0;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION apply_transaction_cash_balance()
RETURNS TRIGGER AS $$
DECLARE
  old_bank RECORD;
  new_bank RECORD;
  old_delta NUMERIC := 0;
  new_delta NUMERIC := 0;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.bank_id IS NOT NULL THEN
    SELECT type, balance_tracking_started_at INTO old_bank FROM banks WHERE id = OLD.bank_id;
    old_delta := transaction_cash_delta(
      OLD.type,
      OLD.status,
      OLD.amount,
      old_bank.type,
      OLD.date,
      old_bank.balance_tracking_started_at
    );

    IF old_delta <> 0 THEN
      UPDATE banks
      SET current_balance = COALESCE(current_balance, 0) - old_delta
      WHERE id = OLD.bank_id;
    END IF;
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.bank_id IS NOT NULL THEN
    SELECT type, balance_tracking_started_at INTO new_bank FROM banks WHERE id = NEW.bank_id;
    new_delta := transaction_cash_delta(
      NEW.type,
      NEW.status,
      NEW.amount,
      new_bank.type,
      NEW.date,
      new_bank.balance_tracking_started_at
    );

    IF new_delta <> 0 THEN
      UPDATE banks
      SET current_balance = COALESCE(current_balance, 0) + new_delta
      WHERE id = NEW.bank_id;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER transactions_cash_balance_trigger
AFTER INSERT OR UPDATE OR DELETE ON transactions
FOR EACH ROW EXECUTE FUNCTION apply_transaction_cash_balance();
CREATE INDEX idx_goals_household ON goals(household_id);
CREATE INDEX idx_invites_household_status ON household_invites(household_id, status);
