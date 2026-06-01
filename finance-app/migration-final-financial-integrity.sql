-- ============================================================
-- MIGRATION: integridade final de caixa e controle da Neusa
-- Execute este arquivo no SQL Editor do Supabase.
-- ============================================================

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS affects_household_cash BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.transactions.affects_household_cash IS
  'Define se o lancamento movimenta o caixa real do casal. Use FALSE para despesas da Neusa registradas apenas para controle.';

-- Reverte do saldo atual o que eventualmente foi aplicado por despesas
-- diretas da Neusa mantidas apenas para acompanhamento.
WITH neusa_cash_deltas AS (
  SELECT
    b.id AS bank_id,
    SUM(
      CASE
        WHEN t.type = 'receita' THEN t.amount
        WHEN t.type IN ('despesa', 'fatura') THEN -t.amount
        ELSE 0
      END
    ) AS delta
  FROM public.banks b
  JOIN public.transactions t ON t.bank_id = b.id
  WHERE b.type <> 'credito'
    AND t.responsible_party = 'sogra'
    AND t.affects_household_cash = TRUE
    AND t.status = 'realizado'
    AND t.date <= (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::DATE
    AND t.date >= COALESCE(b.balance_tracking_started_at::DATE, (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::DATE)
  GROUP BY b.id
)
UPDATE public.banks b
SET current_balance = COALESCE(b.current_balance, 0) - neusa_cash_deltas.delta
FROM neusa_cash_deltas
WHERE b.id = neusa_cash_deltas.bank_id;

-- Despesas diretas da Neusa cadastradas para acompanhamento nao devem
-- movimentar as contas do casal. Compras dela nos cartoes continuam
-- registradas normalmente para compor fatura e reembolso.
UPDATE public.transactions t
SET affects_household_cash = FALSE
FROM public.banks b
WHERE t.bank_id = b.id
  AND t.responsible_party = 'sogra'
  AND b.type <> 'credito';

CREATE OR REPLACE FUNCTION public.transaction_cash_delta(
  p_type TEXT,
  p_status TEXT,
  p_amount NUMERIC,
  p_bank_type TEXT,
  p_transaction_date DATE,
  p_tracking_started_at TIMESTAMPTZ,
  p_affects_household_cash BOOLEAN DEFAULT TRUE
) RETURNS NUMERIC AS $$
BEGIN
  IF p_status <> 'realizado'
    OR p_bank_type = 'credito'
    OR NOT COALESCE(p_affects_household_cash, TRUE)
    OR p_transaction_date > (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::DATE
    OR p_transaction_date < COALESCE(p_tracking_started_at::DATE, (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::DATE)
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
$$ LANGUAGE plpgsql SET search_path = public;

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
      OLD.date,
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
      NEW.date,
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
