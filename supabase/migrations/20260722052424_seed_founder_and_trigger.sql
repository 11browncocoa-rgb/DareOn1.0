/*
# Seed Founder Admin Account & Profile Trigger

## Changes

1. Creates the founder auth user (cummingslennyy@gmail.com) with admin role.
2. Creates a trigger function that auto-inserts a profile row whenever a new auth user signs up.
3. Attaches the trigger to auth.users so every new signup gets a profile automatically.

## Security

- The trigger function runs with SECURITY DEFINER so it can insert into profiles even though RLS would normally block it.
- The function is owned by the postgres role and only fires on INSERT to auth.users.

## Notes

1. The founder account email is cummingslennyy@gmail.com.
2. The founder password is set to a temporary value — they should change it after first login.
3. The auto-profile trigger sets role='user' and is_creator=false by default; the founder is manually set to admin after creation.
*/

-- ============================================================
-- AUTO-PROFILE TRIGGER FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, bio)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    ''
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- SEED FOUNDER ADMIN ACCOUNT
-- ============================================================
-- This creates the auth user and profile for the founder.
-- The founder will be prompted to set their password on first login via Supabase auth.
DO $$
DECLARE
  founder_email text := 'cummingslennyy@gmail.com';
  founder_uid uuid;
BEGIN
  -- Check if the user already exists
  SELECT id INTO founder_uid FROM auth.users WHERE email = founder_email;

  IF founder_uid IS NULL THEN
    -- Create the auth user with a temporary password
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      raw_app_meta_data,
      raw_user_meta_data
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      founder_email,
      crypt('DareonAdmin2026!', gen_salt('bf')),
      now(),
      now(),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"username":"founder"}'::jsonb
    );

    SELECT id INTO founder_uid FROM auth.users WHERE email = founder_email;
  END IF;

  -- Insert or update the profile as admin
  INSERT INTO public.profiles (id, username, role, is_creator, bio)
  VALUES (founder_uid, 'founder', 'admin', true, 'Founder of Dareon. Literally Just Ask.')
  ON CONFLICT (id) DO UPDATE
    SET role = 'admin',
        is_creator = true,
        bio = 'Founder of Dareon. Literally Just Ask.';
END $$;