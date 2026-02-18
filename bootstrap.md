# Dreamlab · Bootstrap

> **最后更新**: 2026-02-18 (Round 10)
> **GitHub**: https://github.com/caraleeqiu/dreamlab
> **完整项目文档**: `ai-influencer.md`（本目录）

---

## 🟢 当前状态

全流程可测试 — TS 零错误，14个网红图片全部上传，完整导航结构（工作台/网红管理/内容创作/任务管理/历史作品）

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
| 🔴 | ngrok 端到端测试（Kling webhook 回调验证） | 待测试 |
| 🔴 | 视频拼接服务（stitchVideo 是 stub，需服务器有 ffmpeg） | 未开始 |
| 🟡 | credits 页完整双语 | 待做 |
| 🟡 | Stripe 配置（STRIPE_PUBLISHABLE_KEY 还空着） | 待做 |
| 🟡 | Railway 部署 | 待做 |
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
wizard → POST /api/studio/[type] → 扣积分 → 创建 job → 并发提交 Kling
→ Kling webhook 回调 /api/webhooks/kling → 更新 clip 状态 → 全部完成后 stitch
```

---

## 🔑 关键文件位置

| 文件 | 说明 |
|------|------|
| `dreamlab/dev.sh` | 从 Keychain 加载所有 secrets |
| `dreamlab/.env.local` | Supabase URL/key + ngrok URL |
| `dreamlab/supabase/schema.sql` | 数据库 schema |
| `dreamlab/scripts/seed-influencers.ts` | 12个内置网红种子数据 |
| `dreamlab/scripts/upload-influencer-images.py` | boto3 上传图片到 R2 + 更新 DB |
| `dreamlab-assets/kling-api.md` | 可灵 API 参考 |
| `trend-fetcher/fetch_trends.py` | 英文热点抓取 |

---

## 🤖 MCP 工具（Claude Code 内直接调用）

```
get_trending_topics / search_news / analyze_topic_trend
```
TrendRadar 已自动加载（中文热榜：微博/抖音/知乎/B站等）
