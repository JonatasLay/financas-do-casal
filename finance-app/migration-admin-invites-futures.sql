-- ============================================================
-- MIGRATION: admins, invites, credit-card fields, protected signup
-- Execute este arquivo no SQL Editor do Supabase para atualizar um projeto existente.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'member',
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_role_check'
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'member'));
  END IF;
END $$;

UPDATE profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND p.email IS NULL;

UPDATE profiles
SET role = 'admin'
WHERE id = (SELECT id FROM profiles ORDER BY created_at ASC LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM profiles WHERE role = 'admin');

ALTER TABLE banks
  ADD COLUMN IF NOT EXISTS limit_amount DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS due_day INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'banks_due_day_check'
  ) THEN
    ALTER TABLE banks ADD CONSTRAINT banks_due_day_check CHECK (due_day BETWEEN 1 AND 31);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS household_invites (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  household_id UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked')),
  invited_by UUID REFERENCES profiles(id),
  accepted_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  UNIQUE(household_id, email)
);

ALTER TABLE household_invites ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION auth_household_id()
RETURNS UUID AS $$
  SELECT household_id FROM profiles WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER;

CREATE OR REPLACE FUNCTION auth_is_household_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND household_id IS NOT NULL
      AND role = 'admin'
  )
$$ LANGUAGE SQL SECURITY DEFINER;

DROP POLICY IF EXISTS "household_access" ON profiles;
DROP POLICY IF EXISTS "profiles_select_household" ON profiles;
DROP POLICY IF EXISTS "profiles_self_update" ON profiles;
DROP POLICY IF EXISTS "profiles_admin_update" ON profiles;

CREATE POLICY "profiles_select_household" ON profiles
  FOR SELECT USING (household_id = auth_household_id());

CREATE POLICY "profiles_self_update" ON profiles
  FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_admin_update" ON profiles
  FOR UPDATE USING (household_id = auth_household_id() AND auth_is_household_admin())
  WITH CHECK (household_id = auth_household_id());

DROP POLICY IF EXISTS "invites_admin_access" ON household_invites;
CREATE POLICY "invites_admin_access" ON household_invites
  FOR ALL USING (household_id = auth_household_id() AND auth_is_household_admin())
  WITH CHECK (household_id = auth_household_id() AND auth_is_household_admin());

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  invite household_invites%ROWTYPE;
  new_household_id UUID;
  new_role TEXT := 'member';
BEGIN
  SELECT * INTO invite
  FROM household_invites
  WHERE lower(email) = lower(NEW.email)
    AND status = 'pending'
  ORDER BY created_at ASC
  LIMIT 1;

  IF invite.id IS NULL THEN
    IF (SELECT COUNT(*) FROM profiles) = 0 THEN
      INSERT INTO households (name) VALUES ('Nossa Família') RETURNING id INTO new_household_id;
      new_role := 'admin';
    ELSE
      RAISE EXCEPTION 'Cadastro permitido apenas por convite.';
    END IF;
  ELSE
    new_household_id := invite.household_id;
    new_role := invite.role;
  END IF;

  INSERT INTO profiles (id, household_id, email, name, role, avatar_color)
  VALUES (
    NEW.id,
    new_household_id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    new_role,
    CASE WHEN (SELECT COUNT(*) FROM profiles) % 2 = 0 THEN '#6366F1' ELSE '#EC4899' END
  );

  IF invite.id IS NOT NULL THEN
    UPDATE household_invites
    SET status = 'accepted', accepted_by = NEW.id, accepted_at = NOW()
    WHERE id = invite.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION protect_profile_admin_fields()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
    OR NEW.household_id IS DISTINCT FROM OLD.household_id
    OR NEW.email IS DISTINCT FROM OLD.email THEN
    IF NOT auth_is_household_admin() THEN
      RAISE EXCEPTION 'Apenas administradores podem alterar permissões de usuários.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS protect_profile_admin_fields ON profiles;
CREATE TRIGGER protect_profile_admin_fields
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION protect_profile_admin_fields();

CREATE OR REPLACE FUNCTION admin_attach_existing_user(target_email TEXT, target_role TEXT DEFAULT 'member')
RETURNS BOOLEAN AS $$
DECLARE
  hid UUID;
BEGIN
  IF NOT auth_is_household_admin() THEN
    RAISE EXCEPTION 'Apenas administradores podem vincular usuários.';
  END IF;

  SELECT household_id INTO hid FROM profiles WHERE id = auth.uid();
  IF hid IS NULL THEN
    RAISE EXCEPTION 'Household do admin não encontrado.';
  END IF;

  UPDATE profiles
  SET household_id = hid,
      role = CASE WHEN target_role = 'admin' THEN 'admin' ELSE 'member' END
  WHERE lower(email) = lower(target_email);

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE INDEX IF NOT EXISTS idx_invites_household_status ON household_invites(household_id, status);
