# 🎭 Dreamlab - AI Influencer Factory 项目详细文档

> **项目代号**: Dreamlab（AI红网工厂）
> **最后更新**: 2026-02-19 (Round 13 完结)
> **状态**: 🟢 **全流程可测试** — 4种网红科普模式上线，多 Provider 路由完整架构，webhook 自动合成 PiP + 字幕

## ✅ Round 13（2026-02-19）— 网红科普 Hub + 全动画 + 论文解读 + 多Provider架构

### 新增/修改文件

| 文件 | 作用 |
|------|------|
| `src/app/(app)/studio/edu/page.tsx` | **重建为 Hub 页面**：4张子类型卡片（口播/动画/全动画/论文） |
| `src/app/(app)/studio/edu/talk/` | 口播科普完整向导（5步，violet配色，15积分） |
| `src/app/(app)/studio/edu/animated/` | 动画科普故事完整向导（5步，amber配色，30积分） |
| `src/app/(app)/studio/edu/cinematic/` | **新** 全动画科普向导（5步，emerald配色，20积分，无出镜角色） |
| `src/app/(app)/studio/edu/paper/` | **新** 论文解读向导（6步，sky配色，40积分，Napkin PiP） |
| `src/app/api/studio/edu/extract/route.ts` | **新** 共享内容提取（URL/文本 → Gemini → EduContent） |
| `src/app/api/studio/edu/talk/script/route.ts` | **新** 口播脚本生成（Hook-Explain-Apply-Wonder框架） |
| `src/app/api/studio/edu/talk/route.ts` | **新** 口播视频提交（Kling multi-shot，forceKling） |
| `src/app/api/studio/edu/animated/script/route.ts` | **新** 动画脚本生成（故事弧线：困境→探索→揭示→突破→收尾） |
| `src/app/api/studio/edu/animated/route.ts` | **新** 动画视频提交（6种动漫风格，forceKling） |
| `src/app/api/studio/edu/cinematic/script/route.ts` | **新** 全动画脚本（纯场景，无人物，6种视觉风格） |
| `src/app/api/studio/edu/cinematic/route.ts` | **新** 全动画提交（Kling text2video，1:1 clip映射） |
| `src/app/api/studio/edu/paper/diagrams/route.ts` | **新** Napkin分镜图生成（每个知识点并行生成） |
| `src/app/api/studio/edu/paper/script/route.ts` | **新** 论文解读脚本（每段含 diagram_index） |
| `src/app/api/studio/edu/paper/route.ts` | **新** 论文解读提交（diagram_urls 存入 job.metadata） |
| `src/lib/napkin.ts` | **新** Napkin AI 客户端（submit→poll→返回图片URL） |
| `src/lib/seedance.ts` | **新** Seedance 客户端存根（API 待发布，含 TODO） |
| `src/lib/video-utils.ts` | **重写** 新增 `groupClipsByProvider()` / `annotateProviders()` / `resolveClipProvider()` / `getProviderMix()` |
| `src/lib/kling.ts` | 新增 `submitText2Video()` / `getTaskStatus()` 双端点回退（image2video → text2video） |
| `src/lib/config.ts` | 新增 `edu_talk:15` / `edu_animated:30` / `edu_paper:40` / `edu_cinematic:20` |
| `src/types/index.ts` | `ScriptClip` 新增 `provider?` / `Clip` 新增 `provider?` + `task_id?` / `Influencer` 新增 `kling_element_id?` |
| `src/app/api/webhooks/kling/route.ts` | **扩展 stitchVideo**：自动检测 paper 模式 → PiP合成；所有模式自动烧字幕；字体路径跨平台探测 |
| `supabase/migrations/002_multi_provider_clips.sql` | `clips.provider` / `clips.task_id` / `jobs.metadata` / `influencers.kling_element_id` |

---

### 1. Edu Hub 架构（4 个子类型）

```
/studio/edu  ← Hub 页面
  ├── /talk       🎙️ 口播科普    15积分  violet  有角色台词 → Kling
  ├── /animated   🎨 动画科普故事 30积分  amber   有角色台词 → Kling
  ├── /cinematic  🎬 全动画科普  20积分  emerald 无角色 → Kling text2video → 未来 Seedance
  └── /paper      📄 论文解读    40积分  sky     有角色PiP → Kling + Napkin分镜图
```

全部 jobs 写入 `type: 'edu'`，通过 `jobs.title` 前缀区分，`jobs.metadata.sub_type` 区分处理逻辑。

---

### 2. 多 Provider 路由

**clip 路由决策树**：
```
ScriptClip.provider 显式设置？
  ✓ → 用指定 provider
  ✗ → 有 dialogue？ → 'kling'（角色锚定）
       否 → 'seedance'（纯场景，API待发布时启用）
```

**各模式 forceKling**：`talk` / `animated` / `paper` 均使用 `annotateProviders(clips, { forceKling: true })`，因为角色出现在每一帧。

**cinematic 模式**：`provider: 'seedance'`，当前回退 Kling text2video，Seedance API 上线后直接切换。

**分组逻辑**：`groupClipsByProvider()` 保证同一 batch 内 provider 相同，且遵守各 provider 的 shot/duration 限制。

---

### 3. Webhook 自动后期（stitchVideo 扩展）

| 检测条件 | 处理 |
|---------|------|
| `job.metadata.sub_type === 'paper'` | 每段：Napkin 分镜图全屏背景 + 角色 PiP 右下角（28%宽）+ 底部字幕 |
| 普通 edu/talk/animated | 每段烧录字幕（dialogue文本）|
| 无字体可用 | 优雅降级，跳过字幕但视频正常完成 |
| 只有1段处理后视频 | 跳过 concat，直接上传 |

**字体探测顺序**（macOS + Linux/Vercel）：
```
/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf
/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf
/Library/Fonts/Arial.ttf
/System/Library/Fonts/Supplemental/Arial.ttf
/System/Library/Fonts/Helvetica.ttc
```

---

### 4. Kling text2video（全动画）

- `submitText2Video()` → `POST /v1/videos/text2video`（无需参考图）
- `getTaskStatus()` 先查 `image2video` 端点，无结果回退 `text2video` 端点
- cinematic route：1:1 映射（每个 ScriptClip = 1个 text2video 任务），不分组
- 未来 Seedance 可直接替换 `submitText2Video()` 调用

---

### 5. Napkin AI 分镜图

- `POST /v1/diagrams` → 提交（返回 job_id）
- `GET /v1/diagrams/{id}` → 轮询（2s 间隔，最长 2 分钟）
- `generateDiagramsForKeyPoints()` → 并行为所有知识点生成，失败返回空数组（非阻断）
- 图片 URL 存入 `job.metadata.diagram_urls`，webhook 在 PiP 合成时读取

---

### 测试优先级

| 优先级 | 功能 | 前提 |
|--------|------|------|
| 🔴 必须先做 | 跑 `002_multi_provider_clips.sql` 迁移 | Supabase SQL Editor |
| ✅ 可立即测 | `/studio/edu/talk` 全流程 | ngrok + Kling 额度 |
| ✅ 可立即测 | `/studio/edu/animated` 全流程 | 同上 |
| ⚠️ 需验证 | `/studio/edu/cinematic` text2video 端点 | 看 clips 是否拿到 task_id |
| ⚠️ 需先验证 Napkin | `/studio/edu/paper` 论文解读 | curl 测 `POST /v1/diagrams` |

---

### 待完成（下一轮）

- [ ] Seedance API 集成（等 Volcengine/ByteDance 发布 REST API）
- [ ] Napkin API 端点验证（实际路径可能不同，需按返回 JSON 调整 `lib/napkin.ts`）
- [ ] cinematic text2video webhook 状态追踪验证
- [ ] 字幕 CJK 字体支持（Vercel 环境需额外字体包）
- [ ] Clip 重试机制（`retry_count` 字段，最多 2 次）

---

## ✅ Round 12（2026-02-19）— 运镜 + Provider路由 + Subject Library + 剧集系列 + 论文解读

### 新增/修改文件

| 文件 | 作用 |
|------|------|
| `src/lib/video-router.ts` | Provider 路由层：Kling quota 错误识别、provider 封锁/解封、`classifyKlingResponse()` 统一分类 |
| `src/lib/seedance.ts` | Seedance 2.0 客户端存根（API 未发布，含 TODO + 回退逻辑） |
| `src/lib/video-utils.ts` | `groupClipsByProvider()` + `annotateProviders()` + `resolveClipProvider()`：多 Provider 分组路由 |
| `src/app/api/jobs/recover/route.ts` | Job 恢复路由：每 10 分钟重试卡在 submitted 的 clips（Supabase Cron 触发）|
| `src/app/api/admin/influencers/sync-subjects/route.ts` | 影人批量注册 Kling Subject Library，写回 `element_id` |
| `src/app/api/studio/edu/paper/route.ts` | 论文解读提交路由：arXiv/PDF → Napkin 分镜图 → 影人 PiP 视频 |
| `src/app/api/studio/edu/paper/script/route.ts` | 论文解读脚本生成 |
| `src/app/api/studio/edu/paper/diagrams/route.ts` | Napkin AI 分镜图生成 |
| `src/app/api/studio/series/route.ts` | 剧集系列元数据持久化 |
| `src/lib/napkin.ts` | Napkin AI 客户端（自动生成可视化概念图）|
| `src/__tests__/video-router.test.ts` | 21 个单元测试（全部通过）|
| `supabase/migrations/001_add_series_columns.sql` | series/episode/cliffhanger 字段 |
| `supabase/migrations/002_multi_provider_clips.sql` | provider/task_id on clips, metadata on jobs, index |

