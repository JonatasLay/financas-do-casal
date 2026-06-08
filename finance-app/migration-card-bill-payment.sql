-- ============================================================
-- MIGRATION: pagamento de fatura do cartao de credito
-- Execute este arquivo no SQL Editor do Supabase.
-- ============================================================

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS is_card_payment BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS target_bank_id  UUID REFERENCES public.banks(id);

COMMENT ON COLUMN public.transactions.is_card_payment IS
  'TRUE quando o lancamento representa o pagamento de uma fatura de cartao a partir de uma conta corrente. Exclui do calculo de despesas para evitar duplicacao com o cardInvoice das transacoes individuais.';

COMMENT ON COLUMN public.transactions.target_bank_id IS
  'Para is_card_payment=TRUE: referencia ao cartao de credito que foi pago. bank_id continua sendo a conta corrente de onde o dinheiro saiu.';
