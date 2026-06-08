-- ============================================================
-- MIGRATION: separacao de custo do casal x Neuza
-- Execute este arquivo no SQL Editor do Supabase.
-- ============================================================

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS neusa_share_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_neusa_reimbursement BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.transactions.neusa_share_amount IS
  'Parte do lancamento do casal que sera reembolsada pela Neuza. O caixa sai inteiro, mas o custo liquido do casal desconta essa parte.';

COMMENT ON COLUMN public.transactions.is_neusa_reimbursement IS
  'Marca receitas que representam reembolso da Neuza, mantendo-as separadas da renda propria do casal.';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transactions_neusa_share_non_negative') THEN
    ALTER TABLE public.transactions
      ADD CONSTRAINT transactions_neusa_share_non_negative
      CHECK (neusa_share_amount >= 0 AND neusa_share_amount <= amount) NOT VALID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_transactions_neusa_reimbursement
  ON public.transactions(household_id, is_neusa_reimbursement, date DESC)
  WHERE is_neusa_reimbursement = TRUE;