---

### 1. 运镜词汇体系（Gemini Prompt 升级）

**景别（12 个）**：极特写 / 特写 / 中近景 / 中景 / 中远景 / 全景 / 大远景 / 俯拍 / 仰拍 / 鸟瞰 / 过肩 / 第一视角

**运镜（17 个，含可灵官方大师运镜）**：固定 / 慢推 / 急推 / 拉远 / 左摇 / 右摇 / 上摇 / 下摇 / 横移 / 环绕 / 跟随 / 上升 / 下降 / 左旋推进 / 右旋推进 / 变焦 / 手持

**shot_description 公式**：`[景别] + [运镜] + [主体动作] + [场景环境] + [光影色调]`

`buildClipPrompt` 自动将 `shot_type` + `camera_movement` 拼入 Kling prompt：
```
[特写, 慢推] Medium close-up, slow dolly in, host facing camera...
```

已升级：`podcast/script` / `anime/script` / `story/script` / `storyboard`

---

### 2. 开场钩子系统（HOOK_PROMPT）

| Job 类型 | 钩子 | 说明 |
|----------|------|------|
| **Story / Anime** | midaction / curiosity / confession / visual / silence | 叙事类，戏剧冲突驱动 |
| **Podcast** | bold_claim / question / story / stat / contrast | 信息类，认知驱动 |

前端传 `hookType` 字段到 script 生成接口，Gemini 按对应钩子模板构建第一幕。

---

### 3. Provider 路由层 + 静默失败修复（P0）

**改前**：Kling 返回错误时，clip 永远卡在 `pending`/`submitted`。

**改后**：`classifyKlingResponse()` 统一处理 → 无 taskId 时 `failClipAndCheckJob()` 立即终结。已修复 8 条路由（podcast / script / link / anime / story / remix / edu/talk / edu/animated）。

**Provider 路由逻辑**：
```
有角色台词 → resolveClipProvider() → 'kling'（角色锚定）
纯场景/B-roll → 'seedance'（Seedance API 上线后启用）
annotateProviders(clips, { forceKling: true })  ← edu/talk, edu/animated
```

**3 套 SOP 状态**：
- 全 Kling：当前线上运行
- 全 Seedance：`getActiveProvider()` 改权重即可
- 混合模式：`resolveClipProvider()` 已就绪，等 Seedance API

---

### 4. Kling 3.0 Subject Library

- `createSubject(name, imageUrls)` → `POST /v1/general/advanced-custom-elements` → `element_id`
- `submitOmniVideo()` → `kling-v3-omni` 模型，支持 `voice_list` 内联语音（免去 lip-sync 步骤）
- `buildClipPrompt` 优先用 `influencer.kling_element_id`，无则回退 `frontal_image_url`
- `POST /api/admin/influencers/sync-subjects`：批量注册所有影人，结果写回 DB

---

### 5. 跨分镜视觉一致性（consistency_anchor）

`ScriptClip.consistency_anchor`：一句话锁定角色外观 + 场景 + 光线，跨幕保持完全一致描述，避免 Kling 多次调用间视觉漂移。

格式：`"Jake穿黑色夹克、三日胡须，坐在卡车驾驶座，深夜高速公路冷蓝色月光"`

- Gemini story/script 生成时自动产生 `consistency_anchor`
- story/route 将其注入每个 shot 的 Kling prompt
- story-wizard 提供可编辑的 anchor 文本区域

---

### 6. Job 恢复 & 超时保护

`POST /api/jobs/recover`（Supabase Cron `*/10 * * * *`）：
- 查找 `status=submitted AND updated_at < now()-30min` 的卡住 clips
- 对每个 clip 重发 webhook，触发完整状态更新流程
- 用 `x-recover-secret` header 鉴权

---

### 7. Story 剧集系列模式

- `seriesMode / seriesName / episodeNumber / cliffhanger` 字段
- `castRoles`：为每位影人指定角色名，注入 Gemini 描述
- `series-panel.tsx`：续集规划面板（上一集 cliffhanger → 下一集承接）
- `StoryWizardHandle.jumpToSeries(name, episode)` imperative handle

---

### 8. 论文解读（edu/paper）

arXiv 链接 / PDF → Napkin AI 自动生成分镜概念图 → 影人 PiP 画中画解读视频

流程：`paper/script` (Gemini 解析) → `paper/diagrams` (Napkin AI) → `paper` (Kling 视频提交)

---

### 基础设施（已配置）

- DB migration 001 + 002 已跑
- Supabase Cron 每 10 分钟触发 recover 路由
- `POST /api/admin/influencers/sync-subjects` 可随时调用注册影人

### 待完成（下一轮）

- [ ] Seedance API 集成（等 Volcengine/ByteDance 发布 REST API）
- [ ] Clip 重试机制（`retry_count` 字段，最多 2 次）
- [ ] `lipsync_url` 字段废弃（始终等于 `video_url`，可清理）

---

## ✅ Round 11（2026-02-19）— 架构重构

### 新增文件
| 文件 | 作用 |
|------|------|
| `src/lib/config.ts` | 积分费用 & 套餐单一数据源，所有路由从此处导入 |
| `src/lib/api-response.ts` | 统一 `apiError()` 响应格式，消除各路由 JSON 格式不一致 |
| `src/lib/job-service.ts` | 服务层：`deductCredits()` / `createClipRecords()`，提取重复业务逻辑 |
| `src/lib/logger.ts` | 结构化日志：开发彩色输出，生产单行 JSON（适配日志聚合） |
| `src/lib/video-utils.ts` | `groupClips()` 纯函数：Kling multi-shot 分组（≤6 shots / ≤15s） |
| `src/app/api/jobs/[id]/stream/route.ts` | SSE 推送 job+clips 状态，每 3s 一次，完成/失败自动关闭 |
| `src/app/api/jobs/stream/route.ts` | SSE 推送活跃任务列表，每 4s 一次，列表清空自动关闭 |
| `vitest.config.ts` | Vitest 测试框架配置（支持 `@/*` 路径别名） |
| `src/__tests__/` | 32 个单元测试（config / api-response / job-service / video-utils / retry） |

### 改动路由（11 个）
所有 studio/credits/influencers 路由统一使用 `config.ts` 积分常量、`apiError()` 错误格式、`deductCredits()` 服务层；`script`/`podcast`/`link` 路由补加了必填字段校验。

### 前端实时化
- `jobs/[id]/page.tsx`：`setInterval(10s 轮询)` → `EventSource` SSE
- `jobs/page.tsx`：`setInterval(8s 轮询)` → `EventSource` SSE

### Kling 重试机制
`src/lib/kling.ts` 新增 `withRetry`：指数退避，最多 3 次，延迟 1s/2s/4s，网络级异常才触发重试，业务错误直接透传。

### 测试覆盖
```
src/__tests__/config.test.ts        8 tests  — 积分常量、套餐完整性
src/__tests__/api-response.test.ts  4 tests  — 错误格式
src/__tests__/job-service.test.ts   7 tests  — deductCredits / createClipRecords
src/__tests__/video-utils.test.ts   8 tests  — groupClips 边界条件
src/__tests__/retry.test.ts         5 tests  — withRetry 行为
总计：32 tests，全部通过
```

---

## ✅ 已完成进度（2026-02-18 更新）

### Round 10（2026-02-18）
- ✅ `/home` 工作台 Dashboard：任务进度（步骤点动画）+ 最近6条作品 grid，两个板块常驻显示
- ✅ `/jobs` 任务管理：只显示进行中任务，步骤进度点（等待→脚本→生成→口型→合成），8秒刷新
- ✅ `/works` 历史作品（新页面）：类型筛选 tab（全部/播客/二创/科普/动漫/故事）+ 时间倒序 + 编辑标题（inline）+ 删除
- ✅ 导航重构：工作台→网红管理→内容创作→任务管理→历史作品（积分移至侧边栏底部）
- ✅ 内容创作 `/studio` 三区块：看灵感 / 爆款二创 / 内容原创（script/link 从顶级入口移除）
- ✅ API：`PATCH /api/jobs/[id]`（改标题）、`DELETE /api/jobs/[id]`（删除作品）
- ✅ 全中英文双语（所有新页面均支持语言切换）

### Round 9（2026-02-18）
- ✅ `/home` 工作台首次创建，`/` 登录后重定向到 `/home`
- ✅ 侧边栏导航更新（我的作品→工作台，新增任务管理/历史作品）
- ✅ i18n 新增 `jobs` / `works` 导航标签

### Round 8（2026-02-18）
- ✅ 14 个网红形象图片全部上传 R2（boto3 脚本），DB `frontal_image_url` 逐一更新
- ✅ `next.config.ts` 补充 `*.r2.dev` remotePattern，next/image 正确加载 R2 公开 URL
- ✅ 网红库按类型分组展示（真人/动物/虚拟角色/品牌IP）+ 类型筛选 tab
- ✅ 小花（Xiaohua）/ Zane 修正为用户创建（is_builtin=false）

