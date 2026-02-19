-- Add per-module user preferences to profiles
-- Stores wizard defaults: { podcast: {platform, duration, format}, link: {platform, duration}, story: {platform, duration, narrativeStyle} }
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferences JSONB NOT NULL DEFAULT '{}';
