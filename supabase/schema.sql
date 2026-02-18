-- ============================================================
-- Dreamlab · Supabase Schema
-- ============================================================

-- 用户扩展表（关联 Supabase Auth users）
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text,
  display_name text,
  credits      integer not null default 0,
  language     text not null default 'zh' check (language in ('zh', 'en')),
  created_at   timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "users can view own profile" on public.profiles
  for select using (auth.uid() = id);
create policy "users can update own profile" on public.profiles
  for update using (auth.uid() = id);

-- Credit 流水
create table public.credit_transactions (
  id          bigserial primary key,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  amount      integer not null,              -- 正=充值，负=消耗
  reason      text not null,                 -- 'purchase' / 'podcast' / 'remix' 等
  job_id      bigint,                        -- 关联的内容任务（可空）
  stripe_session_id text,
  created_at  timestamptz not null default now()
);
alter table public.credit_transactions enable row level security;
create policy "users view own transactions" on public.credit_transactions
  for select using (auth.uid() = user_id);

-- 网红档案
create table public.influencers (
  id              bigserial primary key,
  user_id         uuid references public.profiles(id) on delete cascade,
                  -- null = 内置网红
  slug            text unique not null,       -- 'sable' / 'miso' / user-created
  name            text not null,
  is_builtin      boolean not null default false,
  type            text not null check (type in ('human','animal','virtual','brand')),
  tagline         text,                       -- 一句话人设
  personality     text[],                     -- 性格标签 max 3
  domains         text[],                     -- 主领域 max 3
  speaking_style  text,
  catchphrases    text[],                     -- 口头禅 max 3
  chat_style      text check (chat_style in ('dominant','supportive','debate')),
  forbidden       text,
  voice_prompt    text,                       -- 声线描述，注入 Kling prompt
  frontal_image_url text,                     -- R2 公开 URL
  created_at      timestamptz not null default now()
);
alter table public.influencers enable row level security;
create policy "builtin influencers viewable by all" on public.influencers
  for select using (is_builtin = true or auth.uid() = user_id);
create policy "users manage own influencers" on public.influencers
  for all using (auth.uid() = user_id);

-- 内容生产任务（每次点击"生成视频"创建一条）
create type public.job_type as enum (
  'podcast', 'remix', 'edu', 'anime', 'trending', 'story'
);
create type public.job_status as enum (
  'pending', 'scripting', 'generating', 'lipsync', 'stitching', 'done', 'failed'
);
create table public.jobs (
  id              bigserial primary key,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  type            job_type not null,
  status          job_status not null default 'pending',
  language        text not null default 'zh' check (language in ('zh', 'en')),
  title           text,                       -- 话题标题
  platform        text,                       -- 'douyin' / 'youtube' 等
  aspect_ratio    text default '9:16',
  duration_s      integer,                    -- 目标时长（秒）
  influencer_ids  bigint[],                   -- 选用的网红
  script          jsonb,                      -- 完整脚本（切片数组）
  final_video_url text,                       -- 成品 R2 URL
  credit_cost     integer not null default 0,
  error_msg       text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
alter table public.jobs enable row level security;
create policy "users view own jobs" on public.jobs
  for select using (auth.uid() = user_id);
create policy "users create jobs" on public.jobs
  for insert with check (auth.uid() = user_id);
create policy "users update own jobs" on public.jobs
  for update using (auth.uid() = user_id);

-- 视频切片任务（每个 15s 切片一条）
create type public.clip_status as enum (
  'pending', 'submitted', 'processing', 'done', 'lipsync', 'failed'
);
create table public.clips (
  id              bigserial primary key,
  job_id          bigint not null references public.jobs(id) on delete cascade,
  clip_index      integer not null,           -- 0-based 顺序
  kling_task_id   text,                       -- 可灵返回的 task_id
  status          clip_status not null default 'pending',
  prompt          text,
  first_frame_url text,
  video_url       text,                       -- 可灵生成的视频 R2 URL
  lipsync_url     text,                       -- lip sync 后的 R2 URL
  error_msg       text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
-- clips 不需要 RLS（只通过后端 service_role 访问）

-- 原子充值函数（Stripe webhook 调用）
create or replace function public.add_credits(
  p_user_id uuid,
  p_amount   integer,
  p_reason   text,
  p_stripe_session_id text default null
)
returns void language plpgsql security definer as $$
begin
  update public.profiles
  set credits = credits + p_amount
  where id = p_user_id;

  insert into public.credit_transactions (user_id, amount, reason, stripe_session_id)
  values (p_user_id, p_amount, p_reason, p_stripe_session_id);
end; $$;

-- 原子扣费函数（并发安全）
create or replace function public.deduct_credits(
  p_user_id uuid,
  p_amount   integer,
  p_reason   text,
  p_job_id   bigint default null
)
returns void language plpgsql security definer as $$
begin
  update public.profiles
  set credits = credits - p_amount
  where id = p_user_id and credits >= p_amount;

  if not found then
    raise exception 'insufficient_credits';
  end if;

  insert into public.credit_transactions (user_id, amount, reason, job_id)
  values (p_user_id, -p_amount, p_reason, p_job_id);
end; $$;

-- 自动更新 updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger jobs_updated_at before update on public.jobs
  for each row execute function public.set_updated_at();
create trigger clips_updated_at before update on public.clips
  for each row execute function public.set_updated_at();

-- 新用户注册自动创建 profile（含新手礼 20积分）
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, credits, language)
  values (new.id, new.email, 20, 'zh');
  insert into public.credit_transactions (user_id, amount, reason)
  values (new.id, 20, 'welcome_bonus');
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
