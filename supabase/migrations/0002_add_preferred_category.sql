ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferred_category text DEFAULT '4' NOT NULL;
ALTER TABLE public.telegram_links ADD COLUMN IF NOT EXISTS subscribed_categories text;
ALTER TABLE public.telegram_linking_tokens ADD COLUMN IF NOT EXISTS subscribed_categories text;

-- Ensure Giorgi's profile is Category 4 (ავტომატიკა)
UPDATE public.profiles SET preferred_category = '4' WHERE email = 'giorgimgebrishvili2008@gmail.com';

-- Ensure Friend / Valeri's profile is Category 3 (მექანიკა)
UPDATE public.profiles SET preferred_category = '3' WHERE email IN ('termelashvilivaleri@gmail.com', 'friend@exam-monitor.local');

-- Synchronize telegram_links to match
UPDATE public.telegram_links SET subscribed_categories = '4' WHERE user_id = '14d6d0c0-7044-4afd-b466-f1362d00b2a8';
UPDATE public.telegram_links SET subscribed_categories = '3' WHERE user_id IN ('4680840b-6368-480a-bc78-86acff220a72', '25399af6-d82a-46d7-a49c-4fe5318c6d81');
