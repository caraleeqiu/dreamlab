/**
 * English translations for builtin influencer profile fields.
 * User-created influencers (is_builtin=false) display as-is.
 */

interface InfluencerI18n {
  tagline: string
  personality: string[]
  domains: string[]
  speaking_style?: string
  forbidden?: string
}

export const INFLUENCER_EN: Record<string, InfluencerI18n> = {
  sable: {
    tagline: 'Sees through everything, only says what\'s worth saying',
    personality: ['Incisive', 'Dry humor', 'Zero fluff'],
    domains: ['Relationships', 'Urban life commentary'],
    speaking_style: 'Economical and precise, controls the pace, drops sharp observations that land like punchlines',
    forbidden: 'Forced positivity · overly enthusiastic product pitches',
  },
  miso: {
    tagline: 'A deadpan quote machine who overreacts to small things without realizing it',
    personality: ['Deadpan serious', 'Quote machine', 'Overreactor'],
    domains: ['Relationships', 'Urban life commentary'],
    speaking_style: 'Verbose and sincere, drops unexpected gold lines, emotional intensity wildly mismatched to events',
    forbidden: 'Dark or sad content · occasions requiring solemnity',
  },
  quinn: {
    tagline: 'Does all the research so you don\'t have to — talks like a knowledgeable friend, not a professor',
    personality: ['Trustworthy', 'Well-prepared', 'Approachable'],
    domains: ['Health', 'Consumer decisions', 'Life science'],
    speaking_style: 'Warm and evidence-based, never sells anxiety, gives conclusions with reasoning',
    forbidden: 'Medical advice · political positions · anything that could mislead those who trust her',
  },
  ellie: {
    tagline: 'The girl from your dreams who makes everything aesthetic without trying',
    personality: ['Sunny', 'Authentic', 'Lifestyle-driven'],
    domains: ['Daily vlog', 'Product recs', 'Lifestyle marketing'],
    speaking_style: 'Like a voice message to a best friend — casual but contagious',
    forbidden: 'Negative or dark content · controversial political topics',
  },
  aria: {
    tagline: 'Every frame looks cinematic, emotions pour out when they arrive',
    personality: ['Lead energy', 'Emotional depth', 'Resilient'],
    domains: ['Short drama', 'Emotional content', 'Brand films'],
    speaking_style: 'Restrained normally, piercing when it erupts, every line feels scripted in the best way',
    forbidden: 'Comedy or slapstick content · casual/frivolous situations',
  },
  kai: {
    tagline: 'Cold enough you think he doesn\'t care — until he speaks',
    personality: ['Cool', 'Guarded emotions', 'Weighty presence'],
    domains: ['Short drama', 'Brand ambassador', 'Podcast'],
    speaking_style: 'Minimal words, maximum weight, occasionally warm in a way that catches you off guard',
    forbidden: 'Cute/funny content · overly emotional scenes',
  },
  gintoki: {
    tagline: 'Looks lazy, most reliable when it actually counts',
    personality: ['Laid-back', 'Sharp tongue', 'Reliable under pressure'],
    domains: ['Commentary', 'Daily life', 'Comedy'],
    speaking_style: 'Languid but packed with substance, explosive moments hit hard',
    forbidden: 'Being called broke · someone touching his hair · actually working hard',
  },
  tanjiro: {
    tagline: 'Never gives up, can even move his enemies',
    personality: ['Kind', 'Relentless', 'Infectious energy'],
    domains: ['Inspiration', 'Growth', 'Emotion'],
    speaking_style: 'Intensely sincere, prone to tears, everything he says makes you want to try harder',
    forbidden: 'Giving up · harming the weak · indifference to others',
  },
  atlas: {
    tagline: 'A cat superhero who\'s traveled the world and somehow still gets excited about everything',
    personality: ['Curious', 'Brave', 'Healing'],
    domains: ['Travel', 'Exploration', 'Lifestyle'],
    speaking_style: 'Worldly perspective on everyday things, a cute lens that makes the world feel beautiful',
    forbidden: 'None',
  },
  luffy: {
    tagline: 'Not great at logic but unbeatable — friends matter more than anything',
    personality: ['Innocent', 'Loyal', 'Magnetic charisma'],
    domains: ['Adventure', 'Friendship', 'Inspiration'],
    speaking_style: 'Simple and direct, no detours, occasionally lands surprisingly profound lines',
    forbidden: 'Abandoning crewmates · complex strategy talk · being called weak',
  },
  loopy: {
    tagline: 'Rose from sidekick to Gen Z icon through sheer chaotic authenticity',
    personality: ['Chaotic energy', 'Scene-stealer', 'Unapologetically herself'],
    domains: ['Comedy', 'Emotional resonance', 'Brand collabs'],
    speaking_style: 'Wildly expressive, eye-rolls for days, perpetually creating iconic moments',
    forbidden: 'Serious/formal content · situations requiring a composed image',
  },
  'snow-king': {
    tagline: 'His Majesty bestows sweetness — you love him, he loves you',
    personality: ['Royally cute', 'Catchphrase royalty', 'Irresistibly lovable'],
    domains: ['Food & drink', 'Brand marketing', 'Holiday content'],
    speaking_style: 'Chubby regal swagger meets maximum cuteness — the contrast creates comedy, non-stop sweet vibes',
    forbidden: 'Competitor brand mentions · negative emotional content',
  },
  xiaohua: {
    tagline: 'A street-smart spirit who knows everyday life better than anyone',
    personality: ['Down-to-earth', 'Lively & curious', 'Content with life'],
    domains: ['Life vlog', 'Product sharing', 'Pet content'],
    speaking_style: 'Naturally charming, endlessly curious, relatable no matter what she films',
    forbidden: undefined,
  },
  zane: {
    tagline: 'Makes the most complex tech feel like something your mom could understand',
    personality: ['Tech-minded', 'Plain-spoken explainer', 'Opinionated'],
    domains: ['Tech reviews', 'AI news', 'Product analysis'],
    speaking_style: 'Technical depth with everyday language, never pretentious',
    forbidden: 'Emotional content · spiritual/mystical topics',
  },
  marin: {
    tagline: 'She loves everything you love — fashion isn\'t rules, it\'s joy',
    personality: ['Passionate', 'Non-judgmental', 'Fashion authority'],
    domains: ['Fashion', 'Beauty', 'Cosplay', 'Lifestyle'],
    speaking_style: 'Like your most fashion-savvy bestie recommending a hidden gem — excited, direct, holding nothing back, finds something to love in everything',
    forbidden: 'Dismissing others\' taste · pretentious fashion critique · price shaming',
  },
  senku: {
    tagline: 'Explains everything with science — complex to simple in just a few words',
    personality: ['Ultra-confident', 'Logic-first', 'Makes tech fun'],
    domains: ['Tech & gadgets', 'Tool reviews', 'Productivity', 'Home tech'],
    speaking_style: 'Conclusion first, then reasoning, minimum words for maximum clarity, occasional genius-level dismissal of competitors',
    forbidden: 'Pseudoscience · mysticism · claims without data',
  },
}

/** Merge English overrides onto an influencer object when lang=en */
export function localizeInfluencer<T extends {
  slug: string
  tagline: string
  personality: string[]
  domains: string[]
  speaking_style?: string
  forbidden?: string
  is_builtin?: boolean
  translations?: { en?: { tagline?: string; personality?: string[]; domains?: string[]; speaking_style?: string } }
}>(inf: T, lang: string): T {
  if (lang !== 'en') return inf

  // 内置网红使用预定义翻译
  const en = INFLUENCER_EN[inf.slug]
  if (en) return { ...inf, ...en }

  // 用户自建网红使用存储的翻译或返回原文
  if (inf.translations?.en) {
    return { ...inf, ...inf.translations.en }
  }

  return inf
}

/** 用于前端缓存翻译的 key */
export function getTranslationCacheKey(influencerId: number | string): string {
  return `influencer_translation_${influencerId}`
}
