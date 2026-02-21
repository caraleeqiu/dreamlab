# Dreamlab — AI Influencer Studio

AI-powered video generation platform. Create podcast, educational, remix, anime, and story videos using virtual influencers, powered by Kling AI.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) + React 19 + TypeScript |
| Auth & DB | Supabase (PostgreSQL + RLS + Auth) |
| AI Video | Kling AI (image2video, multi-shot, Subject Library 3.0) |
| AI Script | Google Gemini 2.0 Flash (retry + timeout wrapper) |
| Storage | Cloudflare R2 (S3-compatible) |
| Payments | Stripe |
| Video Processing | ffmpeg-static (dedicated stitch route, maxDuration=300) |
| Testing | Vitest |

## Project Structure

```
src/
├── app/
│   ├── (app)/              # Authenticated pages
│   │   ├── home/           # Dashboard
│   │   ├── studio/         # Content creation wizards
│   │   ├── jobs/           # Job status & history
│   │   ├── works/          # Completed works
│   │   └── influencers/    # Influencer management
│   └── api/
│       ├── studio/         # Video generation endpoints
│       │   ├── script/     # Script-based video
│       │   ├── podcast/    # Podcast video
│       │   ├── edu/        # Educational video (talk/animated/cinematic/paper)
│       │   ├── remix/      # Remix video (visual-remix, segment-splice, script-imitation)
│       │   │   ├── analyze/  # Gemini Vision keyframe analysis → RemixAnalysis
│       │   │   ├── create/   # Script imitation job creation (deferred chain)
│       │   │   └── splice/   # Segment replacement (ai-generate / upload-clip)
│       │   ├── anime/      # Anime-style video
│       │   ├── story/      # Story video
│       │   └── link/       # Link-to-video
│       ├── jobs/
│       │   ├── [id]/
│       │   │   ├── stitch/ # FFmpeg stitch (maxDuration=300, x-stitch-secret)
│       │   │   └── stream/ # SSE: real-time job detail
│       │   ├── recover/    # Re-fire stalled clips (Supabase Cron, */10 min)
│       │   └── stream/     # SSE: active jobs list
│       ├── credits/        # Stripe checkout
│       ├── influencers/    # Influencer CRUD + auto Subject Library registration
│       │   └── [id]/register-kling/  # Manual Kling Subject Library registration
│       ├── admin/
│       │   └── influencers/sync-subjects/ # Bulk Kling Subject Library sync
│       └── webhooks/
│           ├── kling/      # Kling callback (thin — triggers stitch via fetch)
│           └── stripe/     # Stripe payment events
├── lib/
│   ├── config.ts           # Credit costs & packages (single source of truth)
│   ├── api-response.ts     # Unified apiError() helper
│   ├── job-service.ts      # deductCredits (bilingual), createClipRecords, failClipAndCheckJob
│   ├── gemini.ts           # Gemini wrapper: 3 retries, 60s timeout, callGeminiJson<T>
│   ├── logger.ts           # Structured logging (JSON in prod, colored in dev)
│   ├── video-utils.ts      # groupClips(), groupClipsByProvider(), annotateProviders()
│   ├── video-router.ts     # Multi-provider routing (Kling / Seedance fallback)
│   ├── kling.ts            # Kling API: JWT auth, image2video, multi-shot, Subject Library
│   ├── bgm.ts              # BGM style map (6 presets) + dominantBgm() + downloadBgm()
│   ├── r2.ts               # Cloudflare R2 upload/presign
│   ├── i18n.ts             # UI string dictionary (zh/en)
│   └── supabase/           # Supabase client (client/server/service)
└── __tests__/              # Vitest unit tests
```

## Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Kling AI
KLING_BASE_URL=https://api.klingai.com
KLING_ACCESS_KEY=
KLING_SECRET_KEY=
KLING_WEBHOOK_SECRET=          # Random hex — appended as ?whs= to callback URL

# Google Gemini
GEMINI_API_KEY=