### Round 7（2026-02-18）
- ✅ Google OAuth 配置完成（Google Cloud Console + Supabase Provider 已开启）
- ✅ Podcast import 模式：URL（Jina AI Reader）/ PDF（Gemini Files API）→ Gemini 拆出 10-15 个核心观点 → 用户勾选 → 生成播客
- ✅ 根页面无限重定向 bug 修复
- ✅ 所有 wizard 双语完成（edu/remix/anime/story/script/link）
- ✅ GEMINI_API_KEY 加入 `.env.local`
- 新增 API 路由：`POST /api/studio/podcast/extract`（URL/PDF → 观点提炼）

### 待完成
| 优先级 | 任务 |
|--------|------|
| 🔴 | ngrok + Kling webhook 端到端测试 |
| 🔴 | stitchVideo 实际部署（需服务器有 ffmpeg） |
| 🟡 | credits 页双语 |
| 🟡 | Stripe 配置（STRIPE_PUBLISHABLE_KEY 还空着） |
| 🟡 | Railway 部署 |
| ⬜ | JINA_API_KEY 申请（免费，不填也能跑） |

---

### 前端页面（全部完成）
| 路由 | 文件 | 状态 |
|------|------|------|
| `/login` | `(auth)/login/page.tsx` | ✅ 含Google SSO |
| `/register` | `(auth)/register/page.tsx` | ✅ 含Google SSO |
| `/home` | `(app)/home/page.tsx` | ✅ 工作台（任务进度+最近作品） |
| `/influencers` | `(app)/influencers/page.tsx` + `create-wizard.tsx` | ✅ 分类筛选+分组展示 |
| `/studio` | `(app)/studio/page.tsx` | ✅ 三区块（看灵感/爆款二创/内容原创） |
| `/studio/trending` | `trending-client.tsx` | ✅ |
| `/studio/podcast` | `podcast-wizard.tsx` | ✅ 5步向导+import模式 |
| `/studio/remix` | `remix-wizard.tsx` | ✅ 4步向导 |
| `/studio/edu` | `edu-wizard.tsx` | ✅ 5步向导 |
| `/studio/anime` | `anime-wizard.tsx` | ✅ 5步向导 |
| `/studio/story` | `story-wizard.tsx` | ✅ 5步向导 |
| `/jobs` | `jobs/page.tsx` | ✅ 进行中任务+步骤进度点 |
| `/jobs/[id]` | `jobs/[id]/page.tsx` | ✅ 进度条+视频预览 |
| `/works` | `(app)/works/page.tsx` | ✅ 历史作品（筛选+编辑+删除） |
| `/credits` | `credits/page.tsx` + `credits-client.tsx` | ✅ 含Stripe |

### API 路由（全部完成）
| API | 描述 |
|-----|------|
| `POST /api/studio/podcast` | 播客生成（20积分） |
| `POST /api/studio/podcast/keypoints` | AI提炼要点 |
| `POST /api/studio/podcast/extract` | URL/PDF → Jina/Gemini → 核心观点列表 |
| `POST /api/studio/podcast/script` | AI生成脚本（也被edu复用） |
| `POST /api/studio/remix` | 爆款二创（5积分） |
| `POST /api/studio/edu` | 网红科普（15积分） |
| `POST /api/studio/anime` | 动漫营销（50积分） |
| `POST /api/studio/anime/script` | 动漫脚本生成 |
| `POST /api/studio/story` | 故事短片（30积分） |
| `POST /api/studio/story/script` | 故事脚本生成 |
| `POST /api/credits/checkout` | Stripe Checkout |
| `POST /api/webhooks/stripe` | Stripe支付回调 |
| `POST /api/webhooks/kling` | 可灵视频回调 |
| `GET /api/jobs` | 任务列表 |
| `GET /api/jobs/[id]` | 任务详情+切片 |
| `PATCH /api/jobs/[id]` | 更新标题 |
| `DELETE /api/jobs/[id]` | 删除作品 |
| `GET/POST /api/influencers` | 网红CRUD |

### 数据库
- schema.sql 新增 `add_credits()` 函数（Stripe充值用）
- schema.sql `job_type` enum 新增 `story`

### 依赖
- `date-fns ^3.6.0` 已添加并安装

### Round 5（2026-02-18）
- ✅ ngrok 安装并配置（token: `39p7etItcmzdRwTwBkwmA3CA0Iw_5AMkCdDG2k9vVR9zXa89M`）
- ✅ ngrok 隧道启动：`https://greenfly-catchable-rebekah.ngrok-free.dev`
- ✅ `.env.local` 更新 `NEXT_PUBLIC_APP_URL` 为 ngrok URL
- ✅ dev server 重启，Kling webhook 回调地址已生效
- ngrok binary 位于 `/tmp/ngrok-bin/ngrok`（重启机器后需重新启动）
- **重启 ngrok 命令**：`/tmp/ngrok-bin/ngrok http 3000`（URL 会变，需重新更新 .env.local）

---

### Round 4 补丁（2026-02-18）

#### 播客向导 bug 修复
- **🐛 `generateKeypoints()` 末尾有 `setStep(2)`** → 用户看不到要点就被跳走，已删除
- **🐛 `generateScript()` 末尾有 `setStep(4)`** → 用户看不到脚本就被跳走，已删除
- 修复后5步流程正确：选话题 → **看要点确认** → 节目设置 → **看脚本编辑** → 确认生成

#### 对话播客网红图 bug 修复
- **🐛 所有切片都用 `influencer_ids[0]` 的脸**（对话B的台词也用A的图）
- 修复：`slugMap[clip.speaker] ?? infMap[influencer_ids[0]]`，根据脚本 `speaker` slug 选正确网红

#### 多余 deduct_credits 调用
- **🐛 第二次 `deduct_credits(amount=0)` 会插入一条0元流水** → 已删除

#### 热点数据真实化
- `src/data/trending-cache.json` 写入今日 TrendRadar 真实热点（255条原始，提炼为5分类各5条，含播客视角）
- `/api/trending/route.ts` 重写：读缓存文件，缓存不存在时后台触发 Python 刷新脚本
- `scripts/update-trending.py` 新建：TrendRadar 爬虫 + 关键词分类 + Gemini 批量生成 angle → 写 cache

#### 其他
- `api/studio/remix/route.ts` TS 类型修复（`Record<string, string>` 索引）
- TS 编译零错误

---

### Round 3 更新（2026-02-18）
- ✅ Supabase schema.sql 执行完毕（5张表 + RLS + 触发器 + add_credits函数）
- ✅ 12个内置网红种子数据写入 Supabase（`scripts/seed-influencers.ts` 已运行）
- ✅ 所有 Keychain secrets 配置完毕（KLING/GEMINI/R2/SUPABASE_SERVICE_ROLE）
- ✅ dev server 已在 http://localhost:3000 运行

---

### Round 2 补丁（2026-02-18）
- 所有新路由（remix/edu/anime/story）重构为使用 `@/lib/kling` 的 `submitSimpleVideo`（消除重复代码）
- `lib/kling.ts` 新增 `submitSimpleVideo(params)` 函数
- webhook 简化：`generate_audio:true` 已包含口型同步，所有 clip 直接标记 done（去掉 lipsync 阻塞状态）
- jobs/[id] 页面：完成时展示所有切片独立下载，不再仅展示第一个 clip
- Stripe API version 修正为 `2026-01-28.clover`
- dev.sh 取消注释 Stripe keys（已备用）
- 修复 `lib/language.ts` 的 PLATFORMS 加了 `icon` 字段
- 各 wizard 统一使用 `p.value`/`p.label`/`p.aspectRatio`/`p.icon` 字段名
- sidebar 新增移动端底部导航栏（桌面隐藏，手机显示）
- app layout 手机端底部加 padding-bottom 防被底栏遮挡
- `credits-client.tsx` 开发模式加"快速充值+200"按钮（无需Stripe）
- `POST /api/credits/add` 新增（开发用手动充值）
- `create-wizard.tsx` 新增 `editInfluencer` prop — 支持编辑现有网红（跳过类型选择、PUT请求）
- `influencers/page.tsx` 修复：editTarget 现在正确打开编辑弹窗
- lib/kling.ts 新增 `submitSimpleVideo()` 函数
- webhook 简化 lipsync 逻辑（直接 done，不再阻塞）
- jobs/[id] 完成时展示所有切片独立下载

---

## 📋 待用户填写/配置的内容（回来后看这里）

### 🔴 必须完成（否则无法启动）

1. **Supabase 项目** ✅ DONE
   - ✅ `.env.local` 已填写 Supabase URL + anon key
   - ✅ `supabase/schema.sql` 已执行
   - ✅ `SUPABASE_SERVICE_ROLE_KEY` 已存入 Keychain

2. **dev.sh 环境加载脚本** ✅ DONE
   - ✅ 所有 secret 均已存入 Keychain（KLING/GEMINI/R2/SUPABASE）

3. **运行种子数据** ✅ DONE
   - ✅ 已运行：12个内置网红写入 Supabase

4. **ngrok（端到端测试必须）** — 🔴 待配置
   - Kling 生成完成后回调 `NEXT_PUBLIC_APP_URL/api/webhooks/kling`，本地地址打不通
   - 步骤：
     ```bash
     ngrok http 3000
     # 拿到 https://xxxx.ngrok-free.app
     # 修改 .env.local：NEXT_PUBLIC_APP_URL=https://xxxx.ngrok-free.app
     kill 61257  # 杀旧 dev server
     source dev.sh  # 重启（带 ngrok URL）
     ```
   - 注意：每次重启 ngrok 地址会变，需要更新 .env.local

