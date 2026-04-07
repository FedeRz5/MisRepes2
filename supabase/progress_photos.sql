-- Progress photos table
CREATE TABLE public.progress_photos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  photo_url text NOT NULL,
  date date NOT NULL DEFAULT current_date,
  category text NOT NULL DEFAULT 'frente' CHECK (category IN ('frente', 'espalda', 'lateral', 'otro')),
  weight_kg numeric,
  body_fat_pct numeric,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.progress_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own photos" ON public.progress_photos
  FOR SELECT USING (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('trainer', 'owner'))
  );

CREATE POLICY "Users manage own photos" ON public.progress_photos
  FOR ALL USING (user_id = auth.uid());
