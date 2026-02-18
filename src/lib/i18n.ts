import type { Language } from '@/types'

export const UI = {
  // ─── Nav ───────────────────────────────────────────────────────────────────
  nav: {
    home:        { zh: '主页',     en: 'Home' },
    studio:      { zh: '内容工厂', en: 'Studio' },
    influencers: { zh: '网红库',   en: 'Influencers' },
    credits:     { zh: '积分',     en: 'Credits' },
    switchLang:  { zh: '切换',     en: 'Switch' },
    logout:      { zh: '退出登录', en: 'Log out' },
  },

  // ─── Studio page ───────────────────────────────────────────────────────────
  studio: {
    title:    { zh: '内容工厂',       en: 'Studio' },
    subtitle: { zh: '选择生产线，开始创作', en: 'Choose a production line' },
    balance:  { zh: '当前余额',        en: 'Balance' },
    credits:  { zh: '积分',            en: 'credits' },
    language: { zh: '语言',            en: 'Language' },
    free:     { zh: '免费',            en: 'Free' },
    lines: {
      trending: {
        title: { zh: '看灵感',             en: 'Inspiration' },
        desc:  { zh: '浏览实时热点，发现下一个爆款话题', en: 'Browse trending topics and find your next viral idea' },
        credit:{ zh: '免费', en: 'Free' },
      },
      podcast: {
        title: { zh: '视频播客',              en: 'Video Podcast' },
        desc:  { zh: '选热点 → AI提炼要点 → 一键生成播客视频', en: 'Pick a topic → AI extracts key points → generate podcast video' },
        credit:{ zh: '20积分', en: '20 credits' },
      },
      remix: {
        title: { zh: '爆款二创',         en: 'Video Remix' },
        desc:  { zh: '上传原视频，AI改编成你的网红风格', en: 'Upload a video, AI remakes it in your influencer style' },
        credit:{ zh: '5积分', en: '5 credits' },
      },
      edu: {
        title: { zh: '网红科普',           en: 'Edu Video' },
        desc:  { zh: '输入话题，网红用自己的风格讲给你听', en: 'Enter a topic, your influencer explains it in their style' },
        credit:{ zh: '15积分', en: '15 credits' },
      },
      anime: {
        title: { zh: '动漫营销视频',            en: 'Anime Marketing' },
        desc:  { zh: '品牌产品 × AI网红 → 动漫风格营销短片', en: 'Brand product × AI influencer → anime-style marketing clip' },
        credit:{ zh: '50积分', en: '50 credits' },
      },
      story: {
        title: { zh: '故事短片',           en: 'Story Film' },
        desc:  { zh: '输入剧情创意，AI生成有叙事的剧情短片', en: 'Enter a story idea, AI generates a narrative short film' },
        credit:{ zh: '30积分', en: '30 credits' },
      },
      script: {
        title: { zh: '自定义脚本',            en: 'Custom Script' },
        desc:  { zh: '写脚本或贴稿子，AI优化后生成视频', en: 'Write or paste a script, AI optimises and generates video' },
        credit:{ zh: '15积分', en: '15 credits' },
      },
      link: {
        title: { zh: '链接提取',          en: 'Link Extract' },
        desc:  { zh: '贴URL，AI提炼内容，一键生成视频', en: 'Paste a URL, AI extracts content and generates video' },
        credit:{ zh: '15积分', en: '15 credits' },
      },
    },
  },

  // ─── Influencers page ──────────────────────────────────────────────────────
  influencers: {
    title:          { zh: '网红管理',                    en: 'Influencers' },
    subtitle:       { zh: '选择或创建你的 AI 虚拟网红',       en: 'Select or create your AI virtual influencer' },
    createBtn:      { zh: '新建网红',                   en: 'New Influencer' },
    createFree:     { zh: '（免费）',                    en: '(Free)' },
    createCost:     { zh: '（10积分）',                  en: '(10 credits)' },
    searchPlaceholder: { zh: '搜索网红...',              en: 'Search influencers...' },
    mySection:      { zh: '我的网红',                   en: 'My Influencers' },
    firstFree:      { zh: '首个免费',                   en: 'First one free' },
    builtinSection: { zh: '官方内置网红 · 免费使用（带水印）', en: 'Official Influencers · Free (watermarked)' },
    deleteConfirm:  { zh: '确定删除该网红？积分不退还。',  en: 'Delete this influencer? Credits are non-refundable.' },
  },

  // ─── Jobs page ─────────────────────────────────────────────────────────────
  jobs: {
    title:       { zh: '任务',               en: 'Jobs' },
    subtitle:    { zh: '视频生成记录 · 每10秒自动刷新', en: 'Video generation history · refreshes every 10s' },
    empty:       { zh: '还没有任务',          en: 'No jobs yet' },
    goCreate:    { zh: '去内容工厂创建',       en: 'Create in Studio' },
    untitled:    { zh: '无标题',             en: 'Untitled' },
    credits:     { zh: '积分',              en: 'credits' },
    backToList:  { zh: '返回任务列表',        en: 'Back to jobs' },
    jobNotFound: { zh: '任务不存在',          en: 'Job not found' },
    status: {
      pending:    { zh: '等待中',   en: 'Pending' },
      scripting:  { zh: '生成脚本', en: 'Scripting' },
      generating: { zh: '生成视频', en: 'Generating' },
      lipsync:    { zh: '口型对齐', en: 'Lip Sync' },
      stitching:  { zh: '合并中',  en: 'Stitching' },
      done:       { zh: '完成',    en: 'Done' },
      failed:     { zh: '失败',    en: 'Failed' },
    },
    types: {
      podcast: { zh: '视频播客', en: 'Podcast' },
      remix:   { zh: '爆款二创', en: 'Remix' },
      edu:     { zh: '网红科普', en: 'Edu Video' },
      anime:   { zh: '动漫营销', en: 'Anime' },
      trending:{ zh: '看灵感',   en: 'Trending' },
      story:   { zh: '故事短片', en: 'Story' },
      script:  { zh: '自定义脚本', en: 'Script' },
      link:    { zh: '链接提取', en: 'Link' },
    },
    downloadClip: { zh: '下载切片', en: 'Download clip' },
    downloadAll:  { zh: '下载全部', en: 'Download all' },
  },

  // ─── Credits page ──────────────────────────────────────────────────────────
  credits: {
    title:       { zh: '积分中心',   en: 'Credits' },
    balance:     { zh: '当前积分',   en: 'Balance' },
    unit:        { zh: '积分',       en: 'credits' },
    buyTitle:    { zh: '购买积分',   en: 'Buy Credits' },
    history:     { zh: '消耗记录',   en: 'History' },
    noHistory:   { zh: '暂无记录',   en: 'No history yet' },
    devTopup:    { zh: '快速充值 +200（开发模式）', en: 'Dev Top-up +200' },
    packages: {
      starter:  { zh: '入门包', en: 'Starter' },
      standard: { zh: '标准包', en: 'Standard' },
      pro:      { zh: '专业包', en: 'Pro' },
      team:     { zh: '团队包', en: 'Team' },
    },
    popular:     { zh: '热门', en: 'Popular' },
    bonus:       { zh: '赠', en: '+' },
    buyBtn:      { zh: '购买', en: 'Buy' },
    payError:    { zh: '创建支付失败', en: 'Payment failed' },
  },

  // ─── Podcast wizard ────────────────────────────────────────────────────────
  podcast: {
    steps: {
      zh: ['选话题', '确认要点', '节目设置', '预览脚本', '分镜预览', '生成视频'],
      en: ['Topic', 'Key Points', 'Setup', 'Script', 'Storyboard', 'Generate'],
    },
    trendingMode: { zh: '🔥 热点话题', en: '🔥 Trending' },
    customMode:   { zh: '✍️ 自己写',   en: '✍️ Write your own' },
    customPlaceholder: {
      zh: '直接粘贴文章链接、描述话题，或贴入脚本文本...',
      en: 'Paste an article URL, describe a topic, or paste a script...',
    },
    selected:     { zh: '已选', en: 'Selected' },
    topicsOf:     { zh: '/2 个话题', en: '/2 topics' },
    topicsMerge:  { zh: '（AI将融合为一期）', en: '(AI will merge into one episode)' },
    extracting:   { zh: 'AI 提炼要点中...', en: 'AI extracting key points...' },
    perspective:  { zh: '本期视角：', en: "This episode's angle: " },
    keypointsOf:  { zh: '/6 个要点', en: '/6 key points' },
    addKpPlaceholder: { zh: '补充一个要点（选填）', en: 'Add a key point (optional)' },
    addKpBtn:     { zh: '加入', en: 'Add' },
    showType:     { zh: '节目类型', en: 'Show type' },
    solo:         { zh: '🎤 单口', en: '🎤 Solo' },
    dialogue:     { zh: '🎙️ 对谈', en: '🎙️ Dialogue' },
    platform:     { zh: '发布平台', en: 'Platform' },
    duration:     { zh: '时长', en: 'Duration' },
    refAccount:   { zh: '参考账号（选填）', en: 'Reference account (optional)' },
    refPlaceholder:{ zh: '贴入 @handle 或账号链接', en: 'Paste @handle or profile URL' },
    pickInfluencer:{ zh: '选网红', en: 'Choose influencer' },
    recommended:  { zh: '推荐', en: 'Recommended' },
    allInfluencers:{ zh: '全部网红', en: 'All influencers' },
    scriptLoading: { zh: 'AI 生成脚本中...', en: 'AI generating script...' },
    storyboardLoading: { zh: '生成分镜中...', en: 'Generating storyboard...' },
    submitLoading: { zh: '提交生成任务...', en: 'Submitting job...' },
    prevBtn:      { zh: '上一步', en: 'Back' },
    nextBtn:      { zh: '下一步', en: 'Next' },
    confirmBtn:   { zh: '确认', en: 'Confirm' },
    generateScriptBtn: { zh: '生成脚本', en: 'Generate Script' },
    generateStoryboardBtn: { zh: '生成分镜', en: 'Generate Storyboard' },
    submitBtn:    { zh: '开始生成视频', en: 'Start Generating' },
    insufficientCredits: { zh: '积分不足，请先充值', en: 'Insufficient credits, please top up' },
    durationMin:  { zh: '分钟', en: 'min' },
    durationSec:  { zh: '秒', en: 's' },
    customDuration:{ zh: '自定义', en: 'Custom' },
  },

  // ─── Common ────────────────────────────────────────────────────────────────
  common: {
    loading:   { zh: '加载中...', en: 'Loading...' },
    error:     { zh: '出错了',   en: 'Something went wrong' },
    retry:     { zh: '重试',     en: 'Retry' },
    save:      { zh: '保存',     en: 'Save' },
    cancel:    { zh: '取消',     en: 'Cancel' },
    confirm:   { zh: '确认',     en: 'Confirm' },
    edit:      { zh: '编辑',     en: 'Edit' },
    delete:    { zh: '删除',     en: 'Delete' },
    close:     { zh: '关闭',     en: 'Close' },
    back:      { zh: '返回',     en: 'Back' },
    next:      { zh: '下一步',   en: 'Next' },
    prev:      { zh: '上一步',   en: 'Back' },
    free:      { zh: '免费',     en: 'Free' },
    credits:   { zh: '积分',     en: 'credits' },
    optional:  { zh: '选填',     en: 'optional' },
  },
} as const

/** Pick the string for the given language */
export function t(lang: Language, node: { zh: string; en: string }): string {
  return node[lang]
}
