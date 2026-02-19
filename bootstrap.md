# Dreamlab · Bootstrap

> **最后更新**: 2026-02-19 (Round 21)
> **GitHub**: https://github.com/caraleeqiu/dreamlab
> **完整项目文档**: `ai-influencer.md`（本目录）

---

## 🟢 当前状态

生产可用 — TS 零错误，架构审查完毕，P0/P1 问题全部修复，API 层全双语

**Round 11 更新：**
- 网红详情弹窗全双语（EN 下标签/领域/风格/禁区/声线标题全翻译）
- `localizeInfluencer()` 正确应用到所有 InfluencerCard 渲染
- AppHeader 子页面返回按钮（/studio/* /jobs/* /influencers/*）
- 播客入口卡片改为竖排 3 列网格
- trending-cache.json 修复 JSON 解析错误（内嵌引号）

**Round 12 更新：**
- 动漫营销视频 wizard v2：6步流程（全双语）
- 新增 `/api/studio/anime/extract-product` — Gemini 2.0 Flash 解析产品信息
- TS 零错误

**Round 13 更新：**
- credits 页全双语
- stitchVideo 迁移到 ffmpeg-static + fluent-ffmpeg（纯 npm）

**Round 14 更新（架构修复 P0/P1）：**
- **P0 — FFmpeg超时**：FFmpeg 提取到独立路由 `/api/jobs/[id]/stitch`（`maxDuration=300`，`x-stitch-secret` 保护）；webhook 变薄，只更新 clip 状态，fire-and-forget 触发 stitch
- **P0 — 积分丢失**：两处退款点 — 提交失败（job-service `failClipAndCheckJob`）+ 生成失败（webhook `checkAndUpdateJobStatus`）；用 `add_credits` RPC 异步 IIFE 退还
- **P0 — Webhook 安全**：callback URL 追加 `?whs=KLING_WEBHOOK_SECRET`；handler 校验后才处理，防止恶意伪造
- **P1 — Gemini 不稳定**：新建 `src/lib/gemini.ts`（3次重试 + 60s超时 + 指数退避），所有 7 条脚本路由迁移到 `callGeminiJson<T>()`
- **P1 — Subject Library**：网红创建时自动注册 Kling 3.0 Subject Library（fire-and-forget），`buildClipPrompt` 优先用 `element_id`，兼容旧数据 `frontal_image_url` fallback
- **P1 — 恢复任务**：新建 `/api/jobs/recover`（`x-recover-secret` 保护），Supabase Cron 每10分钟触发；找 submitted > 30min 的 clip 重试
- **新增路由**：`/api/admin/influencers/sync-subjects`（批量注册现有网红到 Subject Library）
- Kling 3.0 新接口：`createSubject()`、`submitOmniVideo()`

**Round 21 更新（帧链式 + 分镜图生成 + Seedance 客户端 + Provider 路由）：**
- **帧链式（Story/Script 专属）**：story route 仅提交 group 0，groups 1..N 存入 `clips.prompt` 作为 deferred JSON payload；webhook clip 完成时 ffmpeg 提取最后一帧上传 R2，再触发下一 group 提交并以该帧为 `first_frame` 锚点，解决跨 group 接缝"传送门感"
- **`lib/imagen.ts`**：Gemini 2.0 Flash 图像生成，为每个 clip 生成分镜预览帧；`generateStoryboardFrame()` / `generateStoryboardFrames()`，失败时自动回退到网红正面图
- **`lib/kling.ts` 参数扩展**：`submitMultiShotVideo` 新增 `firstFrameUrl`（帧链锚点）和 `referenceVideoUrl`（运镜风格参考，`refer_type:"feature"`）
- **`lib/seedance.ts`**：即梦 2.0 完整 API 客户端；`submitSeedanceVideo()`（@素材多模态语法构建）、`extendSeedanceVideo()`（向后/向前延长）、`getSeedanceTaskStatus()`；`seedanceSupportsFace()` 拦截写实真人（平台政策）
- **`lib/video-router.ts`**：`getActiveProvider()` 开启 Seedance 路由（设置 `SEEDANCE_API_KEY` 后生效）；`selectClipProvider()` 三策略（kling/seedance/hybrid）；真人网红始终强制 Kling

**Round 20 更新（Clip 后编辑 + Remix Omni 修复 + 播客/剧集增强）：**
- **Clip 后编辑**：job 详情页每个完成 clip 新增「编辑」按钮，内联展开：编辑意图文本框 + 保留原音开关；提交后调用 `POST /api/studio/edit-clip`，原地覆盖 clip（同一 clip_id），job 回到 generating，webhook 完成后自动重新 stitch
- **`POST /api/studio/edit-clip`**：调用 `kling-v3-omni` `video_list.refer_type="base"` 编辑底片模式；无积分扣费（精修已付费内容）
- **Remix Omni 修复**：`submitReferenceToVideo`（错误 endpoint `/v1/videos/reference2video`）彻底删除，换成 `submitVideoToVideo`（`/v1/videos/omni-video` + `video_list`）；Tier 1 改用 `refer_type: "feature"` 继承原视频运镜风格
- **`getTaskStatus` 三重 fallback**：image2video → text2video → omni-video，覆盖所有 Kling 任务类型
- **播客分镜台词可编辑**：storyboard 表格台词列改为 `<input>`，可在预览时直接修改
- **Story 前情提要**：第 2 集起显示「前情提要」文本框，传入 API 作为 prevCliffhanger 兜底（DB 查不到时使用）

**Round 19 更新（Anime 脚本可编辑 + 2 新网红 + 积分退还完善）：**
- **Anime wizard 台词可编辑**：Script 步骤台词改为 `<textarea>`，支持直接修改；新增 `extractError` 警告横幅（AI 识别失败时提示手动填写）
- **Story 投影阵容排序**：`sortedCastInfluencers` 将推荐角色（aria/kai/tanjiro/atlas）排到前面，再按 human/virtual 排
- **新网红 Marin（时尚 virtual）**：🎀 服装/美妆/cosplay，热情不评判，对应 Fashion 产品类目
- **新网红 Senku（科技 virtual）**：🔬 数码/工具/效率，极度自信逻辑流，对应 Tools 产品类目
- **积分退还漏洞修复**：所有 5 条提交路由（anime/edu/podcast/remix/story）job INSERT 失败时立即调用 `add_credits` 退款（此前仅 clip 层有退款）

**Round 18 更新（Job筛选 + Story偏好 + 失败重试 + 系列面板增强）：**
- **Job 列表类型筛选**：`/jobs` 页顶部新增 7 个筛选芯片（全部/播客/故事/科普/链接/动漫/脚本），`filteredJobs` 计算变量；空列表区分"无任务"与"此类型无任务"
- **Job 详情失败面板**：failed 状态下显示 XCircle + 错误信息 + 积分退还确认 + "重新创建"按钮（跳回对应 Studio）
- **Story wizard 偏好持久化**：新增 `initialPrefs` prop，从 `profiles.preferences.story` 回填 narrativeStyle/platform/duration；platform→script 过渡时静默调用 `PATCH /api/user/preferences`
- **Story 系列面板增强**：中英双语，显示集数 + 最后一集悬念（紫色斜体），"继续创作"按钮双语（`继续 第N集` / `Ep N →`），集数胶囊双语
- **Edu Talk URL 来源提示**：URL 输入框下方新增中英分开来源说明板（✅ 支持 / ❌ 不支持）

**Round 17 更新（Link Jina 升级 + 用户偏好持久化）：**
- **Link extract 重写**：从 raw fetch（8K 字符）升级为 Jina AI reader（60K），平台检测同播客（微信/小红书/B站/抖音/Twitter），友好错误 + `fallback: 'script'` 字段
- **Link wizard 来源提示**：Step 0 加中英文分开的支持/不支持来源说明板
- **用户偏好持久化**：新建 `profiles.preferences JSONB` 列（Migration 003）+ `PATCH /api/user/preferences` 接口；播客 / Link wizard 从偏好回填 platform/duration/format，设置完成时静默保存
- **DB 迁移 003 已执行**：`preferences` 列已上线

**Round 16 更新（播客 wizard 改版 + Story 视觉一致性）：**
- **播客 wizard Step 0 重设计**：从 3 个模式（trending/import/custom）改为 4 个顶层 tab（🔥 热点 / ✍️ 自己写 / 🔗 链接 / 📄 PDF）
- **热点 tab 新增对话输入框**：热点话题列表和角度输入框同屏显示，用户可指定角度（可选）
- **链接 tab 来源提示**：分中英文列出支持/不支持来源，❌ 不支持平台提示切换到「自己写」
- **Extract route 升级**：Twitter/X oEmbed 支持（单推文）；微信/小红书/B站/抖音返回友好错误 + `fallback: 'write'` 字段；前端自动切换 tab
- **Story `consistency_anchor`**：ScriptClip 新增 `consistency_anchor` 字段（角色外观+场景+光线一句话），注入每次 Kling 调用，保持跨幕视觉一致性
- **Webhook 双字段查询**：先查 `kling_task_id`，再 fallback 到 `task_id`，防止漏回调
- **系列剧 UI**：Job 详情页显示系列名+集数 badge + cliffhanger 预览
- **podcast-home.tsx**：入口卡片更新为 4 个（trending / write / url / pdf）

**Round 15 更新（i18n 修复）：**
- **API 层双语**：`deductCredits()` 新增 `lang` 参数，402 错误返回对应语言（`积分不足` / `Insufficient credits`）
- **所有 10 条 studio 路由** 传 `lang` 给 `deductCredits`；job 默认标题按语言切换（`科普:` / `Science:` 等）
- **创建任务失败** 错误双语（podcast/script/link 路由）
- **`error_msg` 改为英文**：webhook / job-service 中存 DB 的错误描述统一英文
- **动态 `<html lang>`**：app layout 写 `dreamlab-lang` cookie → root layout 读取 → `zh-CN` / `en`
- **remix/route.ts** 迁移 raw Gemini fetch → `callGeminiJson`（最后一条未迁移路由）
- OpenStoryline（小红书）暂未开源，暂不集成

---

## ⚡ 快速启动

```bash
cd ~/Desktop/FeishuClaw/Dreamlab/dreamlab
source dev.sh      # 加载所有 Keychain secrets
npm run dev        # 启动 http://localhost:3000
```

### 恢复 ngrok（每次重启机器需要重新运行）

```bash
/tmp/ngrok-bin/ngrok http 3000
# 拿到新 URL → 更新 .env.local 的 NEXT_PUBLIC_APP_URL
source dev.sh  # 重启 dev server
```

---

## 📋 当前 To-Do（按优先级）

| 优先级 | 任务 | 状态 |
|--------|------|------|
| 🟢 | Google OAuth 配置 | ✅ 完成 |
| 🟢 | 所有 wizard 双语 | ✅ 完成 |
| 🟢 | Podcast import 模式（URL/PDF 拆书） | ✅ 完成 |
| 🟢 | 14 个网红图片上传 R2 + DB 更新 | ✅ 完成 |
| 🟢 | 完整导航架构（工作台/任务/历史作品/分类） | ✅ 完成 |
| 🟢 | 动漫营销视频 wizard v2（产品识别+6步流程） | ✅ 完成 |
| 🟢 | stitchVideo 用 ffmpeg-static | ✅ 完成 |
| 🟢 | credits 页完整双语 | ✅ 完成 |
| 🟢 | Kling 3.0 multi-shot 升级 | ✅ 完成 |
| 🟢 | P0 架构修复（FFmpeg超时/积分退还/Webhook安全） | ✅ 完成 |
| 🟢 | P1 架构修复（Gemini重试/Subject Library/恢复任务） | ✅ 完成 |
| 🟢 | API 层全双语（deductCredits/job titles/html lang） | ✅ 完成 |
| 🟢 | Supabase Cron 每10分钟触发 /api/jobs/recover | ✅ 完成 |
| 🟢 | 播客 wizard 4 tab 重设计（热点/自己写/链接/PDF） | ✅ 完成 |
| 🟢 | Story consistency_anchor 跨幕视觉一致性 | ✅ 完成 |
| 🟢 | 链接来源提示 + Twitter oEmbed + fallback 处理 | ✅ 完成 |
| 🟢 | Link extract 升级 Jina AI（60K 限制 + 平台检测） | ✅ 完成 |
| 🟢 | 用户偏好持久化（profiles.preferences + /api/user/preferences） | ✅ 完成 |
| 🟢 | DB 迁移 001+002+003 全部执行完毕 | ✅ 完成 |
| 🔴 | 端到端测试（Kling webhook → stitch → 视频完成全链路） | 待测试 |
| 🟢 | Story wizard 偏好持久化（platform/duration/narrativeStyle） | ✅ 完成 |
| 🟢 | Job 列表页类型筛选 | ✅ 完成 |
| 🟢 | Clip 后编辑（POST /api/studio/edit-clip，omni base 模式） | ✅ 完成 |
| 🟢 | Remix Omni 修复（submitVideoToVideo + refer_type feature/base） | ✅ 完成 |
| 🟢 | Story/Script 帧链式（deferred 顺序提交 + ffmpeg 最后帧提取） | ✅ 完成 |
| 🟢 | lib/imagen.ts 分镜帧生成（Gemini 2.0 Flash imageGen） | ✅ 完成 |
| 🟢 | lib/seedance.ts 即梦2.0 API 客户端 | ✅ 完成（等 API Key）|
| 🟢 | video-router.ts Provider 三策略（kling/seedance/hybrid） | ✅ 完成 |
| 🟡 | Kling 自定义声线（Subject Library voice_id 绑定） | 待做 |
| 🟡 | Stripe 配置（STRIPE_PUBLISHABLE_KEY 还空着） | 待做 |
| 🟡 | blockProvider 持久化（当前 in-process Map，cold start 会重置） | 待做 |
| ⬜ | JINA_API_KEY 申请（免费，不填也能跑） | 可选 |

---

## 🏗️ 导航结构

```
工作台    /home        任务进度（步骤点）+ 最近6条作品 grid
网红管理  /influencers  分类筛选 tab（真人/动物/虚拟/品牌）+ 按类分组
内容创作  /studio       看灵感 / 爆款二创 / 内容原创 三区块
任务管理  /jobs         进行中任务 + 步骤进度点，8秒刷新
历史作品  /works        类型筛选 + 时间倒序 + 编辑标题 + 删除
积分      /credits      （侧边栏底部）
```

## 🏗️ 视频生成链路

```
wizard → POST /api/studio/[type] → 扣积分 → 创建 job → 提交 Kling
→ Kling webhook 回调 /api/webhooks/kling → 更新 clip 状态 → 全部完成后 stitch
```

### Kling API 3.0 关键参数（2026.2）

| 参数 | 说明 |
|------|------|
| `multi_shot: true` | 多镜头模式（boolean，不是字符串） |
| `shot_type: "intelligence"` | 模型自动切镜，只需 1 个 prompt |
| `shot_type: "customize"` | 手动定义每镜，需 multi_prompt 数组 |
| `sound: "on"` | 开启音频生成（替代旧版 generate_audio: true） |
| `element_list` | 主体控制（角色图片绑定），不是旧版 `elements[]` |
| `voice_list` | 声线绑定（voice_id 为 string，需视频创建的主体） |
| `duration` | string 类型，枚举 "3"~"15" |

**分组策略（anime/story）：**
- 每组 ≤ 6 个 shot 且总时长 ≤ 15s
- 单 clip 组 → intelligence 模式
- 多 clip 组 → customize 模式 + multi_prompt

---

## 🔑 关键文件位置

| 文件 | 说明 |
|------|------|
| `dreamlab/dev.sh` | 从 Keychain 加载所有 secrets |
| `dreamlab/.env.local` | Supabase URL/key + ngrok URL |
| `dreamlab/supabase/schema.sql` | 数据库 schema |
| `dreamlab/supabase/migrations/002_multi_provider_clips.sql` | 多 provider + Subject Library 字段迁移 |
| `dreamlab/scripts/seed-influencers.ts` | 12个内置网红种子数据 |
| `dreamlab/scripts/upload-influencer-images.py` | boto3 上传图片到 R2 + 更新 DB |
| `src/lib/gemini.ts` | Gemini 统一 wrapper（重试/超时） |
| `src/lib/job-service.ts` | deductCredits（双语）/ failClipAndCheckJob |
| `src/lib/video-router.ts` | 多 provider 路由（Kling/Seedance） |
| `src/app/api/jobs/[id]/stitch/route.ts` | FFmpeg stitch（maxDuration=300） |
| `src/app/api/jobs/recover/route.ts` | 卡住 clip 恢复（Cron 触发） |
| `dreamlab-assets/kling-api.md` | 可灵 API 参考 |
| `trend-fetcher/fetch_trends.py` | 英文热点抓取 |

---

## 🤖 MCP 工具（Claude Code 内直接调用）

```
get_trending_topics / search_news / analyze_topic_trend
```
TrendRadar 已自动加载（中文热榜：微博/抖音/知乎/B站等）
