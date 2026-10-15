-- ==============================================================================
-- Migration: Row Level Security, Triggers, and Security Functions
-- ==============================================================================

-- 1. Helper Function: Check if the current authenticated user is an administrator
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  );
$$;

-- 2. Trigger Function: Automatically create profile and notification preferences when auth.user is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  assigned_role text := 'user';
  invitation_record record;
BEGIN
  -- Check if an active invitation exists for this email
  SELECT * INTO invitation_record
  FROM public.invitations
  WHERE email = NEW.email
    AND expires_at > now()
    AND accepted_at IS NULL
  LIMIT 1;

  IF FOUND THEN
    assigned_role := invitation_record.role;
    UPDATE public.invitations
    SET accepted_at = now()
    WHERE id = invitation_record.id;
  ELSE
    -- If no users exist yet in profiles, make the very first user the admin
    IF NOT EXISTS (SELECT 1 FROM public.profiles LIMIT 1) THEN
      assigned_role := 'admin';
    END IF;
  END IF;

  INSERT INTO public.profiles (id, email, role, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    assigned_role,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', '')
  );

  INSERT INTO public.notification_preferences (user_id, notify_on_available)
  VALUES (NEW.id, true);

  RETURN NEW;
END;
$$;

-- Attach trigger to auth.users if auth schema exists (Supabase environment)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;
END $$;

-- 3. Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monitoring_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.available_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monitoring_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_linking_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_processed_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.polling_benchmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_leases ENABLE ROW LEVEL SECURITY;

-- 4. Policies for profiles
CREATE POLICY "profiles_select_own_or_admin"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR public.is_admin());

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid() AND
    -- Prevent regular users from promoting themselves to admin
    (role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid()) OR public.is_admin())
  );

-- 5. Policies for invitations
CREATE POLICY "invitations_admin_only"
  ON public.invitations FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 6. Policies for exam_targets
CREATE POLICY "exam_targets_select_authenticated"
  ON public.exam_targets FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "exam_targets_admin_modify"
  ON public.exam_targets FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 7. Policies for monitoring_state
CREATE POLICY "monitoring_state_select_authenticated"
  ON public.monitoring_state FOR SELECT
  TO authenticated
  USING (true);

-- 8. Policies for availability_snapshots
CREATE POLICY "availability_snapshots_select_authenticated"
  ON public.availability_snapshots FOR SELECT
  TO authenticated
  USING (true);

-- 9. Policies for available_slots
CREATE POLICY "available_slots_select_authenticated"
  ON public.available_slots FOR SELECT
  TO authenticated
  USING (true);

-- 10. Policies for monitoring_events
CREATE POLICY "monitoring_events_select_authenticated"
  ON public.monitoring_events FOR SELECT
  TO authenticated
  USING (true);

-- 11. Policies for telegram_links
CREATE POLICY "telegram_links_select_own"
  ON public.telegram_links FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "telegram_links_update_own"
  ON public.telegram_links FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 12. Policies for telegram_linking_tokens
-- By default, public client cannot query or write tokens directly (only service-role via backend API)
CREATE POLICY "telegram_linking_tokens_no_public"
  ON public.telegram_linking_tokens FOR ALL
  TO authenticated
  USING (false);

-- 13. Policies for telegram_processed_updates
CREATE POLICY "telegram_processed_updates_no_public"
  ON public.telegram_processed_updates FOR ALL
  TO authenticated
  USING (false);

-- 14. Policies for notification_preferences
CREATE POLICY "notification_preferences_select_own"
  ON public.notification_preferences FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "notification_preferences_update_own"
  ON public.notification_preferences FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "notification_preferences_insert_own"
  ON public.notification_preferences FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 15. Policies for notification_outbox
CREATE POLICY "notification_outbox_select_own"
  ON public.notification_outbox FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

-- 16. Policies for polling_benchmarks
CREATE POLICY "polling_benchmarks_select_authenticated"
  ON public.polling_benchmarks FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "polling_benchmarks_admin_insert"
  ON public.polling_benchmarks FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- 17. Policies for worker_leases
CREATE POLICY "worker_leases_no_public"
  ON public.worker_leases FOR ALL
  TO authenticated
  USING (false);
