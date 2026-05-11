ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'outro';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'transactions_payment_method_check'
  ) THEN
    ALTER TABLE public.transactions
      ADD CONSTRAINT transactions_payment_method_check
      CHECK (payment_method IN ('credito', 'debito', 'boleto', 'pix', 'dinheiro', 'transferencia', 'outro'));
  END IF;
END $$;

UPDATE public.transactions
SET payment_method = CASE
  WHEN bank_id IN (SELECT id FROM public.banks WHERE type = 'credito') THEN 'credito'
  WHEN bank_id IN (SELECT id FROM public.banks WHERE type = 'debito') THEN 'debito'
  WHEN bank_id IN (SELECT id FROM public.banks WHERE type = 'dinheiro') THEN 'dinheiro'
  WHEN lower(description) LIKE '%boleto%' OR lower(notes) LIKE '%boleto%' THEN 'boleto'
  WHEN lower(description) LIKE '%pix%' OR lower(notes) LIKE '%pix%' THEN 'pix'
  ELSE payment_method
END
WHERE payment_method = 'outro';

CREATE INDEX IF NOT EXISTS idx_transactions_payment_method
  ON public.transactions(household_id, payment_method, status, date);