5. **Supabase Google OAuth** — ✅ 已完成
   - Google Cloud Console 项目：dreamlab-487811
   - 授权 JS 来源：localhost:3000 + ngrok URL
   - 回调 URL：https://sygylcdxubqgswnzapku.supabase.co/auth/v1/callback

### 🟡 功能完善（可后续做）

5. **Stripe 配置**
   - https://dashboard.stripe.com 创建 API Key
   - `.env.local` 填写：
     ```
     STRIPE_SECRET_KEY=sk_live_...
     STRIPE_WEBHOOK_SECRET=whsec_...
     NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
     ```
   - 创建 Webhook: `https://你的域名/api/webhooks/stripe` → 监听 `checkout.session.completed`

6. **Kling AI 激活**
   - 登录 KIE.ai 控制台，激活 Seedance 1.5 Pro（即 kling-v2-6）
   - 确认 API 额度充足

7. **应用域名**
   - `.env.local` 填写 `NEXT_PUBLIC_APP_URL=https://你的域名`（Webhook回调需要）
   - 开发期间用 `ngrok` 暴露本地：`ngrok http 3000`，然后填 ngrok URL

8. **TrendRadar 热点数据**（中文热点）
   - 当前 `/api/trending` 返回 mock 数据
   - 待接入 TrendRadar MCP 的实际 HTTP API

9. **视频拼接服务**（非常重要）
   - 当前 `stitchVideo()` 是 stub，需要部署 Python moviepy 服务
   - 或者先用 ffmpeg 实现：`ffmpeg -f concat -i list.txt -c copy output.mp4`
   - 参考文件：`src/app/api/webhooks/kling/route.ts`

10. **Replicate 非人类口型**（动物/虚拟IP用）
    - 去 https://replicate.com 充值
    - 接入 `kwaivgi/kling-lip-sync` 模型（$0.15/clip）
    - 当前已跳过，不阻塞主流程

### 🔵 日后优化

11. 加速：把 `kling-v2-6` 升级到 `kling-v3`（画质更好）
12. 发布管理：接入抖音/TikTok 发布 API
13. 数据分析：播放量、完播率等数据回流
14. 批量生成：一次生成多个变体

---

---

## 📌 项目定位

**一句话描述**: AI红网工厂 - 帮品牌方/MCN公司自动化生产社媒内容

**目标用户**:
- 品牌方市场部
- MCN公司
- 广告投流团队

**核心价值**:
- 自己捏网红（AI虚拟IP）
- 生成不同类型的社媒视频
- 实现选题→制作→发布全流程自动化

---

## 🏗️ 产品架构

```
AI红网工厂
│
├── 🌟 核心资产
│   └── 网红管理（创建/管理AI虚拟IP形象）
│
├── 🎬 内容工厂（6个生产线）
│   ├── 看灵感          输入：无         → 输出：选题灵感
│   ├── 爆款二创        输入：原视频      → 输出：改编视频
│   ├── 视频播客        输入：选题+网红x2 → 输出：播客视频     「解说万物的播客频道」
│   ├── 动漫营销视频    输入：产品+网红   → 输出：营销视频
│   ├── 网红科普        输入：话题+网红   → 输出：科普视频
│   └── （待扩展）
│
├── 💰 商业系统
│   ├── 注册/登录
│   ├── 购买Credit
│   └── Credit消耗记录
│
└── 📊 数据中心（未来）
    ├── 发布管理
    └── 数据分析
```

**网红与内容的关系**:
```
视频播客        ←─┐
动漫营销视频    ←─┤── 从【网红管理】选 OR 直接上传参考图
网红科普        ←─┘
```

---

## 🎭 网红管理 - 核心功能设计

### 网红类型（第一步选择）

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│     🧑      │  │     🐾      │  │     🎭      │  │     🏷️      │
│  真人网红   │  │  动物网红   │  │  虚拟角色   │  │   品牌IP    │
│             │  │             │  │             │  │             │
│ 李佳琦、    │  │ 小花大黄、  │  │ 洛天依、    │  │ 天猫的猫、  │
│ 普通美妆    │  │ 会说话的    │  │ 原创AI      │  │ 瑞幸鹿角怪、│
│ 博主        │  │ 柴犬        │  │ 女友"小雪"  │  │ 品牌吉祥物  │
└─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘
```

**设计决策**：选完类型后，后面的字段动态变化

---

### 网红属性体系（完整版）

#### 👁️ 视觉层
| 字段 | 类型 | 必填 | 备注 |
|------|------|------|------|
| 参考图 | 上传1-3张 | ✅ | 或AI生成 |
| 性别 | 选择 | ✅ | 真人/虚拟必填，动物可选 |
| 年龄感 | 选择 | 真人必填 | 00后/90后/成熟/中年 |
| 品种 | 文字 | 动物必填 | 柴犬/英短/etc |
| 脸型标签 | 多选 | 选填 | 甜美/御姐/邻家/帅气/萌系 |
| 内容风格 | 选择 | ✅ | 写实/动漫/3D/插画 |
| 表情包 | 上传x5 | 选填 | 开心/惊讶/思考/不屑/赞同 |
| 服装变体 | 上传x3 | 选填 | 同人不同穿搭 |

#### 🎤 声音层
| 字段 | 类型 | 必填 | 备注 |
|------|------|------|------|
| 声线类型 | 选择 | ✅ | 预设5-6种（参考网红档案） |
| 语速 | 滑块 | ✅ | 快/中/慢 |
| 口头禅 | 文字 | 选填 | 最多3个 |
| 对谈风格 | 选择 | 选填 | 主导型/配合型/争论型 |
| `voice_prompt` | 文字（内部字段） | ✅ | 描述声线特征的英文短句，生成时注入 Kling prompt，决定 native audio 的声线风格。用户不直接填写，由选择声线类型后自动映射。台词（DIALOGUE）不在档案中，由视频生成流程动态产出。 |

#### 🧠 人格层
| 字段 | 类型 | 必填 | 备注 |
|------|------|------|------|
| 名字 | 文字 | ✅ | |
| 一句话介绍 | 文字 | ✅ | 50字内 |
| 性格标签 | 多选 | ✅ | 最多3个 |
| 背景故事 | 长文 | 选填 | AI辅助生成 |
| 禁区设置 | 文字 | 选填 | 不能说的话/不接的广告 |

#### 📚 内容层
| 字段 | 类型 | 必填 | 备注 |
|------|------|------|------|
| 主领域 | 多选 | ✅ | 最多3个 |
| 专业深度 | 选择 | ✅ | 入门/进阶/专家 |
| 目标受众年龄 | 选择 | 选填 | |
| 平台偏好 | 多选 | 选填 | 小红书/抖音/B站/微博 |

#### 🏷️ 品牌层（仅品牌IP）
| 字段 | 类型 | 必填 | 备注 |
|------|------|------|------|
| 品牌名称 | 文字 | ✅ | |
| 品牌色 | 颜色选择器 | ✅ | |
| 品牌调性 | 文字 | ✅ | |
| 禁忌内容 | 文字 | ✅ | |

---

### MVP 最简字段（快速上线用）

**必填（不填无法生成内容）**：
- 名字
- 类型（真人/动物/虚拟角色/品牌IP）
- 参考图（1张）
- 一句话人设
- 主领域（1-3个）
- 性格标签（最多3个）
- 声线（预设选择）

**选填（影响内容质量）**：
- 背景故事
- 口头禅
- 对谈风格
- 禁区设置

**后期迭代**：
- 声音克隆（上传真实录音）
- 动作参考视频
- 商业标签体系

---

## 💰 Credit 消耗体系

### 网红创建
| 操作 | 积分 | 说明 |
|------|------|------|
| 第1个网红 | 免费 | 含1次图片生成 + 1次TTS |
| 第2个起 | 10积分 | 含1次图片生成 + 1次TTS，对外说"创建一个网红=10积分"，不提手续费 |
| 重新生成图片 | 3积分/次 | |
| 重新生成TTS | 2积分/次 | |
| 修改文字信息 | 免费 | 随时改，不限次数 |
| 删除网红 | 免费 | 积分不退 |

> **定价原则**：以实际 API 成本为基础，目标毛利 60-70%
> 1积分 ≈ ¥1，图片成本~¥0.3，TTS成本~¥0.02，10积分打包含两者

### 内容生产
| 功能 | 积分 | 备注 |
|------|------|------|
| 看灵感 | 0 | 免费，吸引用户 |
| 爆款二创 | 5积分 | |
| 视频播客 | 20积分 | |
| 网红科普 | 15积分 | |
| 动漫营销视频 | 50积分 | 最贵，Seedance生成 |

---

## 🏗️ 开发进度（2026-02-18 更新）

### ✅ 已完成（lib 层）
- ✅ Next.js 项目初始化（TypeScript + Tailwind + shadcn/ui，13个基础组件）
- ✅ Supabase schema 设计完成（`supabase/schema.sql`，5张表 + RLS + trigger）
- ✅ lib/supabase（browser + server client）
- ✅ lib/kling.ts（JWT + image2video + lip-sync + buildClipPrompt）
- ✅ lib/r2.ts（upload + presigned URL，AWS SDK v3）
- ✅ src/types/index.ts（Influencer / Job / Clip / ScriptClip / Profile）
- ✅ lib/influencers-seed.ts（12个内置网红，含 voice_prompt）
- ✅ dev.sh（从 Keychain 读所有 secret，无明文）

### ✅ 已验证（Python 脚本，非 Next.js）
- ✅ Kling API 打通（std mode，两个15s切片生成成功）
- ✅ R2 上传/读取正常（bucket: dreamlab-assets）
- ✅ Sable 30s demo（moviepy 手动合并，非走 app 流程）
- ⏳ pro mode（任务已提交，结果待查）
- ❌ 非真人 lip sync（待 Replicate 充值后测试）

### ❌ 尚未开始（页面层）
- Supabase 项目未创建（无真实 URL/anon key）
- 无任何页面（page.tsx 还是 Next.js 默认模板）
- 无任何 API routes
- 网红管理页面 = 未开始
- 视频播客页面 = 未开始

---

## 🗄️ Supabase 数据库设计

**文件位置**: `supabase/schema.sql`

### 表结构

| 表 | 说明 | 关键字段 |
|---|---|---|
| `profiles` | 用户扩展（关联 auth.users） | credits, display_name |
| `credit_transactions` | Credit 流水 | amount（正=充值/负=消耗）, reason, job_id |
| `influencers` | 网红档案 | type, voice_prompt, frontal_image_url, is_builtin |
| `jobs` | 内容生产任务 | type（podcast/remix/edu/anime）, status, script（jsonb）, influencer_ids |
| `clips` | 视频切片 | kling_task_id, status, video_url, lipsync_url |

### 关键设计决策
- `profiles.credits` 扣费原子操作（SQL function 确保并发安全）
- `jobs.script` 存 JSON 数组，每个元素是一个 `ScriptClip`（含 dialogue + shot_description，无 voice_id）
- `clips` 不开 RLS，只通过 service_role 访问（Webhook 回调用）
- 新用户注册自动创建 profile + 赠送 20 credit（trigger）

### Job 状态流转
```
pending → scripting → generating → lipsync → stitching → done
                                                        ↘ failed（任意阶段可跳）
