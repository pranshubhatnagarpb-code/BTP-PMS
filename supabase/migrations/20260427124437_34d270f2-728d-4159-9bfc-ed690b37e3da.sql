DO $$
DECLARE
  new_user_id uuid := gen_random_uuid();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'amit@frommonday.in') THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, recovery_sent_at, last_sign_in_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      new_user_id,
      'authenticated', 'authenticated',
      'amit@frommonday.in',
      crypt('FM@123', gen_salt('bf')),
      now(), NULL, NULL,
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Dr. Aamit Shah"}',
      now(), now(), '', '', '', ''
    );

    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(),
      new_user_id,
      format('{"sub":"%s","email":"%s"}', new_user_id, 'amit@frommonday.in')::jsonb,
      'email',
      new_user_id::text,
      now(), now(), now()
    );
  END IF;
END $$;