# Dreamlab — AI Influencer Factory

AI-powered video generation platform. Create podcast, educational, remix, anime, and story videos using virtual influencers, powered by Kling AI.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) + React 19 + TypeScript |
| Auth & DB | Supabase (PostgreSQL + RLS + Auth) |
| AI Video | Kling AI (image2video, multi-shot, lip-sync) |
| AI Script | Google Gemini 2.0 Flash |
| Storage | Cloudflare R2 (S3-compatible) |
| Payments | Stripe |
| Video Processing | ffmpeg-static (server-side concat) |
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
│       │   ├── edu/        # Educational video
│       │   ├── remix/      # Remix video
│       │   ├── anime/      # Anime-style video
│       │   ├── story/      # Story video
│       │   └── link/       # Link-to-video
│       ├── jobs/
│       │   ├── [id]/
│       │   │   └── stream/ # SSE: real-time job detail
│       │   └── stream/     # SSE: active jobs list
│       ├── credits/        # Stripe checkout
│       ├── influencers/    # Influencer CRUD
│       └── webhooks/
│           ├── kling/      # Kling callback + ffmpeg stitch
│           └── stripe/     # Stripe payment events
├── lib/
│   ├── config.ts           # Credit costs & packages (single source of truth)
│   ├── api-response.ts     # Unified apiError() helper
│   ├── job-service.ts      # Service layer: deductCredits, createClipRecords
│   ├── logger.ts           # Structured logging (JSON in prod, colored in dev)
│   ├── video-utils.ts      # groupClips() — Kling multi-shot batching
│   ├── kling.ts            # Kling API client with JWT auth + exponential backoff
│   ├── r2.ts               # Cloudflare R2 upload/presign
│   └── supabase/           # Supabase client (client/server/service)
└── __tests__/              # Vitest unit tests (32 tests)
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
| Educational | 15 |
| Anime | 50 |
| Story | 30 |
| Remix | 5 |
| Link-to-video | 15 |

Defined in `src/lib/config.ts` — change prices in one place.

## Architecture Notes

- **Real-time updates**: Job status pushed via SSE (`/api/jobs/[id]/stream`, `/api/jobs/stream`) — no frontend polling
- **Retry**: Kling API calls use exponential backoff (3 attempts, 1s/2s/4s delays)
- **Webhook security**: Kling callbacks re-fetch task status from API instead of trusting payload
- **Video stitching**: ffmpeg-static concat (stream copy, no re-encode) in the Kling webhook handler
- **Multi-shot batching**: `groupClips()` splits long scripts into groups of ≤6 shots / ≤15s for Kling's limit

## Detailed Docs

- [Architecture & progress log](./ai-influencer.md)
- [Bootstrap & setup notes](./bootstrap.md)