```

### Job Type & Credit 消耗
```typescript
type JobType = 'podcast' | 'remix' | 'edu' | 'anime' | 'trending'
```
| type | credit | 说明 |
|------|--------|------|
| podcast | 20 | 视频播客 |
| remix | 5 | 爆款二创 |
| edu | 15 | 网红科普 |
| anime | 50 | 动漫营销（Seedance） |
| trending | 0 | 看灵感，免费 |

### 双语支持
`jobs.language = 'zh' | 'en'`，贯穿脚本生成、voice_prompt、平台选项

---

## 🌐 国际化（i18n）

- **框架**: next-intl（`/zh/...` 和 `/en/...` 路由）
- **内容语言**: `job.language` 决定脚本语言 + 发布平台选项
- **声线**: voice_prompt 支持指定语言（如 `Chinese Mandarin female voice`）
- **平台映射**:
  - `zh`: 抖音 / 小红书 / B站 / 微博
  - `en`: TikTok / YouTube / Instagram

---

## 🛠️ 技术栈

```
前端：V0（Next.js）
后端：本地开发 → Railway部署
视频生成：可灵 Kling 3.0（image2video, lip-sync）
   备用：Replicate（非真人口型：kwaivgi/kling-lip-sync / zsxkib/multitalk）
   备用：Seedance 1.5 Pro（KIE.ai，待激活）
图像生成：Gemini 3 Pro Image Preview（img2img，model: nano-banana-pro-preview）
音频TTS：可灵 voice_ids（首选） / gemini-2.5-flash-preview-tts（备用）
热点数据：TrendRadar（中文，46k⭐，MCP已配置）+ YouTube Data API（英文）
数据库：Supabase / Vercel Postgres
存储：Cloudflare R2（bucket: dreamlab-assets）
视频拼接：moviepy（Python，ffmpeg暂未安装）
```

### API Keys 位置
```
macOS Keychain（account: dreamlab）
↓ 通过 ~/.openclaw/.env 加载（全部 security find-generic-password 查询，无明文）

Keys: ANTHROPIC_API_KEY / GEMINI_API_KEY / BRAVE_API_KEY / YOUTUBE_API_KEY
      KLING_ACCESS_KEY / KLING_SECRET_KEY
      CF_ACCOUNT_ID / R2_BUCKET / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY
      SEEDANCE_API_KEY（KIE.ai）
```

---

## 🔥 热点数据源体系

### 数据来源架构

```
热点话题选题
│
├── 中文热榜（TrendRadar 直接爬取）
│   ├── 微博热搜
│   ├── 抖音热榜
│   ├── 知乎热榜
│   ├── B站热搜
│   ├── 今日头条
│   ├── 百度热搜
│   ├── 澎湃新闻
│   └── 华尔街见闻
│
├── 中文 RSS（TrendRadar 订阅）
│   ├── 36氪（科技创业）
│   ├── 虎嗅（科技商业）
│   ├── 少数派（数码生活）
│   ├── 爱范儿（数码科技）
│   └── 阮一峰博客（技术/周刊）
│
└── 英文 RSS + API
    ├── Hacker News（hnrss.org/frontpage）
    ├── The Verge
    ├── TechCrunch
    ├── Wired
    ├── Product Hunt
    └── YouTube Trending（YouTube Data API）
```

### GitHub 参考项目

| 项目 | Stars | 用途 |
|------|-------|------|
| [RSSHub](https://github.com/DIYgod/RSSHub) | ~41k⭐ | 万能RSS生成器，覆盖微博/B站/知乎/小红书等所有中文平台 |
| [DailyHotApi](https://github.com/imsyy/DailyHotApi) | ~8k⭐ | 中文热榜聚合API（微博/知乎/B站/抖音等），REST + RSS |
| [TrendRadar](https://github.com/sansan0/TrendRadar) | ~43k⭐ | 中文热点监控 + MCP接口 ✅ 已部署 |
| [awesome-rss-feeds](https://github.com/plenaryapp/awesome-rss-feeds) | ~1.9k⭐ | 英文优质RSS源OPML合集（500+源） |
| [ALL-about-RSS](https://github.com/AboutRSS/ALL-about-RSS) | ~5.5k⭐ | RSS生态全景参考 |

### API Keys 存储位置
- 所有 Key 统一存于 `~/.openclaw/.env`
- YouTube Data API Key：已存入（变量名 `YOUTUBE_API_KEY`）
- Gemini API Key：已存入（变量名 `GEMINI_API_KEY`）
- **不在任何文档中明文记录 Key**

---

## ⚙️ TrendRadar MCP 配置

### 安装位置
```
/Users/gd-npc-848/TrendRadar/
```

### 配置状态
- ✅ 已安装（`uv sync` 完成）
- ✅ MCP 已注册到 Claude Code（`~/.claude.json`，user scope）
- ✅ AI 模型：`gemini/gemini-2.0-flash`（key 通过环境变量传入）
- ✅ RSS 源：已配置中英文 10 个源

### 可用 MCP 工具（13个）
| 工具 | 用途 |
|------|------|
| `get_trending_topics` | 获取当前跨平台热点 |
| `get_latest_news` | 拉取最新聚合热点 |
| `search_news` | 关键词搜索新闻 |
| `analyze_topic_trend` | 话题趋势分析 |
| `analyze_sentiment` | 情绪分析 |
| `generate_summary_report` | 生成汇总报告 |
| `trigger_crawl` | 手动触发抓取 |

### Bootstrap 命令
```bash
# 首次运行（初始化数据）
source ~/.openclaw/.env
cd ~/TrendRadar
AI_API_KEY=$GEMINI_API_KEY uv run python main.py

# 之后 MCP 会自动在 Claude Code 启动时加载
```

---

## 📋 MVP 开发优先级

```
Phase 1（核心）：
1. 网红管理 → 创建/编辑/删除网红
2. 视频播客 → 最能展示产品价值

Phase 2（扩展）：
3. 网红科普 → 复用播客逻辑
4. 爆款二创 → 独立功能

