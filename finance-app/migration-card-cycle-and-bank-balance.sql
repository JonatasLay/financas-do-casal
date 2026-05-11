ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS responsible_party TEXT NOT NULL DEFAULT 'casal',
  ADD COLUMN IF NOT EXISTS is_reimbursed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'outro';

ALTER TABLE banks
  ADD COLUMN IF NOT EXISTS limit_amount DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS due_day INTEGER,
  ADD COLUMN IF NOT EXISTS closing_day INTEGER CHECK (closing_day BETWEEN 1 AND 31),
  ADD COLUMN IF NOT EXISTS opening_day INTEGER CHECK (opening_day BETWEEN 1 AND 31),
  ADD COLUMN IF NOT EXISTS current_balance DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance_tracking_started_at TIMESTAMPTZ DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transactions_responsible_party_check'
  ) THEN
    ALTER TABLE transactions
      ADD CONSTRAINT transactions_responsible_party_check
      CHECK (responsible_party IN ('casal', 'sogra'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transactions_payment_method_check'
  ) THEN
    ALTER TABLE transactions
      ADD CONSTRAINT transactions_payment_method_check
      CHECK (payment_method IN ('credito', 'debito', 'boleto', 'pix', 'dinheiro', 'transferencia', 'outro'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'banks_due_day_check'
  ) THEN
    ALTER TABLE banks
      ADD CONSTRAINT banks_due_day_check
      CHECK (due_day BETWEEN 1 AND 31);
  END IF;
END $$;

COMMENT ON COLUMN banks.closing_day IS 'Dia em que a fatura do cartao fecha. Compras ate este dia entram na fatura do mes; depois disso, na proxima.';
COMMENT ON COLUMN banks.opening_day IS 'Dia em que o novo ciclo do cartao inicia. Campo informativo para tela e conferencia.';
COMMENT ON COLUMN banks.current_balance IS 'Saldo atual conciliado de contas de caixa. Cartoes de credito nao usam este campo como caixa.';
COMMENT ON COLUMN banks.balance_tracking_started_at IS 'Marco inicial da conciliacao automatica. Lancamentos anteriores a esta data nao ajustam current_balance.';

UPDATE banks
SET
  due_day = COALESCE(due_day, 10),
  closing_day = COALESCE(closing_day, 3),
  opening_day = COALESCE(opening_day, 4)
WHERE type = 'credito'
  AND LOWER(name) LIKE '%mag%luiza%';

UPDATE transactions
SET payment_method = CASE
  WHEN bank_id IN (SELECT id FROM banks WHERE type = 'credito') THEN 'credito'
  WHEN bank_id IN (SELECT id FROM banks WHERE type = 'debito') THEN 'debito'
  WHEN bank_id IN (SELECT id FROM banks WHERE type = 'dinheiro') THEN 'dinheiro'
  WHEN lower(description) LIKE '%boleto%' OR lower(notes) LIKE '%boleto%' THEN 'boleto'
  WHEN lower(description) LIKE '%pix%' OR lower(notes) LIKE '%pix%' THEN 'pix'
  ELSE payment_method
END
WHERE payment_method = 'outro';

CREATE INDEX IF NOT EXISTS idx_transactions_responsible_party
  ON transactions(household_id, responsible_party, is_reimbursed);

CREATE INDEX IF NOT EXISTS idx_transactions_payment_method
  ON transactions(household_id, payment_method, status, date);

CREATE OR REPLACE FUNCTION public.transaction_cash_delta(
  p_type TEXT,
  p_status TEXT,
  p_amount NUMERIC,
  p_bank_type TEXT,
  p_transaction_date DATE,
  p_tracking_started_at TIMESTAMPTZ
) RETURNS NUMERIC
LANGUAGE plpgsql
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.apply_transaction_cash_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  old_bank RECORD;
  new_bank RECORD;
  old_delta NUMERIC := 0;
  new_delta NUMERIC := 0;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.bank_id IS NOT NULL THEN
    SELECT type, balance_tracking_started_at INTO old_bank FROM banks WHERE id = OLD.bank_id;
    old_delta := public.transaction_cash_delta(
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
    new_delta := public.transaction_cash_delta(
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
$$;

DROP TRIGGER IF EXISTS transactions_cash_balance_trigger ON transactions;
CREATE TRIGGER transactions_cash_balance_trigger
AFTER INSERT OR UPDATE OR DELETE ON transactions
FOR EACH ROW
EXECUTE FUNCTION public.apply_transaction_cash_balance();
