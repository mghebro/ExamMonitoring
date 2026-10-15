-- Initial seed data for development
-- Generic default monitoring target (no hardcoded locations)
INSERT INTO public.exam_targets (
  id,
  name,
  endpoint_url,
  category_code,
  center_id,
  is_first_attempt,
  poll_interval_seconds,
  is_active
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Practical Exam Availability Monitor',
  'https://exam-booking.sa.gov.ge/practical/dates?CategoryCode=4&CenterId=7&isFirstAttempt=0',
  '4',
  '7',
  false,
  60,
  true
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.monitoring_state (
  target_id,
  state,
  last_status,
  consecutive_failures
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Unknown',
  'UNKNOWN',
  0
) ON CONFLICT (target_id) DO NOTHING;