Phase 3（完整）：
5. 看灵感
6. 动漫营销视频
7. 支付/Credit系统
8. 发布管理
```

---

## 🎭 网红档案完整版（12个内置 + 2个用户自建示例）

> **内置网红**：免费使用，视频带 Dreamlab 水印
> **用户自建示例**（Xiaohua / Zane）：标「✏ 我的」，可编辑/删除，演示用户自建流程
> ✅ 全部形象图片已生成（nano-banana-pro-preview）
> ✅ 全部TTS声音已生成（gemini-2.5-flash-preview-tts）
> ✅ 中英文展示网页已生成（含试听按钮）：`dreamlab-assets/influencers.html`
>
> **类型分布**：动物类 3人（Sable/Miso/Xiaohua）· 真人类 5人（Quinn/Ellie/Aria/Kai/Zane）· 虚拟角色 4人（Gintoki/Tanjiro/Atlas/Luffy）· 品牌IP 2人（Loopy/雪王）

---

### 🐾 动物类

#### Sable（黑猫）
| 字段 | 内容 |
|------|------|
| 类型 | 🐾 动物网红・黑猫 |
| 视觉 | 黑猫・极简项圈・小金属名牌 |
| 一句话人设 | 看透一切，只说值得说的那句 |
| 性格标签 | 一针见血・冷幽默・零废话 |
| 主领域 | 情感关系・都市生活吐槽 |
| 说话风格 | 有量无废话，主动掌控节奏，冷不丁抛出精准到好笑的分析，靠观察力赢 |
| 口头禅 | "Well." / "Sure." / "Noted." |
| 对谈风格 | 主导型 |
| 禁区设置 | 强制正能量内容・过度热情带货 |
| 声线 | 轻微英式口音・低女声・中偏慢・干燥不带感情波动 |
| 适合视频 | 视频播客・热点吐槽评论・YouTube长评论视频 |
| 搭档 | 🤝 Miso |
| 参考图 | ✅ 已生成 |

#### Miso（柴犬）
| 字段 | 内容 |
|------|------|
| 类型 | 🐾 动物网红・柴犬 |
| 视觉 | 金橘色柴犬 |
| 一句话人设 | 一本正经的金句机器，对小事大惊小怪，自己完全不觉得 |
| 性格标签 | 一本正经・金句体质・大惊小怪 |
| 主领域 | 情感关系・都市生活吐槽 |
| 说话风格 | 话多真诚，突然输出金句，情绪和事件严重程度完全不匹配 |
| 口头禅 | "Wait wait wait—" / "This is serious." / "I've researched this." |
| 对谈风格 | 配合型（偶尔大惊小怪劫持节奏） |
| 禁区设置 | 悲伤黑暗内容・需要严肃的场合 |
| 声线 | 标准美式男声・平时正式・情绪爆发大起伏・零情绪说金句 |
| 适合视频 | 视频播客・反应视频・好物推荐（一本正经版） |
| 搭档 | 🤝 Sable |
| 参考图 | ✅ 已生成 |

#### Xiaohua（三花猫）⭐ 用户自建
| 字段 | 内容 |
|------|------|
| 类型 | 🐾 动物网红・三花猫 |
| 视觉 | 橘白黑三花猫・牛仔外套 |
| 一句话人设 | 街头精灵，花花绿绿，比你更懂市井生活 |
| 性格标签 | 接地气・活泼好奇・知足常乐 |
| 主领域 | 生活vlog・好物分享・萌宠内容 |
| 说话风格 | 天然萌，对新鲜事物永远充满好奇，拍什么都接地气 |
| 口头禅 | "哇哦！" / "真的假的！" |
| 对谈风格 | 配合型・气氛担当 |
| 声线 | 清脆甜美・语速偏快・情绪活泼 |
| 适合视频 | 日常vlog・萌宠短视频・好物开箱 |
| 参考图 | ✅ 已生成（xiaohua_front.png） |
| 备注 | 用户自建示例，可编辑/删除 |

---

### 🧑 真人类

#### Quinn（Be Reliable）
| 字段 | 内容 |
|------|------|
| 类型 | 🧑 真人网红 |
| 视觉 | 真实感・干净利落・不过度打扮 |
| 一句话人设 | 替你把所有该查的都查了，说话像专业朋友而不是教授 |
| 性格标签 | 可信赖・有备而来・不端架子 |
| 主领域 | 健康・消费决策・生活科普 |
| 说话风格 | 温暖有据可查，不卖焦虑，给结论也给原因 |
| 口头禅 | "Here's the thing—" / "I looked this up…" / "Actually—" |
| 对谈风格 | 平衡型（自己话题时主导，别人话题时配合） |
| 禁区设置 | 医疗建议・政治立场・任何可能误导信任她的内容 |
| 声线 | 温暖美式女声・语速中等・亲切感强 |
| 适合视频 | 科普・产品测评・YouTube深度长视频・对谈 |
| 对标账号 | @emonthebrain |
| 参考图 | ✅ 已生成 |

#### Ellie（白女Vlog）
| 字段 | 内容 |
|------|------|
| 类型 | 🧑 真人网红 |
| 视觉 | 阳光明亮・日常aesthetic・轻松真实感 |
| 一句话人设 | 住在你梦里那种普通女生，但每件事都做得很aesthetic |
| 性格标签 | 阳光・真实・生活感强 |
| 主领域 | 日常vlog・好物推荐・生活方式营销 |
| 说话风格 | 像跟闺蜜发语音，随意但有感染力 |
| 口头禅 | "Okay so—" / "Honestly?" / "I can't stop thinking about…" |
| 对谈风格 | 配合型・热情跟随・带动气氛 |
| 禁区设置 | 负面黑暗内容・争议政治话题 |
| 声线 | 明亮美式女声・语速偏快・有笑意 |
| 适合视频 | Vlog・GRWM・营销短视频・好物开箱・YouTube日常长视频 |
| 对标账号 | @alixearle |
| 参考图 | ✅ 已生成 |

#### Aria（短剧女主）
| 字段 | 内容 |
|------|------|
| 类型 | 🧑 真人网红 |
| 视觉 | 电影感・有辨识度・情绪张力强 |
| 一句话人设 | 每个镜头都像电影，情绪来了压不住 |
| 性格标签 | 主角光环・情绪张力・强韧 |
| 主领域 | 短剧・情感内容・品牌形象片 |
| 说话风格 | 平时克制，爆发时有穿透力，台词感强 |
| 口头禅 | "Don't." / "You think I didn't know?" / "Tell me why." |
| 对谈风格 | 主导型・靠情绪压场而非逻辑 |
| 禁区设置 | 搞笑无厘头内容・轻浮场合 |
| 声线 | 有质感女声・情绪范围宽・低沉到激昂都能撑 |
| 适合视频 | 短剧集・竖屏情感剧・品牌故事片・对谈 |
| 对标账号 | ReelShort女主演员风格 |
| 参考图 | ✅ 已生成 |

#### Kai（短剧男主）
| 字段 | 内容 |
|------|------|
| 类型 | 🧑 真人网红 |
| 视觉 | 冷峻帅气・氛围感强・电影质感 |
| 一句话人设 | 冷到你以为他不在乎，开口才知道他全记着 |
| 性格标签 | 冷峻・隐藏情绪・有分量感 |
| 主领域 | 短剧・品牌代言・对谈 |
| 说话风格 | 话少但每句有重量，偶尔一句暖的让人措手不及 |
| 口头禅 | "No." / "Done." / （沉默两秒）"Fine." |
| 对谈风格 | 主导型・话少但定调・最后一句永远是他说 |
| 禁区设置 | 卖萌搞笑内容・过度情绪化场面 |
| 声线 | 低沉男声・语速慢・气声少・有压迫感 |
| 适合视频 | 短剧集・横屏长剧・品牌代言・YouTube剧情长视频 |
| 对标账号 | ReelShort男主演员风格 |
| 参考图 | ✅ 已生成 |

#### Zane（科技男）⭐ 用户自建
| 字段 | 内容 |
|------|------|
| 类型 | 🧑 真人网红 |
| 视觉 | 深色高领毛衣・胡须・科技办公室背景 |
| 一句话人设 | 把最硬核的东西讲到让老妈也听懂 |
| 性格标签 | 理工范・接地气解说・有观点 |
| 主领域 | 科技评测・AI资讯・产品分析 |
| 说话风格 | 技术深度配口语化表达，从不端架子 |
| 口头禅 | "其实很简单—" / "换个角度想—" |
| 对谈风格 | 主导型・用数据和逻辑推进 |
| 禁区设置 | 情绪化内容・玄学话题 |
| 声线 | 沉稳男声・语速适中・自信不炸 |
| 适合视频 | 科技评测・AI播客・YouTube深度解说 |
| 参考图 | ✅ 已生成（zane_front.png） |
| 备注 | 用户自建示例，可编辑/删除 |

---

### 🎭 虚拟角色类

#### Gintoki（摆烂天才）
| 字段 | 内容 |
|------|------|
| 类型 | 🎭 虚拟角色 |
| 视觉风格 | 动漫・金发自然卷・随意装扮 |
| 一句话人设 | 表面摆烂，关键时刻最靠谱的那个 |
| 性格标签 | 懒散・毒舌・关键靠谱 |
| 主领域 | 吐槽・生活・搞笑评论 |
| 说话风格 | 懒洋洋但句句有货，突然爆发时让人震住 |
| 口头禅 | "What a pain." / "Not interested." / "My natural perm—" |
| 对谈风格 | 主导型・用懒散掌控节奏 |
| 禁区设置 | 被说穷・被摸头发・认真工作 |
| 声线 | 慵懒美式男声・低频・偶尔突然爆发 |
| 适合视频 | 视频播客・吐槽短视频・热点评论・YouTube长评 |
| 参考图 | ✅ 已生成 |

#### Tanjiro（热血少年）
| 字段 | 内容 |
|------|------|
| 类型 | 🎭 虚拟角色 |
| 视觉风格 | 动漫・红黑发少年・耳环特征 |
| 一句话人设 | 绝对不放弃，连敌人都能感化 |
| 性格标签 | 善良・不屈・感染力强 |
| 主领域 | 励志・成长・情感 |
| 说话风格 | 极度真诚，容易落泪，说出来的话会让人想努力 |
| 口头禅 | "I won't give up." / "I can smell it." / "I can do it!" |
| 对谈风格 | 配合型・情绪感染全场 |
| 禁区设置 | 放弃・伤害弱者・冷漠对待他人 |
| 声线 | 温暖日系少年感男声・情绪真实・会哽咽 |
| 适合视频 | 励志短剧・感人对谈・成长科普・YouTube励志长视频 |
| 参考图 | ✅ 已生成 |

#### Atlas（猫猫侠旅行者）
| 字段 | 内容 |
|------|------|
| 类型 | 🎭 虚拟角色 |
| 视觉风格 | 皮克斯3D风格・猫猫侠装扮・旅行者背包 |
| 一句话人设 | 走遍世界的猫猫侠探，见过一切还是很萌 |
| 性格标签 | 好奇・勇敢・治愈系 |
| 主领域 | 旅行・探索・生活方式 |
| 说话风格 | 用见过世面的眼光讲普通事，萌系视角让人觉得世界很美 |
| 口头禅 | "I've seen this before… in another world." / "Interesting." |
| 对谈风格 | 平衡型・用见识推进话题 |
| 禁区设置 | 无 |
| 声线 | 明亮好奇感男声・Pixar角色质感・轻快 |
| 适合视频 | 旅行vlog・探索科普・品牌故事片・YouTube旅行长视频 |
| 参考图 | ✅ 已生成 |

#### Luffy（冒险船长）
| 字段 | 内容 |
|------|------|
| 类型 | 🎭 虚拟角色 |
| 视觉风格 | 动漫・草帽・开朗笑容 |
| 一句话人设 | 逻辑不好但天下无敌，朋友比命重要 |
| 性格标签 | 天真・重义・魅力爆棚 |
| 主领域 | 冒险・友情・励志 |
| 说话风格 | 简单直接，不绕弯子，说的话有时候意外地很深刻 |
| 口头禅 | "Let's go!" / "I'll be the King!" / "I'm not interested in things I can't eat." |
| 对谈风格 | 配合型・偶尔一句天真戳中要害 |
| 禁区设置 | 抛弃伙伴・复杂策略讨论・被说弱 |
| 声线 | 高能量美式男声・语速快・充满热情 |
| 适合视频 | 冒险短剧・好物开箱・对谈・YouTube冒险长视频 |
| 参考图 | ✅ 已生成 |

---

### ✨ 品牌IP类

#### Loopy（잔망루피 / Zanmang Loopy）
| 字段 | 内容 |
|------|------|
| 类型 | ✨ 品牌IP |
| 品牌 | ICONIX Entertainment · Pororo 宇宙（韩国） |
| 外观 | 粉色北美河狸，水手领短裙，白色大门牙，深玫瑰色鼻子 |
| 一句话人设 | 从小配角杀成顶流，靠撒泼卖萌成为Z世代情绪出口 |
| 性格标签 | 欠揍感・名场面体质・放飞自我 |
| 主领域 | 搞笑娱乐・情绪共鸣・品牌联名 |
| 说话风格 | 高度情绪化，面部表情夸张翻白眼，永远能制造出圈名场面 |
| 口头禅 | "으아아아—" / "왜요?!" / （撒泼脸） |
| 对谈风格 | 主导型・靠表情和情绪感染 |
| 禁区设置 | 严肃正经内容・需要稳重形象的场合 |
| 声线 | soft cute female voice, gentle and warm, slightly high pitch, cheerful and innocent |
| 适合视频 | 搞笑短视频・反应视频・meme内容・品牌联名 |
| 参考图 | ✅ 已下载（pororo.fandom.com 官方图） |
| 官方 TikTok | @zanmangloopyofficial |

#### 雪王（Snow King）
| 字段 | 内容 |
|------|------|
| 类型 | ✨ 品牌IP |
| 品牌 | 蜜雪冰城 Mixue Ice Cream & Tea（郑州） |
| 外观 | 圆形白色雪人，金色皇冠，红色披风，手持冰淇淋权杖 |
| 生日 | 11月22日 |
| 一句话人设 | 本王赐你甜蜜蜜，你爱我我爱你 |
| 性格标签 | 贱萌・本王驾到・洗脑神曲 |
| 主领域 | 食品饮品・品牌营销・节日内容 |
| 说话风格 | 圆滚滚皇家派头配超萌外表，反差制造笑点，全程洗脑甜蜜攻势 |
| 口头禅 | "你爱我，我爱你，蜜雪冰城甜蜜蜜" / "本王说了算" |
| 对谈风格 | 主导型・靠萌劲儿和洗脑感压场 |
| 禁区设置 | 竞争品牌提及・负面情绪内容 |
| 声线 | deep dramatic male voice, regal and commanding, occasional warm humor, Northern Chinese energy |
| 适合视频 | 品牌推广・节日营销・搞笑短视频・TikTok挑战 |
| 参考图 | ✅ 已下载（百度百科官方图） |

---

## 🗣️ 设计讨论记录

### 2026-02-17

**讨论1：后端方案**
- 用户：前端V0，后端想放本地
- 结论：开发阶段本地，正式上线Railway

**讨论2：网红类型**
- 用户：网红可以不是人吗？
- 结论：4种类型：真人/动物/虚拟角色/品牌IP
- 每种类型选择卡片 + 小字案例说明
- 选完类型后表单字段动态变化

**讨论3：虚拟角色 vs 品牌IP的区别**
- 结论：保留4个分类，加小字案例更直观
- 底层数据结构基本相同

**已确认**：
- [x] 创建网红的完整表单流程（5步：类型→信息→图片→声音→保存）
- [x] 网红管理列表：混合展示内置+用户，视觉区分"官方"/"我的"标签
- [x] 内置网红不可修改，用户自建可编辑/删除
- [x] 新用户进入：内置网红 + 首位"新建"卡片（首个免费）
- [x] 支持"参考内置模版"创建（预填风格，强制差异化：名字和图片必须重新设置）
- [x] 网红数量不限，靠积分控制
- [x] Credit 消耗体系（见上方）
- [x] 编辑体验：卡片展开式，按字段区块独立编辑，不重走流程
  - 基本信息/性格/内容设置 → 展开直接修改，保存免费
  - 重新生成图片 → 3积分/次（按钮明确显示费用）
  - 重新生成TTS → 2积分/次（按钮明确显示费用）

**待讨论**：
- [x] 热点话题数据源体系（✅ 已确认，见「热点数据源体系」章节）
- [ ] 视频播客的交互设计（🔄 进行中 → 热点话题方案已完成，下一步：每步交互细节）
- [ ] 内容生产的用户旅程地图
- [ ] 整体导航结构

---

### 🎙️ 视频播客功能设计（设计中）

**Slogan**：解说万物的播客频道

**输入方式（3条路）**：
| 方式 | 说明 |
|------|------|
| 热点话题 | 平台热帖（TrendRadar/MediaCrawler/YouTube API） |
| 导入内容 | 链接 / PDF / Google Doc / 视频 / 播客 |
| 自己写 | 直接贴脚本或自由输入 |

**生产流程**：
```
选话题 → AI提炼要点（用户确认）→ 节目设置（网红/时长/语言/形式）→ 生成脚本 → 生成视频
```

---

### Step 1：选话题 · 热点话题路径（✅ 已确认）

**语言**：全局设置，不在此步骤选择
- 用户在选题中途想切换语言 → 只提示去全局设置修改，不中断当前流程

**分类 Tab**：
```
中文：[科技]  [时事政治]  [娱乐]  [财经]  [其他]
英文：[科技]  [时事政治]  [娱乐]  [财经]  [其他]
```
> 财经 = 股市/交易/宏观经济
> 其他 = 兜底分类
> 英文娱乐源：Variety / Hollywood Reporter / Deadline / Rolling Stone

**每类展示**：5条

**卡片信息**：
```
┌─────────────────────────────────┐
│ 标题                             │
│ 一句话解说角度                    │
│ 来源媒体  ·  日期                 │
└─────────────────────────────────┘
```
不显示热度数字

**选题方式**：多选，上限2条，选满后其他卡片变灰
- 选1条 → 单话题播客
- 选2条 → AI合并成一期（先找连接角度，再合并提炼要点）

---

### Step 2：AI提炼要点 & 确认（✅ 已确认）

```
选1条 → 直接提炼6-8个要点
选2条 → AI找连接角度 → 展示"本期视角"（可点"换个角度"）→ 提炼合并要点
```

**确认界面**：
```
本期视角：……（双话题时显示）