# Cloudflare R2
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_URL=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
RECOVER_SECRET=                # Random hex — guards /api/jobs/[id]/stitch and /api/jobs/recover
```

## Development

```bash
npm install
npm run dev        # Start dev server
npm run build      # Production build
npm test           # Run unit tests
npm run test:watch # Watch mode
```

## Credit Costs

| Job Type | Credits |
|----------|---------|
| Script video | 15 |
| Podcast | 20 |
| Educational (talk) | 15 |
| Educational (animated) | 20 |
| Educational (cinematic) | 20 |
| Educational (paper) | 25 |
| Anime | 50 |
| Story | 30 |
| Remix (Visual / Script Imitation) | 20 |
| Segment Splice | Free |
| Link-to-video | 15 |
| Create influencer | 10 (first free) |

Defined in `src/lib/config.ts` — change prices in one place.

## Architecture

### Video Generation Flow

```
wizard → POST /api/studio/[type]
  → deductCredits (bilingual error)
  → insert job + clips
  → submit to Kling (image2video / multi-shot)
    → callback URL: /api/webhooks/kling?whs=SECRET
      → update clip status
      → all clips done → PUT job=stitching
        → fetch /api/jobs/[id]/stitch (maxDuration=300)
          → download clips from R2
          → ffmpeg concat
          → upload final video to R2
          → PUT job=done
      → any clip failed → PUT job=failed + refund credits
