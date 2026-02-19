-- Add series tracking columns to jobs table
alter table public.jobs add column if not exists series_name text;
alter table public.jobs add column if not exists episode_number integer;
alter table public.jobs add column if not exists cliffhanger text;
