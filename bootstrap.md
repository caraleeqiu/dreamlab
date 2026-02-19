# Dreamlab · Bootstrap

> **最后更新**: 2026-02-19 (Round 15)
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
| 🔴 | 端到端测试（Kling webhook → stitch → 视频完成全链路） | 待测试 |
| 🟡 | Kling 自定义声线（Subject Library voice_id 绑定） | 待做 |
| 🟡 | Stripe 配置（STRIPE_PUBLISHABLE_KEY 还空着） | 待做 |
| 🟡 | DB 迁移 002 执行（provider/task_id/element_id 字段） | 待确认 |
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
