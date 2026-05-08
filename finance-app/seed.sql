-- ============================================================
-- SEED: Categorias e Bancos padrão
-- Execute APÓS o schema.sql e APÓS criar seu primeiro usuário
-- Substitua 'SEU_HOUSEHOLD_ID' pelo ID real do seu household
-- ============================================================

-- Para pegar seu household_id, rode: SELECT * FROM households;
-- Depois substitua abaixo e execute

DO $$
DECLARE
  hid UUID;
BEGIN
  -- Pega o primeiro household (o seu)
  SELECT id INTO hid FROM households LIMIT 1;

  -- CATEGORIAS DE DESPESA
  INSERT INTO categories (household_id, name, type, icon, color, is_default) VALUES
    (hid, 'Alimentação', 'despesa', '🛒', '#10B981', true),
    (hid, 'Supermercado', 'despesa', '🛍️', '#059669', true),
    (hid, 'Restaurante / Delivery', 'despesa', '🍔', '#34D399', true),
    (hid, 'Lanches & Snacks', 'despesa', '☕', '#6EE7B7', true),
    (hid, 'Saúde', 'despesa', '❤️', '#EF4444', true),
    (hid, 'Médico / Consulta', 'despesa', '👨‍⚕️', '#DC2626', true),
    (hid, 'Farmácia', 'despesa', '💊', '#F87171', true),
    (hid, 'Terapia', 'despesa', '🧠', '#FCA5A5', true),
    (hid, 'Plano de Saúde', 'despesa', '🏥', '#FECACA', true),
    (hid, 'Transporte', 'despesa', '🚗', '#3B82F6', true),
    (hid, 'Combustível', 'despesa', '⛽', '#2563EB', true),
    (hid, 'Seguro Carro', 'despesa', '🛡️', '#60A5FA', true),
    (hid, 'IPVA', 'despesa', '📋', '#93C5FD', true),
    (hid, 'Uber / Táxi', 'despesa', '🚕', '#BFDBFE', true),
    (hid, 'Educação', 'despesa', '📚', '#8B5CF6', true),
    (hid, 'Pós-Graduação', 'despesa', '🎓', '#7C3AED', true),
    (hid, 'Cursos', 'despesa', '💻', '#A78BFA', true),
    (hid, 'Moradia', 'despesa', '🏠', '#F59E0B', true),
    (hid, 'Água', 'despesa', '💧', '#D97706', true),
    (hid, 'Energia Elétrica', 'despesa', '⚡', '#FCD34D', true),
    (hid, 'Internet', 'despesa', '📡', '#FDE68A', true),
    (hid, 'Aluguel', 'despesa', '🔑', '#FBBF24', true),
    (hid, 'Comunicação', 'despesa', '📱', '#6366F1', true),
    (hid, 'Telefone', 'despesa', '📞', '#4F46E5', true),
    (hid, 'TV a Cabo / Streaming', 'despesa', '📺', '#818CF8', true),
    (hid, 'Lazer', 'despesa', '🎉', '#EC4899', true),
    (hid, 'Viagens', 'despesa', '✈️', '#DB2777', true),
    (hid, 'Cinema / Shows', 'despesa', '🎬', '#F472B6', true),
    (hid, 'Recreação', 'despesa', '🎮', '#FBCFE8', true),
    (hid, 'Pessoais', 'despesa', '👤', '#14B8A6', true),
    (hid, 'Barbeiro / Salão', 'despesa', '💇', '#0D9488', true),
    (hid, 'Roupas / Calçados', 'despesa', '👕', '#2DD4BF', true),
    (hid, 'Academia', 'despesa', '💪', '#5EEAD4', true),
    (hid, 'Animais de estimação', 'despesa', '🐾', '#99F6E4', true),
    (hid, 'Presentes', 'despesa', '🎁', '#F0ABFC', true),
    (hid, 'Investimentos', 'despesa', '📈', '#10B981', true),
    (hid, 'Poupança', 'despesa', '🏦', '#059669', true),
    (hid, 'Mesada / Dependentes', 'despesa', '👨‍👩‍👧', '#F97316', true),
    (hid, 'Assinaturas', 'despesa', '🔄', '#64748B', true),
    (hid, 'Outros', 'despesa', '📦', '#94A3B8', true);

  -- CATEGORIAS DE RECEITA  
  INSERT INTO categories (household_id, name, type, icon, color, is_default) VALUES
    (hid, 'Renda Principal', 'receita', '💼', '#10B981', true),
    (hid, 'Salário Jonatas', 'receita', '👨‍💼', '#059669', true),
    (hid, 'Salário Thuany', 'receita', '👩‍💼', '#34D399', true),
    (hid, 'Freelance / Extra', 'receita', '💡', '#6EE7B7', true),
    (hid, 'Rendimento Investimentos', 'receita', '📊', '#A7F3D0', true),
    (hid, 'Outros Recebimentos', 'receita', '💰', '#D1FAE5', true);

  -- BANCOS E CARTÕES
  INSERT INTO banks (household_id, name, type, color, icon, is_default) VALUES
    (hid, 'Banco Inter', 'conta', '#FF6B35', '🏦', true),
    (hid, 'Banco do Brasil', 'conta', '#FFD700', '🏦', true),
    (hid, 'Nubank', 'credito', '#8B5CF6', '💜', true),
    (hid, 'Itaú', 'conta', '#EC7000', '🏦', true),
    (hid, 'Magazine Luiza', 'credito', '#0072FF', '💳', true),
    (hid, 'Cartão de Crédito', 'credito', '#6366F1', '💳', true),
    (hid, 'Dinheiro / Espécie', 'dinheiro', '#10B981', '💵', true),
    (hid, 'Pix', 'conta', '#32BCAD', '⚡', true);

  RAISE NOTICE 'Seed executado com sucesso para household: %', hid;
END $$;
