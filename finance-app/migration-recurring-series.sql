ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS recurring_group_id UUID,
  ADD COLUMN IF NOT EXISTS recurring_index INTEGER,
  ADD COLUMN IF NOT EXISTS recurring_total INTEGER;

CREATE INDEX IF NOT EXISTS idx_transactions_recurring_group
  ON transactions(household_id, recurring_group_id, date);

COMMENT ON COLUMN transactions.recurring_group_id IS 'Identificador da serie recorrente para atualizar ou excluir lancamentos futuros em conjunto.';
COMMENT ON COLUMN transactions.recurring_index IS 'Numero do lancamento dentro da serie recorrente.';
COMMENT ON COLUMN transactions.recurring_total IS 'Quantidade total de lancamentos planejados na serie recorrente.';