☑  要点1
☑  要点2
☐  要点3
☑  要点4
☐  要点5
☑  要点6

已选 N 条    [+ 补充一条]    [重新生成]
                        [确认，进入节目设置 →]
```
- AI生成6-8条，用户勾选（主路径）
- 可手动补充1条
- 可拖拽调整勾选项顺序
- 上限：最多选6条

---

### Step 3：节目设置（✅ 已确认）

**设置顺序**（有依赖关系，按此顺序展示）：

**① 节目类型**
```
[单口]  [对谈]
```

**② 发布平台**（单选，影响时长建议和画面比例）
```
[抖音]  [小红书]  [B站]  [YouTube]  [微博]
```

**③ 时长**（根据平台自动建议，用户可改）
```
抖音 → 建议1-3分钟
B站/YouTube → 建议8-15分钟

[1分钟]  [3分钟]  [5分钟]  [10分钟]  [自定义]
```

**④ 参考账号**（选填，最多1个）
```
贴入账号链接或 @handle
AI分析：节奏 / 段落结构 / 字幕风格 / 开场方式
技术：video-remix-analyzer skill 改造
```

**⑤ 选网红**
```
推荐（置顶，根据话题+平台自动推荐）：
[Sable]  [Miso]

全部网红（内置13个 + 用户自建）：
[Quinn]  [Ellie]  [Aria]  [Kai]  [Gintoki] ...

