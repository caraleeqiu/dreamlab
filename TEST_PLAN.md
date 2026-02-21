# Dreamlab 测试计划

> **测试日期**: 2026-02-20
> **测试范围**: Round 24/25/26 新功能 + 完整链路验证
> **测试人员**: QA + Content Review

---

## 📋 测试清单

### 阶段一：环境准备（预计 15 分钟）

- [ ] `npm install` 安装依赖
- [ ] `npm run dev` 启动本地开发服务器（localhost:3000）
- [ ] `npm run build` 验证生产构建无报错
- [ ] `npm test` 运行现有 Vitest 单元测试，确保全绿
- [ ] **启动 ngrok**：`ngrok http 3000`
  - 复制 ngrok 给的公开 URL（如 `https://xxxx.ngrok-free.app`）
  - 写入 `.env.local` 的 `NEXT_PUBLIC_APP_URL`
  - 重启 `npm run dev` 使环境变量生效
- [ ] 确认 `.env.local` 所有必需变量已配置：
  ```env
  NEXT_PUBLIC_SUPABASE_URL=
  NEXT_PUBLIC_SUPABASE_ANON_KEY=
  SUPABASE_SERVICE_ROLE_KEY=
  KLING_ACCESS_KEY=
  KLING_SECRET_KEY=
  KLING_WEBHOOK_SECRET=
  GEMINI_API_KEY=
  R2_ACCOUNT_ID=
  R2_ACCESS_KEY_ID=
  R2_SECRET_ACCESS_KEY=
  R2_BUCKET_NAME=
  R2_PUBLIC_URL=
  NEXT_PUBLIC_APP_URL=https://xxxx.ngrok-free.app
  RECOVER_SECRET=
  ```

---

## 阶段二：基础流程 E2E 测试（预计 2 小时）

### P0 — 完整链路验证

#### 测试 1: Podcast 生成 + BGM 验证

**步骤**：
1. 进入 `/studio/podcast`
2. 选择「🔥 热门话题」或「✍️ 自由创作」
3. 输入话题或粘贴一段文本
4. 选择网红、平台、时长
5. 提交生成

**预期结果**：
- [ ] 脚本生成成功，每个 clip 有 `bgm` 字段
- [ ] Job 状态：`pending` → `generating` → `stitching` → `done`
- [ ] Webhook 回调成功（查看终端日志）
- [ ] 最终视频包含 BGM（下载播放验证音量约 12%）
- [ ] BGM 风格与脚本中标注的风格一致（如「轻松欢快」对应欢快音乐）

**测试数据**：
```
话题示例（中文）：为什么猫喜欢盒子？
话题示例（英文）：Why do cats love boxes?
```

---

#### 测试 2: Story 生成 + 角色一致性

**步骤**：
1. 进入 `/studio/story`
2. 输入故事主题
3. 选择网红、平台、叙事风格
4. 提交生成

**预期结果**：
- [ ] 脚本生成包含多个场景（至少 5 幕）
- [ ] 每个 clip 包含 `consistency_anchor`（视觉锚点）
- [ ] 最终视频中网红的面部/服装跨镜头保持一致
- [ ] 无明显 AI 漂移或角色变形

---

#### 测试 3: Edu Talk 生成

**步骤**：
1. 进入 `/studio/edu/talk`
2. 粘贴文章 URL（如维基百科/arXiv 论文）
3. 选择网红、平台
4. 提交生成

**预期结果**：
- [ ] 内容提取成功（通过 Jina AI reader）
- [ ] 脚本遵循 Hook-Explain-Apply-Wonder 框架
- [ ] 视频合成完成

**测试数据**：
```
URL 示例：https://en.wikipedia.org/wiki/Quantum_entanglement
```

---

### P1 — Remix 三场景（核心新功能）

#### 测试 4: Remix - 换主体 (Visual Remix)

**步骤**：
1. 进入 `/studio/remix`
2. 默认显示三个 Tab，点击「换主体 / Visual Remix」Tab
3. 粘贴参考视频 URL（抖音/TikTok/YouTube）
4. 选择网红、平台
5. 确认页面显示 **20 积分** 费用
6. 提交生成

**预期结果**：
- [ ] Tab 栏正确显示三个选项，当前 Tab 高亮为 violet 色
- [ ] 费用徽标显示「费用: 20 积分」（不是 5）
- [ ] 视频提交成功，job 类型为 `remix`
- [ ] Kling 使用 `refer_type: "feature"` 进行风格迁移
- [ ] 最终视频网红替换了原视频主体

