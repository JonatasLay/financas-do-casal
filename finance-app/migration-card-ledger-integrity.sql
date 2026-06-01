-- ============================================================
-- MIGRATION: integridade do cadastro de bancos e cartoes
-- Execute este arquivo no SQL Editor do Supabase.
-- ============================================================

-- Corrige o cartao Magazine Luiza ativo da familia principal.
-- Os lancamentos existentes permanecem vinculados ao mesmo cartao.
UPDATE public.banks
SET due_day = 10,
    closing_day = 3,
    opening_day = 4
WHERE id = '2c739922-4bb1-4ad8-8986-a05812396433'
  AND type = 'credito'
  AND lower(btrim(name)) = 'magazine luiza';

-- Impede cadastros duplicados dentro da mesma familia.
-- Bancos com o mesmo nome em familias diferentes continuam permitidos.
CREATE UNIQUE INDEX IF NOT EXISTS idx_banks_household_type_name_unique
  ON public.banks(household_id, type, lower(btrim(name)));

