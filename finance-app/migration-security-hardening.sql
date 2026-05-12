-- ============================================================
-- MIGRATION: security hardening
-- Execute este arquivo no SQL Editor do Supabase.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- Savings / investments tables used by the app
-- ============================================================
CREATE TABLE IF NOT EXISTS public.savings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  household_id UUID REFERENCES public.households(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  institution TEXT,
  type TEXT NOT NULL DEFAULT 'outro',
  current_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  target_amount DECIMAL(12,2),
  interest_rate DECIMAL(8,4),
  icon TEXT DEFAULT '💰',
  color TEXT DEFAULT '#22D3EE',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.savings_history (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  savings_id UUID REFERENCES public.savings(id) ON DELETE CASCADE NOT NULL,
  household_id UUID REFERENCES public.households(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.investments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  household_id UUID REFERENCES public.households(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  ticker TEXT,
  type TEXT NOT NULL DEFAULT 'outro',
  quantity DECIMAL(18,8) NOT NULL DEFAULT 0,
  avg_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  current_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_invested DECIMAL(12,2) NOT NULL DEFAULT 0,
  icon TEXT DEFAULT '📈',
  color TEXT DEFAULT '#FBBF24',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.investment_transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  investment_id UUID REFERENCES public.investments(id) ON DELETE CASCADE NOT NULL,
  household_id UUID REFERENCES public.households(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  quantity DECIMAL(18,8),
  price DECIMAL(12,2),
  amount DECIMAL(12,2) NOT NULL,
  date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.savings
  ADD COLUMN IF NOT EXISTS household_id UUID REFERENCES public.households(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS institution TEXT,
  ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'outro',
  ADD COLUMN IF NOT EXISTS current_amount DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS target_amount DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS interest_rate DECIMAL(8,4),
  ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT '💰',
  ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#22D3EE',
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.savings_history
  ADD COLUMN IF NOT EXISTS household_id UUID REFERENCES public.households(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS savings_id UUID REFERENCES public.savings(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS amount DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS date DATE DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.investments
  ADD COLUMN IF NOT EXISTS household_id UUID REFERENCES public.households(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS ticker TEXT,
  ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'outro',
  ADD COLUMN IF NOT EXISTS quantity DECIMAL(18,8) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_price DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_price DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_invested DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT '📈',
  ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#FBBF24',
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.investment_transactions
  ADD COLUMN IF NOT EXISTS household_id UUID REFERENCES public.households(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS investment_id UUID REFERENCES public.investments(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS type TEXT,
  ADD COLUMN IF NOT EXISTS quantity DECIMAL(18,8),
  ADD COLUMN IF NOT EXISTS price DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS amount DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS date DATE DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.savings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.savings_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investment_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "household_access" ON public.savings;
CREATE POLICY "household_access" ON public.savings
  FOR ALL USING (household_id = auth_household_id())
  WITH CHECK (household_id = auth_household_id());

DROP POLICY IF EXISTS "household_access" ON public.savings_history;
CREATE POLICY "household_access" ON public.savings_history
  FOR ALL USING (household_id = auth_household_id())
  WITH CHECK (household_id = auth_household_id());

DROP POLICY IF EXISTS "household_access" ON public.investments;
CREATE POLICY "household_access" ON public.investments
  FOR ALL USING (household_id = auth_household_id())
  WITH CHECK (household_id = auth_household_id());

DROP POLICY IF EXISTS "household_access" ON public.investment_transactions;
CREATE POLICY "household_access" ON public.investment_transactions
  FOR ALL USING (household_id = auth_household_id())
  WITH CHECK (household_id = auth_household_id());

-- ============================================================
-- Harden SECURITY DEFINER functions against search_path hijacking
-- ============================================================
CREATE OR REPLACE FUNCTION public.auth_household_id()
RETURNS UUID AS $$
  SELECT household_id FROM public.profiles WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.auth_is_household_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND household_id IS NOT NULL
      AND role = 'admin'
  )
$$ LANGUAGE SQL SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  invite public.household_invites%ROWTYPE;
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

CREATE OR REPLACE FUNCTION public.protect_profile_admin_fields()
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
    IF NOT public.auth_is_household_admin() THEN
      RAISE EXCEPTION 'Apenas administradores podem alterar permissões de usuários.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.admin_attach_existing_user(target_email TEXT, target_role TEXT DEFAULT 'member')
RETURNS BOOLEAN AS $$
DECLARE
  hid UUID;
  pending_invite_id UUID;
BEGIN
  IF NOT public.auth_is_household_admin() THEN
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

-- ============================================================
-- Data integrity checks for new writes
-- Existing old rows are not validated, but new bad writes are blocked.
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transactions_amount_positive') THEN
    ALTER TABLE public.transactions ADD CONSTRAINT transactions_amount_positive CHECK (amount > 0) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'goals_amounts_non_negative') THEN
    ALTER TABLE public.goals ADD CONSTRAINT goals_amounts_non_negative CHECK (target_amount > 0 AND current_amount >= 0 AND monthly_contribution >= 0) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'goal_contributions_amount_positive') THEN
    ALTER TABLE public.goal_contributions ADD CONSTRAINT goal_contributions_amount_positive CHECK (amount > 0) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'budgets_amount_non_negative') THEN
    ALTER TABLE public.budgets ADD CONSTRAINT budgets_amount_non_negative CHECK (amount >= 0) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'savings_amounts_non_negative') THEN
    ALTER TABLE public.savings ADD CONSTRAINT savings_amounts_non_negative CHECK (current_amount >= 0 AND (target_amount IS NULL OR target_amount >= 0) AND (interest_rate IS NULL OR interest_rate >= 0)) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'investments_amounts_non_negative') THEN
    ALTER TABLE public.investments ADD CONSTRAINT investments_amounts_non_negative CHECK (quantity >= 0 AND avg_price >= 0 AND current_price >= 0 AND total_invested >= 0) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'investment_transactions_amount_positive') THEN
    ALTER TABLE public.investment_transactions ADD CONSTRAINT investment_transactions_amount_positive CHECK (amount > 0 AND (quantity IS NULL OR quantity >= 0) AND (price IS NULL OR price >= 0)) NOT VALID;
  END IF;
END $$;

-- ============================================================
-- Storage policies for avatars
-- New uploads use: {auth.uid()}/avatar.{ext}
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', TRUE, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE
SET public = TRUE,
    file_size_limit = 2097152,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
CREATE POLICY "avatars_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_user_insert" ON storage.objects;
CREATE POLICY "avatars_user_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::TEXT);

DROP POLICY IF EXISTS "avatars_user_update" ON storage.objects;
CREATE POLICY "avatars_user_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::TEXT)
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::TEXT);

DROP POLICY IF EXISTS "avatars_user_delete" ON storage.objects;
CREATE POLICY "avatars_user_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::TEXT);

-- ============================================================
-- Performance indexes for RLS-filtered tables
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_savings_household ON public.savings(household_id);
CREATE INDEX IF NOT EXISTS idx_savings_history_household ON public.savings_history(household_id, savings_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_investments_household ON public.investments(household_id);
CREATE INDEX IF NOT EXISTS idx_investment_transactions_household ON public.investment_transactions(household_id, investment_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_household_date ON public.transactions(household_id, date DESC);

REVOKE EXECUTE ON FUNCTION public.admin_attach_existing_user(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_attach_existing_user(TEXT, TEXT) TO authenticated;
