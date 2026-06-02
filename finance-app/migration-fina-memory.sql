-- ============================================================
-- MIGRATION: memoria financeira persistente da Fina
-- Execute este arquivo no SQL Editor do Supabase.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.fina_financial_profiles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  household_id UUID REFERENCES public.households(id) ON DELETE CASCADE NOT NULL UNIQUE,
  profile_summary TEXT NOT NULL DEFAULT '',
  updated_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.fina_financial_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "household_access" ON public.fina_financial_profiles;
CREATE POLICY "household_access" ON public.fina_financial_profiles
  FOR ALL USING (household_id = public.auth_household_id())
  WITH CHECK (household_id = public.auth_household_id());

DROP TRIGGER IF EXISTS update_fina_financial_profiles_updated_at ON public.fina_financial_profiles;
CREATE TRIGGER update_fina_financial_profiles_updated_at
BEFORE UPDATE ON public.fina_financial_profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.ai_conversations
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DROP TRIGGER IF EXISTS update_ai_conversations_updated_at ON public.ai_conversations;
CREATE TRIGGER update_ai_conversations_updated_at
BEFORE UPDATE ON public.ai_conversations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX IF NOT EXISTS idx_ai_conversations_created_by_updated
  ON public.ai_conversations(created_by, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_fina_financial_profiles_household
  ON public.fina_financial_profiles(household_id);