**测试数据**：
```
视频 URL 示例：
- 抖音短视频链接
- TikTok 视频链接
- YouTube Shorts 链接
```

---

#### 测试 5: Remix - 片段替换 AI 生成模式 (Segment Splice - AI Generate)

**步骤**：
1. 点击「片段替换 / Segment Splice」Tab
2. 从下拉列表选择一个已完成的 job
3. 输入时间范围（如 开始: 0.0, 结束: 5.0）
4. 选择「AI 生成」
5. 输入场景描述（如「网红站在落地窗前，阳光洒在肩上，微微转头看向镜头」）
6. 提交

**预期结果**：
- [ ] Tab 栏显示「免费编辑 / Free edit」标签
- [ ] 提交后创建新的 sub-job
- [ ] Kling 生成替换片段
- [ ] Webhook 自动执行三段拼接（before + 新片段 + after）
- [ ] 返回原 job 详情页，显示更新后的视频

---

#### 测试 6: Remix - 片段替换上传模式 (Segment Splice - Upload Clip)

**步骤**：
1. 片段替换 Tab
2. 选择已完成 job
3. 输入时间范围
4. 选择「上传素材」
5. 粘贴一个 MP4 直链 URL
6. 提交

**预期结果**：
- [ ] 同步拼接（无需 webhook）
- [ ] 返回 `{ splicedUrl: "..." }`
- [ ] 立即跳转回原 job 页面
- [ ] 视频已替换成功

**测试数据**：
```
MP4 直链示例：https://example.com/sample.mp4
```

---

#### 测试 7: Remix - 脚本仿写 (Script Imitation)

**步骤**：
1. 点击「脚本仿写 / Script Imitation」Tab
2. 粘贴参考视频 URL
3. 点击「开始分析」按钮
4. 等待 Gemini Vision 分析（约 30-60 秒）
5. 审阅分析结果：
   - 叙事分析（开头钩子、结构、节奏、平台风格）
   - 视觉风格指南（画风、色调、剪辑节奏）
   - 脚本预览（可展开查看每一幕）
6. 选择网红、平台
7. 确认生成（20 积分）

**预期结果**：
- [ ] FFmpeg 成功提取 6 帧关键帧
- [ ] Gemini Vision 返回完整 `RemixAnalysis`
- [ ] 分析结果包含 `narrative`、`styleGuide`、`remixScript`
- [ ] 参考视频镜像到 R2（用于 camera-style learning）
- [ ] Deferred clip 链式提交（首片段立即提交，后续片段 webhook 触发）
- [ ] 最终视频叙事结构与参考视频相似

---

### P1 — 其他新功能

#### 测试 8: 单片段重生成 (Regen)

**步骤**：
1. 打开一个已完成 job 的详情页 `/jobs/[id]`
2. 找到任意一个 clip，点击「重生成 / Regen」按钮
3. 输入新的场景描述
4. 提交

**预期结果**：
- [ ] 按钮显示为青色（cyan），文案双语正确
- [ ] 提交后调用 `/api/studio/remix/splice` with `ai-generate`
- [ ] 时间范围估算为 `clip_index × 15s`
- [ ] Kling 生成新片段
- [ ] Webhook 触发重新 stitch
- [ ] 该 clip 被替换，其他 clip 保持不变

---

#### 测试 9: Kling 主体注册 (Subject Library Registration)

**步骤**：
1. 进入 `/influencers`
2. 点击任意网红卡片打开详情弹窗
3. 找到「可灵主体库 / Kling Subject Library」区块
4. 点击「注册主体 / Register」按钮
5. 等待注册完成

**预期结果**：
- [ ] 按钮显示「注册中… / Registering…」加载状态
- [ ] 调用 `POST /api/influencers/[id]/register-kling`
- [ ] Kling `createSubject()` 成功返回 `element_id` 和 `voice_id`
- [ ] DB `influencers` 表中 `kling_element_id` 和 `kling_element_voice_id` 字段写入
- [ ] 按钮变为绿色徽标「已注册 / Registered」
- [ ] 显示说明文字「角色与声线已锁定，跨批次生成保持一致性」

**错误情况测试**：
- [ ] 注册失败时显示双语错误提示（中文「注册失败」/ 英文「Registration failed」）

---

## 阶段三：边界 & 异常测试（预计 1 小时）

### 异常场景 1: Remix 分析失败

**步骤**：
1. 脚本仿写 Tab
2. 输入无效 URL（如 `https://invalid-domain-12345.com/video.mp4`）
3. 点击分析

