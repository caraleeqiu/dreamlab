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
│       │   ├── remix/      # Remix video
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
| Remix | 5 |
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
- **User preferences persistence**: `profiles.preferences JSONB` stores per-module wizard defaults (`{ podcast: {platform, duration, format}, link: {platform, duration} }`). `PATCH /api/user/preferences` merges module-level updates. Wizards pre-fill state from `initialPrefs` prop and silently save on key step transitions.

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

**Multi-shot grouping strategy** (`groupClips`):
- Each group: ≤ 6 shots AND total duration ≤ 15s
- Single-clip group → `intelligence` mode
- Multi-clip group → `customize` mode + `multi_prompt`

## Detailed Docs

- [Architecture & progress log](./ai-influencer.md)
- [Bootstrap & setup notes](./bootstrap.md)
