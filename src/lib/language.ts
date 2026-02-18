import type { Language } from '@/types'

// 语言对应的发布平台选项
export const PLATFORMS: Record<Language, { value: string; label: string; aspectRatio: string; durationHint: string; icon: string }[]> = {
  zh: [
    { value: 'douyin',      label: '抖音',  aspectRatio: '9:16', durationHint: '1-3 分钟',  icon: '🎵' },
    { value: 'xiaohongshu', label: '小红书', aspectRatio: '9:16', durationHint: '1-3 分钟',  icon: '📕' },
    { value: 'bilibili',    label: 'B站',   aspectRatio: '16:9', durationHint: '8-15 分钟', icon: '📺' },
    { value: 'weibo',       label: '微博',  aspectRatio: '9:16', durationHint: '1-3 分钟',  icon: '🐦' },
  ],
  en: [
    { value: 'tiktok',    label: 'TikTok',    aspectRatio: '9:16', durationHint: '1-3 min',   icon: '🎵' },
    { value: 'youtube',   label: 'YouTube',   aspectRatio: '16:9', durationHint: '8-15 min',  icon: '📺' },
    { value: 'instagram', label: 'Instagram', aspectRatio: '9:16', durationHint: '1-3 min',   icon: '📸' },
  ],
}

// 语言对应的热点数据来源标签
export const TRENDING_SOURCES: Record<Language, string[]> = {
  zh: ['微博', '抖音', '知乎', 'B站', '今日头条', '百度', '澎湃', '36氪'],
  en: ['Hacker News', 'The Verge', 'TechCrunch', 'Wired', 'Product Hunt', 'YouTube'],
}

// 语言对应的内容分类 Tab
export const TOPIC_CATEGORIES: Record<Language, string[]> = {
  zh: ['科技', '时事政治', '娱乐', '财经', '其他'],
  en: ['Tech', 'Politics', 'Entertainment', 'Finance', 'Other'],
}

// 语言标签
export const LANGUAGE_LABELS: Record<Language, string> = {
  zh: '中文',
  en: 'English',
}