单口 → 选1个；对谈 → 选2个
选超出数量 → 提示"单口只能选1位 / 对谈最多2位"
不选 → 使用默认（单口=Quinn，对谈=Sable+Miso）
```

脚本生成依据：话题 + 要点 + 节目类型 + 网红{说话风格/口头禅/对谈风格/性格标签}

---

### Step 4：脚本生成（✅ 已确认）

AI 根据以下材料生成完整分镜脚本：
- 话题 + 勾选要点
- 节目类型（单口/对谈）
- 网红{说话风格 / 口头禅 / 对谈风格 / 性格标签}
- 参考账号风格（若有）

**脚本格式**：带时间轴，按15秒一个切片分段
每个切片包含：台词 + 画面描述 + 镜头类型（来自分镜语言库）

**用户操作**：可编辑每个切片台词，不可跳过（影响后续生成）

---

### Step 5：视频生成（✅ 已确认，流程已跑通）

**声音策略**：声音和画面**一次生成**，通过 `voice_prompt`（网红档案中的声线文字描述）注入 Kling prompt，开启 `generate_audio: true`，无需上传音频、无需后期合并

```
脚本（N个切片，每切片含：台词文本 + 画面描述）
↓
① 并发提交所有切片到可灵 image2video
   每切片 prompt = 画面描述 + [VOICE: 网红voice_prompt] + [DIALOGUE: 台词文本]
   带：首帧图R2URL + elements[frontal_image_url] + generate_audio:true + 15s + 宽高比
   mode: pro
↓
② 可灵异步生成（画面 + 声音一体输出） → Webhook 回调 → 主动验证 → 下载到 R2
↓
③ Lip Sync
   真人（Quinn/Ellie/Aria/Kai）→ Kling /v1/videos/lip-sync
   非真人（Sable/Miso/虚拟角色）→ Replicate kwaivgi/kling-lip-sync（$0.15/条）
↓
④ 所有切片完成 → 拼接 → 加字幕
↓
⑤ 通知用户，提供预览和下载
```

**平台双版本**（若选两个平台独立生成）：
- 并发提交两组切片（9:16 TikTok / 16:9 YouTube），各自独立流程
- 全部完成后同时通知

**技术参考**：`dreamlab-assets/kling-api.md`（含正确 Base URL、JWT 格式、已知问题）
**分镜库参考**：`dreamlab-assets/shot-language-library.md`

---

## 🔧 基础设施配置（2026-02-17 已完成）

### Cloudflare R2 存储
```
Account ID: 存于 Keychain（CF_ACCOUNT_ID）
Bucket: dreamlab-assets
Endpoint: https://{CF_ACCOUNT_ID}.r2.cloudflarestorage.com
访问方式: boto3 S3 兼容，region_name="auto"
```

**已上传资产**:
```
influencers/sable/sable_front.png          # 参考图
influencers/sable/sable_studio_16x9.png    # 首帧图（v1）
influencers/sable/sable_studio_9x16.png    # 首帧图（v1）
influencers/sable/sable_clip1.wav          # TTS音频
influencers/sable/sable_clip2.wav          # TTS音频
influencers/sable/sable_clip1_silent.mp4   # std mode 视频
influencers/sable/sable_clip2_silent.mp4   # std mode 视频
```

### 本地工具
```
Python 包：boto3, requests, PyJWT, Pillow, moviepy
未安装：ffmpeg（用 moviepy 替代）
```

### Sable Demo 进度（2026-02-17）
| 步骤 | 状态 |
|------|------|
| 首帧图生成（Gemini img2img v3） | ✅ 9:16 + 16:9 |
| R2 上传 | ✅ |
| image2video std mode | ✅ 两个切片 |
| image2video pro mode | ⏳ 任务已提交，结果待查 |
| 声音绑定（/v1/voices/create） | ❌ 404，端点待确认 |
| Kling Lip Sync | ❌ 不支持猫脸（非真人限制） |
| 最终 30s demo | ✅ sable_podcast_30s.mp4（手动合并） |

---

## 🗺️ 产品路由结构（Next.js App Router）

```
src/app/
│
├── (auth)/
│   ├── login/page.tsx           # 登录
│   └── register/page.tsx        # 注册
│
├── (app)/                       # 需要登录
│   ├── layout.tsx               # 侧边栏 + 顶部积分显示
│   │
│   ├── home/
│   │   └── page.tsx             # 工作台（任务进度 + 最近作品 grid）
│   │
│   ├── influencers/
│   │   └── page.tsx             # 网红管理（类型筛选 + 分组展示 + 新建）
│   │
│   ├── studio/
│   │   ├── page.tsx             # 内容创作（看灵感/爆款二创/内容原创三区块）
│   │   ├── podcast/page.tsx     # 视频播客（5步+import模式）
│   │   ├── remix/page.tsx       # 爆款二创
│   │   ├── edu/page.tsx         # 网红科普
│   │   ├── anime/page.tsx       # 动漫营销
│   │   ├── story/page.tsx       # 故事短片
│   │   └── trending/page.tsx    # 看灵感（免费）
│   │
│   ├── jobs/
│   │   ├── page.tsx             # 任务管理（进行中，步骤进度点）
│   │   └── [id]/page.tsx        # 任务详情 + 视频预览
│   │
│   ├── works/
│   │   └── page.tsx             # 历史作品（类型筛选+编辑标题+删除）
│   │
│   └── credits/
│       ├── page.tsx             # 积分中心（余额 + 流水）
│       └── checkout/page.tsx    # 充值（Stripe）
│
└── api/
    ├── auth/callback/route.ts
    ├── influencers/route.ts     # GET 列表 / POST 创建
    ├── influencers/[id]/route.ts
    ├── studio/podcast/route.ts  # POST 创建播客任务
    ├── studio/remix/route.ts
    ├── jobs/route.ts            # GET 任务列表
    ├── jobs/[id]/poll/route.ts  # 轮询 Kling 状态
    ├── trending/route.ts        # GET 热点（TrendRadar）
    ├── credits/checkout/route.ts
    └── webhooks/
        ├── kling/route.ts       # Kling 回调
        └── stripe/route.ts      # Stripe 支付回调
```

## 📅 7日开发计划（2026-02-18 启动）

### Day 1 · 基础设施 + 登录 + Layout
- [ ] Supabase 项目创建 + 执行 schema.sql
- [ ] `/login` `/register` 页面 + OAuth 回调
- [ ] `middleware.ts`（未登录跳转）
- [ ] App layout — 侧边栏 + 顶部积分 badge

### Day 2 · 网红管理（展示 + 创建）
- [ ] 种子数据写入 Supabase（12个内置网红）
- [ ] `/influencers` 列表页（官方/我的标签）
- [ ] 新建向导 5步 + `POST /api/influencers`

### Day 3 · 网红管理（图片/声音生成 + 编辑）
- [ ] Gemini img2img → R2
- [ ] Gemini TTS → R2 试听
- [ ] 编辑展开卡片 + Credit 扣费

### Day 4 · 内容工厂入口 + 看灵感 + 播客 Steps 1-3
- [ ] `/studio` 入口（5张生产线卡片）
- [ ] `/studio/trending` 看灵感（TrendRadar）
- [ ] `/studio/podcast` Step 1-3（选话题/要点/节目设置）

### Day 5 · 播客 Steps 4-5 + 共用 Kling Pipeline
- [ ] Step 4-5：脚本生成 + 并发提交 Kling
- [ ] Webhook 回调 + 视频拼接
- [ ] 非真人 Lip Sync（Replicate）

### Day 6 · 爆款二创 + 网红科普 + 动漫营销 + 任务状态
- [ ] `/studio/remix` `/studio/edu` `/studio/anime`
- [ ] `/jobs` 任务列表 + `/jobs/[id]` 详情 + 轮询

### Day 7 · 积分 + Stripe + 部署
- [ ] `/credits` 积分中心 + Stripe 充值
- [ ] Railway 部署 + 全流程测试

---

### 进度追踪
| Day | 状态 | 完成时间 |
|-----|------|---------|
| Day 1 | ✅ 完成 | 2026-02-18 |
| Day 2 | ✅ 完成 | 2026-02-18 |
| Day 3 | ✅ 完成 | 2026-02-18 |
| Day 4 | ✅ 完成 | 2026-02-18 |
| Day 5 | ✅ 完成 | 2026-02-18 |
| Day 6 | ✅ 完成 | 2026-02-18 |
| Day 7 | 🔄 进行中 | - |
| Seed + 本地测试 | ✅ 完成 | 2026-02-18 |
| 热点接真实数据 | ✅ 完成 | 2026-02-18 |
| 播客流程全 bug 修复 | ✅ 完成 | 2026-02-18 |
| **等待 ngrok 后端到端测试** | 🔴 待做 | - |

---

## 🔗 相关资源

- 视频参考：`/Users/gd-npc-848/Downloads/Download (2).mp4`（小花大黄播客参考）
- 转录文本：`/Users/gd-npc-848/Desktop/Download (2).txt`
- Skill：`~/.claude/skills/product-codesign/skill.md`
- Skill：`~/.claude/skills/video-remix-analyzer/skill.md`
- 可灵 API 详细参考：`dreamlab-assets/kling-api.md`
- 分镜语言库：`dreamlab-assets/shot-language-library.md`
- 测试脚本：`dreamlab-assets/test_kling_generation.py`
