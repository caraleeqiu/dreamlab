// ─── 积分消耗配置（集中管理，避免各 route 硬编码）─────────────────────────────
export const CREDIT_COSTS = {
  script:                   15,
  podcast:                  20,
  edu:                      15,
  edu_talk:                 15,
  edu_animated:             30,
  edu_paper:                40,
  edu_cinematic:            20,
  anime:                    50,
  story:                    30,
  remix:                     5,
  link:                     15,
  create_influencer:        10,
  generate_influencer_image: 3,
  generate_influencer_tts:   2,
} as const

// ─── 充值套餐配置 ─────────────────────────────────────────────────────────────
export const CREDIT_PACKAGES = {
  starter:  { credits: 100,  bonus: 0,   price: 990,   name: '入门包 100积分' },
  standard: { credits: 300,  bonus: 30,  price: 2500,  name: '标准包 300+30积分' },
  pro:      { credits: 800,  bonus: 100, price: 5900,  name: '专业包 800+100积分' },
  team:     { credits: 2000, bonus: 300, price: 12800, name: '团队包 2000+300积分' },
} as const

export type CreditPackageId = keyof typeof CREDIT_PACKAGES

// ─── Kling 回调 URL ────────────────────────────────────────────────────────────
export function getCallbackUrl(): string {
  return `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/kling`
}
