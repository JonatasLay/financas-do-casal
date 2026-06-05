-- ============================================================
-- MIGRATION: data efetiva de pagamento e integridade do saldo
-- Execute este arquivo no SQL Editor do Supabase.
-- ============================================================

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS settled_at DATE;

COMMENT ON COLUMN public.transactions.settled_at IS
  'Data efetiva em que a receita ou despesa movimentou o caixa. A coluna date continua representando compra ou vencimento.';

-- Corrige uma unica vez pagamentos ja marcados como realizados que o
-- trigger anterior ignorou porque o vencimento era futuro ou anterior
-- ao inicio do acompanhamento da conta.
WITH missed_settlements AS (
  SELECT
    b.id AS bank_id,
    SUM(
      CASE
        WHEN t.type = 'receita' THEN t.amount
        WHEN t.type IN ('despesa', 'fatura') THEN -t.amount
        ELSE 0
      END
    ) AS delta
  FROM public.transactions t
  JOIN public.banks b ON b.id = t.bank_id
  WHERE t.settled_at IS NULL
    AND t.status = 'realizado'
    AND b.type <> 'credito'
    AND COALESCE(t.affects_household_cash, TRUE)
    AND t.updated_at::DATE >= COALESCE(b.balance_tracking_started_at::DATE, CURRENT_DATE)
    AND (
      t.date > (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::DATE
      OR t.date < COALESCE(b.balance_tracking_started_at::DATE, (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::DATE)
    )
  GROUP BY b.id
)
UPDATE public.banks b
SET current_balance = COALESCE(b.current_balance, 0) + missed_settlements.delta
FROM missed_settlements
WHERE b.id = missed_settlements.bank_id;

-- Pagamentos ignorados pelo modelo antigo recebem hoje como data efetiva.
UPDATE public.transactions t
SET settled_at = (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::DATE
FROM public.banks b
WHERE t.bank_id = b.id
  AND t.settled_at IS NULL
  AND t.status = 'realizado'
  AND b.type <> 'credito'
  AND COALESCE(t.affects_household_cash, TRUE)
  AND t.updated_at::DATE >= COALESCE(b.balance_tracking_started_at::DATE, CURRENT_DATE)
  AND (
    t.date > (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::DATE
    OR t.date < COALESCE(b.balance_tracking_started_at::DATE, (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::DATE)
  );

-- Demais lancamentos realizados preservam a propria data como liquidacao.
UPDATE public.transactions
SET settled_at = date
WHERE status = 'realizado'
  AND settled_at IS NULL;

CREATE OR REPLACE FUNCTION public.apply_transaction_cash_balance()
RETURNS TRIGGER AS $$
DECLARE
  old_bank RECORD;
  new_bank RECORD;
  old_delta NUMERIC := 0;
  new_delta NUMERIC := 0;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.bank_id IS NOT NULL THEN
    SELECT type, balance_tracking_started_at INTO old_bank FROM public.banks WHERE id = OLD.bank_id;
    old_delta := public.transaction_cash_delta(
      OLD.type,
      OLD.status,
      OLD.amount,
      old_bank.type,
      COALESCE(OLD.settled_at, OLD.date),
      old_bank.balance_tracking_started_at,
      OLD.affects_household_cash
    );

    IF old_delta <> 0 THEN
      UPDATE public.banks
      SET current_balance = COALESCE(current_balance, 0) - old_delta
      WHERE id = OLD.bank_id;
    END IF;
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.bank_id IS NOT NULL THEN
    SELECT type, balance_tracking_started_at INTO new_bank FROM public.banks WHERE id = NEW.bank_id;
    new_delta := public.transaction_cash_delta(
      NEW.type,
      NEW.status,
      NEW.amount,
      new_bank.type,
      COALESCE(NEW.settled_at, NEW.date),
      new_bank.balance_tracking_started_at,
      NEW.affects_household_cash
    );

    IF new_delta <> 0 THEN
      UPDATE public.banks
      SET current_balance = COALESCE(current_balance, 0) + new_delta
      WHERE id = NEW.bank_id;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS transactions_cash_balance_trigger ON public.transactions;
CREATE TRIGGER transactions_cash_balance_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.apply_transaction_cash_balance();

CREATE INDEX IF NOT EXISTS idx_transactions_settled_at
  ON public.transactions(household_id, settled_at DESC)
  WHERE settled_at IS NOT NULL;
