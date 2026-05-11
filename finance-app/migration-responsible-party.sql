-- ============================================================
-- MIGRATION: separar gastos do casal e gastos reembolsaveis da sogra
-- Execute no SQL Editor do Supabase se estas colunas ainda nao existirem.
-- ============================================================

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS responsible_party TEXT NOT NULL DEFAULT 'casal',
  ADD COLUMN IF NOT EXISTS is_reimbursed BOOLEAN NOT NULL DEFAULT FALSE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transactions_responsible_party_check'
  ) THEN
    ALTER TABLE transactions
      ADD CONSTRAINT transactions_responsible_party_check
      CHECK (responsible_party IN ('casal', 'sogra'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_transactions_responsible_party
  ON transactions(household_id, responsible_party, is_reimbursed);