**预期结果**：
- [ ] 显示错误信息（中英文）
- [ ] 显示「重试 / Retry」按钮
- [ ] 点击重试返回输入步骤

---

### 异常场景 2: Segment Splice 时间范围错误

**步骤**：
1. 片段替换 Tab
2. 输入 开始: 10.0, 结束: 5.0（结束时间 ≤ 开始时间）
3. 提交

**预期结果**：
- [ ] 显示错误「时间范围无效，结束时间必须大于开始时间」（中文）
- [ ] 显示错误「Invalid time range: end must be greater than start」（英文）
- [ ] 不调用 API

---

### 异常场景 3: 积分不足

**步骤**：
1. 将用户积分余额改为 10（小于 20）
2. 尝试提交 Remix - 换主体

**预期结果**：
- [ ] 确认页面显示「余额不足 / Insufficient credits」警告
- [ ] 提交按钮禁用
- [ ] 显示「充值 / Top up」链接

---

### 异常场景 4: BGM 下载失败

**步骤**：
1. 模拟 BGM URL 不可访问（如断网或修改 `bgm.ts` 中的 URL 为无效链接）
2. 提交一个有 BGM 的 job
3. 等待 stitch

**预期结果**：
- [ ] Stitch 不报错，fallback 到无 BGM 模式
- [ ] 视频正常生成（只是没有背景音乐）
- [ ] 日志显示「BGM download failed, continuing without BGM」

---

### 异常场景 5: 所有 clip 无 BGM 字段

**步骤**：
1. 修改脚本生成逻辑，确保所有 `clip.bgm` 为 `undefined`
2. 提交 job
3. 等待 stitch

**预期结果**：
- [ ] `dominantBgm([])` 返回 `null`
- [ ] Stitch 跳过 BGM 混音步骤
- [ ] 视频正常输出（无 BGM）

---

### 语言切换测试

**步骤**：
1. 切换语言到 English
2. 遍历 Remix 三个 Tab
3. 打开网红详情弹窗
4. 触发各种错误（如积分不足、注册失败）

**预期结果**：
- [ ] 所有 Tab 标签、按钮、提示文字显示英文
- [ ] 费用标签显示「Cost: 20 credits」
- [ ] 错误提示显示英文

---

## 阶段四：自动化测试补充（预计 3 小时）

需要新增以下 Vitest 单元测试文件：

### 测试文件 1: `src/__tests__/bgm.test.ts`

```typescript
import { describe, it, expect } from 'vitest'
import { dominantBgm } from '@/lib/bgm'

describe('BGM utils', () => {
  it('returns null for empty array', () => {
    expect(dominantBgm([])).toBe(null)
  })

  it('returns most common BGM style', () => {
    expect(dominantBgm(['轻松欢快', '轻松欢快', '科技感'])).toBe('轻松欢快')
  })

  it('handles English aliases', () => {
    const result = dominantBgm(['relaxed', '轻松欢快'])
    // Both should map to the same URL
    expect(result).toBeTruthy()
  })

  it('ignores undefined values', () => {
    expect(dominantBgm([undefined, '励志', undefined, '励志'])).toBe('励志')
  })
})
```

---

### 测试文件 2: `src/__tests__/remix-wizard.test.tsx`

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import RemixWizard from '@/app/(app)/studio/remix/remix-wizard'

describe('RemixWizard', () => {
  it('renders three tabs by default', () => {
    render(<RemixWizard lang="en" credits={100} influencers={[]} jobs={[]} />)
    expect(screen.getByText('Visual Remix')).toBeInTheDocument()
    expect(screen.getByText('Segment Splice')).toBeInTheDocument()
    expect(screen.getByText('Script Imitation')).toBeInTheDocument()
  })

  it('shows correct credit cost for Visual Remix tab', () => {
    render(<RemixWizard lang="en" credits={100} influencers={[]} jobs={[]} />)
    expect(screen.getByText('20 credits')).toBeInTheDocument()
  })

  it('shows free tag for Segment Splice tab', () => {
    render(<RemixWizard lang="zh" credits={100} influencers={[]} jobs={[]} />)
    // Click Segment Splice tab
    // Check for "免费编辑" badge
  })
})
```

---

### 测试文件 3: `src/__tests__/api/remix-splice.test.ts`

```typescript
import { describe, it, expect } from 'vitest'
import { POST } from '@/app/api/studio/remix/splice/route'

