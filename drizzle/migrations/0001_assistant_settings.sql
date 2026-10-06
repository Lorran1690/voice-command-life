CREATE TABLE public.assistant_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  voice text NOT NULL DEFAULT 'tempo',
  browser_voice text,
  personality text NOT NULL DEFAULT 'jarvis',
  tone text NOT NULL DEFAULT 'calm',
  verbosity text NOT NULL DEFAULT 'normal',
  humor integer NOT NULL DEFAULT 20 CHECK (humor >= 0 AND humor <= 100),
  proactive boolean NOT NULL DEFAULT true,
  confirm_actions boolean NOT NULL DEFAULT true,
  auto_memory boolean NOT NULL DEFAULT true,
  language text NOT NULL DEFAULT 'pt-BR',
  voice_speed numeric(3,2) NOT NULL DEFAULT 1.00 CHECK (voice_speed >= 0.75 AND voice_speed <= 1.25),
  custom_instructions text NOT NULL DEFAULT '',
  hud_accent text NOT NULL DEFAULT 'cyan',
  motion_intensity text NOT NULL DEFAULT 'high',
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assistant_settings TO authenticated;
GRANT ALL ON public.assistant_settings TO service_role;
ALTER TABLE public.assistant_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own assistant settings" ON public.assistant_settings
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