```

### Key Design Decisions

- **FFmpeg in dedicated route**: `POST /api/jobs/[id]/stitch` with `maxDuration=300` avoids Vercel's 60s function timeout. Webhook triggers it via fire-and-forget `fetch()`.
- **Webhook security**: Kling callback URL includes `?whs=KLING_WEBHOOK_SECRET`. Handler validates before processing.
- **Webhook robustness**: Clip lookup first queries by `kling_task_id`, then falls back to `task_id` via `.maybeSingle()` chaining — handles both old and new records.
- **Credits refund**: Two refund points — submit-time failure (job-service) and generation-time failure (webhook). Uses `add_credits` Supabase RPC.
- **Gemini reliability**: All script routes use `callGeminiJson<T>()` — 3 retries, 60s timeout per attempt, exponential backoff (1s/2s/4s), strips markdown fences.
- **Subject Library**: Influencer creation auto-registers with Kling 3.0 Subject Library (fire-and-forget). `buildClipPrompt` prefers `element_id` over `frontal_image_url` for better character consistency.
- **Multi-provider routing**: `video-router.ts` routes clips to Kling or Seedance based on availability. In-process `Map<provider, blockedUntil>` (resets on cold start — DB-backed routing is a future improvement). Currently Kling-only until Seedance 2.0 key is available.
- **Bilingual API layer**: All user-facing API errors respect `lang` from request body. Job titles stored bilingually based on user's language preference.
- **Dynamic HTML lang**: Root layout reads `dreamlab-lang` cookie (set by app layout after profile fetch) → `<html lang="en">` or `<html lang="zh-CN">`.
- **Recovery cron**: Supabase Cron fires `POST /api/jobs/recover` every 10 minutes to re-process clips stuck in `submitted` state > 30 min.
- **Visual consistency (`consistency_anchor`)**: Story `ScriptClip` includes a `consistency_anchor` string (character appearance + location + lighting). Injected into every Kling prompt batch as `[Visual anchor: ...]` to maintain cross-clip character/scene coherence.
- **Podcast wizard 4-tab entry**: Step 0 has 4 top-level modes — 🔥 Trending (topic list + conversation angle input simultaneously), ✍️ Write (textarea), 🔗 URL (with source hints and `fallback: 'write'` error handling), 📄 PDF. URL extraction uses Jina AI reader + Twitter oEmbed for tweets; platform-blocked sources (WeChat, Xiaohongshu, video platforms) return friendly errors and auto-switch to Write mode.
- **Link extract via Jina AI**: Replaced raw fetch/HTML-strip (8K chars) with Jina AI reader (60K chars). Same platform detection as podcast — WeChat/Xiaohongshu/Bilibili/Douyin return `fallback: 'script'` errors; Twitter uses oEmbed.
- **User preferences persistence**: `profiles.preferences JSONB` stores per-module wizard defaults (`{ podcast: {platform, duration, format}, link: {platform, duration}, story: {platform, duration, narrativeStyle} }`). `PATCH /api/user/preferences` merges module-level updates. Wizards pre-fill state from `initialPrefs` prop and silently save on key step transitions.
- **Job type filter**: `/jobs` page has filter chips (All / Podcast / Story / Edu / Link / Anime / Script). Empty state distinguishes between "no active tasks" and "no tasks of this type".
- **Job detail failure UX**: Failed jobs show error panel with error message, credit refund confirmation, and "Create again" retry button linking back to the appropriate studio.
- **Series panel enhancements**: `SeriesPanel` shows episode count, last episode's cliffhanger in violet italic, bilingual continue button and episode pills.
- **Edu Talk URL hints**: Source hints panel below URL input in Talk wizard (supported: articles, arXiv, Wikipedia; unsupported: WeChat, Xiaohongshu, video platforms).
- **Anime script editing**: Script step renders dialogues as editable textareas. AI extraction failure shows amber warning banner prompting manual fill.
- **New influencers**: Marin (fashion/virtual, recommended for wear category) and Senku (tech/tools/virtual, recommended for tools category).
- **Credits refund on job-create failure**: All 5 studio submit routes (anime/edu/podcast/remix/story) now call `add_credits` RPC immediately if the job INSERT fails, closing a gap where credits could be lost before any clip was created.
- **Clip post-editing** (`POST /api/studio/edit-clip`): Any completed clip can be re-edited via `kling-v3-omni` base editing mode (`video_list refer_type: "base"`). The clip is updated in-place (same `clip_id`/`clip_index`), job resets to `generating`, and the existing webhook → stitch pipeline handles re-assembly automatically. No credit charge — editing refines already-paid content.
- **Remix Omni upgrade** (`submitVideoToVideo`): Replaces the former `submitReferenceToVideo` which used a non-existent endpoint. Unified function supports both `refer_type: "feature"` (cinematic style reference, used by remix) and `"base"` (direct editing, used by edit-clip). Kling API constraint: `sound` must be `"off"` when `video_list` is present; `keepOriginalSound` controls audio preservation instead.
- **`getTaskStatus` triple fallback**: image2video → text2video → omni-video, so the webhook handles all Kling task types without storing endpoint type per clip.
- **Podcast storyboard inline editing**: Dialogue column in the storyboard preview table is now an editable `<input>` — no need to go back a step to fix a line.
- **Story series `previousEpisodeSummary`**: Episode 2+ shows an optional free-text field for the prior episode's events. Used as `prevCliffhanger` fallback when the DB lookup finds no completed prior job.

### Round 26 — Influencer Creation Enhancements (2026-02)

- **Personality conflict detection**: Create wizard warns when selecting conflicting personality traits (严肃 vs 幽默, 理性 vs 感性, 霸气 vs 萌系, etc.). Amber warning panel guides users to pick coherent traits.
- **Domain conflict detection**: Warns when selecting domains with different target audiences (财经 vs 娱乐, 科技 vs 情感, 教育 vs 游戏).
- **Full-field search**: Influencer search now supports all fields — type (真人/动物/虚拟/品牌), ownership (官方/我的), personality tags, domains, speaking style, catchphrases, and forbidden topics. Bilingual support (Chinese + English labels).
- **English TTS voices**: 16 built-in influencers now have English voice samples (`public/influencers/voices/`). Voice types matched to personality: Aoede (warm), Autonoe (energetic), Despina (cute), Achird (mature male), Charon (young male).
- **Custom influencer TTS**: User-created influencers can preview voice via `/api/influencers/tts`. Auto-selects voice type based on personality traits. Returns base64 audio for immediate playback.
- **AI prompt optimization**: Image generation step has "优化 Prompt" button. Calls `/api/influencers/optimize-prompt` which uses Gemini to enhance user's description into professional image generation prompt.
- **Default prompt generation**: Entering the image step auto-generates a starter prompt based on influencer type, name, and personality.
- **Custom tag UX**: Custom personality/domain tags now display immediately after Enter, with X button to remove. Fixes invisible custom tag issue.

### Round 25 — BGM Mixing · Single-clip Regen · Kling Registration UI (2026-02)

- **BGM mixing** (`src/lib/bgm.ts`): 6 style presets (轻松欢快/科技感/励志/悬疑/温馨/紧张 + English aliases) mapped to Kevin MacLeod CC-BY URLs. `dominantBgm()` picks the most common bgm style across script clips. Stitch route mixes BGM at 12% volume with `ffmpeg amix` after crossfade concat.
- **Single-clip regeneration**: Job detail page shows a "Regen" button per clip. Estimates the clip's time range as `clip_index × 15s` and calls `/api/studio/remix/splice` with `ai-generate` mode — no extra credits charged.
- **Kling Subject Library registration UI**: InfluencerCard detail modal now has a "Register to Kling / 注册主体" button. Calls `POST /api/influencers/[id]/register-kling` which runs `createSubject()`, saves `kling_element_id` and `kling_element_voice_id` to DB, and shows a green "Registered" badge on success.
- **Credit cost fix**: Remix increased from 5 → 20 credits in `src/lib/config.ts`.

### Round 24 — Remix v2: 3 Scenarios + Gemini Vision Analysis (2026-02)

- **Remix wizard v2**: Replaced single-flow with a **tabs-based** layout — 3 tabs (Visual Remix / Segment Splice / Script Imitation) always visible; no mode-selection landing screen needed.
- **Visual Remix** (`/api/studio/remix`): Upload reference video URL, pick influencer, platform, remix style → Kling omni video.
- **Segment Splice** (`/api/studio/remix/splice`): Select a completed job, specify time range. `upload-clip` mode: download + FFmpeg normalize + concat synchronously. `ai-generate` mode: extract before/after parts, upload to R2, submit sub-job to Kling, webhook handles 3-part stitch.
- **Script Imitation** (`/api/studio/remix/analyze` + `/create`): Downloads reference video to `/tmp`, extracts 6 evenly-spaced keyframes via FFmpeg, calls Gemini Vision for narrative/scene/style analysis, returns `RemixAnalysis` schema. `/create` mirrors reference to R2 for camera-style learning, builds prompts with visual anchors, uses deferred clip chaining same as story route.

### Kling API 3.0 Reference

| Parameter | Notes |
|-----------|-------|
| `multi_shot: true` | Multi-shot mode (boolean) |
| `shot_type: "intelligence"` | Model auto-cuts; single prompt |
| `shot_type: "customize"` | Manual shots; `multi_prompt` array |
| `sound: "on"` | Enable audio generation |
| `element_list` | Subject control (character image binding) |
| `voice_list` | Voice binding (via Subject Library `voice_id`) |
| `duration` | String enum `"3"`–`"15"` |
| `video_list` | Video reference; `refer_type: "feature"` = cinematic style ref (remix); `refer_type: "base"` = editing target (clip edit). `sound` must be `"off"` when present |
| `keep_original_sound` | `"yes"/"no"` — preserve source video audio when using `video_list` |

**Multi-shot grouping strategy** (`groupClips`):
- Each group: ≤ 6 shots AND total duration ≤ 15s
- Single-clip group → `intelligence` mode
- Multi-clip group → `customize` mode + `multi_prompt`

## Claude Code Skills Integration

The following Claude Code skills are installed at `~/.claude/skills/` and can be invoked directly via `/skill-name` when working on Dreamlab.

| Skill | Trigger | Use in Dreamlab |
|-------|---------|----------------|
| `create-viral-content` | `/create-viral-content` | Run generated podcast/story/edu scripts through 6-pass adversarial refinement (Skeptic/Expert/Scroller/Competitor/Editor) to strengthen hooks and remove AI tells |
| `viral-content` | `/viral-content` | Platform-specific viral optimization (hook architecture, 25+ title formulas, thumbnail design) for short-form content |
| `youtube-clipper` | `/youtube-clipper <url>` | Download + chapter-split YouTube/Douyin reference videos before feeding them into the Remix wizard |
| `video-processor` | `/video-processor` | Download platform videos via yt-dlp, extract audio, transcribe with Whisper — useful for preparing reference material for remix/analyze |
| `video-remix-analyzer` | `/video-remix-analyzer` | Deep narrative and remix opportunity analysis (aligns with `/api/studio/remix/analyze` flow) |
| `remotion-video-skill` | `/remotion-video` | Programmatic React-based video for intro/outro sequences or data-driven overlays |
| `edu-faceless-video` | `/edu-faceless-video` | Faceless educational video scripts using Dan Koe philosophy — feeds into `/api/studio/edu` |

### Recommended Workflow Enhancements

1. **Script quality**: After Gemini generates a podcast/story script, run `/create-viral-content` to apply adversarial refinement before submitting to Kling.
2. **Reference video prep**: If the user has a YouTube URL for remix, use `/youtube-clipper <url>` to download + chapter the video first, then feed the resulting clip into the Remix → Script Imitation tab.
3. **Short-form optimization**: Run `/viral-content` on the generated dialogue to check for AI tells and apply platform-specific hook patterns.

## Detailed Docs

- [Architecture & progress log](./ai-influencer.md)
- [Bootstrap & setup notes](./bootstrap.md)