describe('POST /api/studio/remix/splice', () => {
  it('returns 400 when end <= start', async () => {
    const req = new Request('http://localhost:3000/api/studio/remix/splice', {
      method: 'POST',
      body: JSON.stringify({
        jobId: 1,
        startS: 10,
        endS: 5,
        replacementType: 'ai-generate',
        prompt: 'test'
      })
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when ai-generate mode missing prompt', async () => {
    const req = new Request('http://localhost:3000/api/studio/remix/splice', {
      method: 'POST',
      body: JSON.stringify({
        jobId: 1,
        startS: 0,
        endS: 5,
        replacementType: 'ai-generate',
        prompt: ''
      })
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
```

---

## 爆款内容评审标准

每个生成的视频按以下维度打分：

### 维度一：钩子（0-3秒）⚡ 权重最高

| 分 | 标准 |
|----|------|
| 5 | 前3秒有强烈冲突/反常识/悬念，让人停住拇指 |
| 3 | 有一定吸引力，但不够抓人，划走概率>50% |
| 1 | 开场是介绍、问候、背景铺垫 → 必死 |

**检查项**：
- [ ] 第1帧是否有冲突画面或强台词？
- [ ] 有没有「停滞感」（主角站着不动 + 旁白开场）？
- [ ] 字幕/对话是否在前2秒就抛出核心矛盾？

---

### 维度二：叙事结构 📐

| 评分 | 标准 |
|------|------|
| 优 | 问题→激化→解决→反转，每15秒有一个小高潮 |
| 中 | 有起伏但节奏拖沓，中段掉速 |
| 差 | 平铺直叙，无转折，看完没记忆点 |

**检查项**：
- [ ] 中间段（30%-70%）有没有信息密度低谷？
- [ ] 结尾是否有 CTA 或悬念延伸？
- [ ] 分幕是否有意义？

---

### 维度三：视觉一致性 🎭

| 评分 | 标准 |
|------|------|
| 优 | 网红形象跨镜头稳定，服装/场景有视觉逻辑 |
| 中 | 主体面部稳定，但背景/光线变化突兀 |
| 差 | 不同片段网红像两个人，或出现明显 AI 面部漂移 |

**检查项**：
- [ ] 网红面部是否在每个 clip 都保持一致（眼睛/鼻梁/轮廓）？
- [ ] clip 间色调/曝光是否断层？
- [ ] 场景切换是否有视觉动线？

---

### 维度四：运镜与剪辑节奏 🎬

| 评分 | 标准 |
|------|------|
| 优 | 慢情绪快信息，BGM 节拍点与剪辑点对齐 |
| 中 | 节奏平，无强弱区分，可以接受 |
| 差 | 全程同一景别，或剪辑点完全随机 |

**检查项**：
- [ ] 有没有用推镜/拉镜制造情绪？
- [ ] 每个 clip 时长是否有变化？
- [ ] 跳切时有没有人物位置跳变？

---

### 维度五：BGM 适配 🎵

| 评分 | 标准 |
|------|------|
| 优 | BGM 风格与内容情绪匹配，音量不压人声 |
| 中 | BGM 存在但风格稍偏，不影响观看 |
| 差 | BGM 太响盖过对白，或风格与视频完全违和 |

**检查项**：
- [ ] BGM 是否在 12% 左右（能感知但不分心）？
- [ ] BGM 风格是否匹配内容情绪？
- [ ] BGM 是否有突然中断的杂音？

---

### 维度六：平台适配 📱

| 平台 | 时长 | 比例 | 字幕 | 节奏 |
|------|------|------|------|------|
| 抖音/TikTok | 15-45s | 9:16 | 必须 | 快，每5秒一个信息点 |
| 小红书 | 30-60s | 9:16 或 3:4 | 推荐 | 中，情绪驱动 |
| YouTube Shorts | 30-60s | 9:16 | 推荐 | 中，故事性强 |
| B站 | 1-3min | 16:9 | 必须 | 慢热可接受 |

**检查项**：
- [ ] 实际输出比例是否匹配平台？
- [ ] 视频时长是否在黄金区间？
- [ ] 字幕是否清晰可读（字号/位置/颜色）？

---

### 维度七：AI 感知度 🤖（减分项）

| 现象 | 严重程度 |
|------|---------|
| 网红眼神空洞，不注视镜头 | 高 |
| 嘴型与台词对不上 | 高 |
| 手部变形/物品穿模 | 中 |
| 背景模糊融化感 | 中 |
| 光源方向在同一幕内变化 | 低 |
| 发丝/边缘有 AI 特征模糊 | 低 |

---

### 快速评分表

```
视频 ID：___________
类型：□ Podcast  □ Story  □ Edu  □ Remix-换主体  □ Remix-仿写

钩子（0-3s）：   [ 1 | 2 | 3 | 4 | 5 ]  备注：
叙事结构：       [ 差 | 中 | 优 ]        备注：
视觉一致性：     [ 差 | 中 | 优 ]        备注：
运镜节奏：       [ 差 | 中 | 优 ]        备注：
BGM 适配：       [ 差 | 中 | 优 ]        备注：
平台适配：       [ 差 | 中 | 优 ]        备注：
AI 感知度：      [ 高 | 中 | 低 ]        备注：

总体可发布性：   □ 可直接发  □ 剪辑优化后发  □ 需重新生成

主要问题：
```

---

## 测试记录模板

### 测试执行日志

| 测试 ID | 功能 | 状态 | 备注 | 负责人 |
|---------|------|------|------|--------|
| T1 | Podcast + BGM | ⏳ 待测试 | | |
| T2 | Story 角色一致性 | ⏳ 待测试 | | |
| T3 | Edu Talk | ⏳ 待测试 | | |
| T4 | Remix - 换主体 | ⏳ 待测试 | | |
| T5 | Remix - 片段替换 AI | ⏳ 待测试 | | |
| T6 | Remix - 片段替换上传 | ⏳ 待测试 | | |
| T7 | Remix - 脚本仿写 | ⏳ 待测试 | | |
| T8 | 单片段重生成 | ⏳ 待测试 | | |
| T9 | Kling 主体注册 | ⏳ 待测试 | | |

状态图例：
- ⏳ 待测试
- ✅ 通过
- ❌ 失败
- ⚠️ 部分通过

---

## Bug 记录模板

| Bug ID | 发现日期 | 功能模块 | 严重级别 | 描述 | 重现步骤 | 状态 |
|--------|---------|---------|---------|------|---------|------|
| B001 | 2026-02-20 | Remix Wizard | 高 | 费用显示错误 | 1. 打开换主体<br>2. 查看费用 | 🔧 修复中 |

严重级别：
- **致命**: 阻塞主流程，无法绕过
- **高**: 核心功能失效
- **中**: 非核心功能异常或体验问题
- **低**: UI 小瑕疵、文案错误

---

## 附录：常见问题排查

### 问题 1: Webhook 未触发

**症状**: Job 卡在 `generating` 状态，长时间不进入 `stitching`

**排查步骤**：
1. 检查 ngrok 是否还在运行（`http://127.0.0.1:4040` 查看请求日志）
2. 检查 Kling webhook URL 是否正确（`NEXT_PUBLIC_APP_URL/api/webhooks/kling?whs=...`）
3. 查看 `npm run dev` 终端输出是否有 webhook 请求日志
4. 检查 `KLING_WEBHOOK_SECRET` 是否匹配

---

### 问题 2: BGM 未混入视频

**症状**: 最终视频没有背景音乐

**排查步骤**：
1. 检查 job.script 中是否有 `bgm` 字段
2. 查看 stitch route 日志，确认 `dominantBgm()` 返回值
3. 检查 BGM URL 是否可访问（curl 测试）
4. 验证 FFmpeg 是否有 `amix` filter 支持

---

### 问题 3: Gemini Vision 分析超时

**症状**: 脚本仿写 Tab 分析卡住或超时

**排查步骤**：
1. 检查视频 URL 是否可下载（curl 测试）
2. 检查 `/tmp` 目录是否有足够空间
3. 验证 `GEMINI_API_KEY` 是否有效
4. 查看 analyze route 日志，确认 FFmpeg 提取帧是否成功
5. 尝试手动调用 Gemini Vision API 测试连通性

---

### 问题 4: TypeScript 编译错误

**症状**: `npm run build` 失败

**排查步骤**：
1. 运行 `npx tsc --noEmit` 查看详细错误
2. 检查是否有未导出的类型引用
3. 确认所有 import 路径正确
4. 清理 `.next` 缓存：`rm -rf .next && npm run build`

---

## 测试完成标准

所有测试项满足以下条件视为通过：

- [ ] 所有 P0 测试通过（Podcast / Story / Edu Talk）
- [ ] Remix 三场景全部通过
- [ ] 至少 80% 的边界测试通过（允许 2 个非关键边界用例失败）
- [ ] 所有新增自动化测试编写完成并通过
- [ ] 至少 3 个生成视频的爆款评审得分 ≥ 及格线（钩子 ≥3，其他维度 ≥中）
- [ ] 无 P0/P1 级别 Bug 遗留

---

**祝测试顺利！遇到任何问题随时记录到本文档的 Bug 记录表中。**
