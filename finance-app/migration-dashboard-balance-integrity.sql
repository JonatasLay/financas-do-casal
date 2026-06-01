-- ============================================================
-- MIGRATION: integridade do saldo atual e previsao do dashboard
-- Execute este arquivo no SQL Editor do Supabase.
-- ============================================================

-- Corrige o ciclo do cartao Magazine Luiza ativo da familia principal.
UPDATE public.banks
SET due_day = 10,
    closing_day = 3,
    opening_day = 4
WHERE id = '2c739922-4bb1-4ad8-8986-a05812396433'
  AND type = 'credito'
  AND lower(btrim(name)) = 'magazine luiza';

-- Impede bancos ou cartoes duplicados dentro da mesma familia.
CREATE UNIQUE INDEX IF NOT EXISTS idx_banks_household_type_name_unique
  ON public.banks(household_id, type, lower(btrim(name)));

-- Remove do saldo atual valores futuros que o trigger antigo aplicou
-- indevidamente. A correcao respeita a data inicial de acompanhamento
-- configurada em cada conta.
WITH future_deltas AS (
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
    AND t.status = 'realizado'
    AND t.date > (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::DATE
    AND t.date >= COALESCE(b.balance_tracking_started_at::DATE, (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::DATE)
  GROUP BY b.id
)
UPDATE public.banks b
SET current_balance = COALESCE(b.current_balance, 0) - future_deltas.delta
FROM future_deltas
WHERE b.id = future_deltas.bank_id;

-- O saldo atual representa somente dinheiro que ja entrou ou saiu.
-- Lancamentos futuros continuam na previsao, mas nao alteram a conta hoje.
CREATE OR REPLACE FUNCTION public.transaction_cash_delta(
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

-- Recorrencias futuras de contas bancarias representam compromissos
-- previstos. Elas devem virar realizadas somente quando forem pagas.
-- Parcelas futuras de cartao nao sao alteradas.
UPDATE public.transactions t
SET status = 'agendado'
FROM public.banks b
WHERE t.bank_id = b.id
  AND b.type <> 'credito'
  AND t.is_recurring = TRUE
  AND t.status = 'realizado'
  AND t.date > (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::DATE;
