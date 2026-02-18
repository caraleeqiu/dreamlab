'use client'

import { useState } from 'react'
import { Coins, Loader2, TrendingDown, TrendingUp, Gift } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLanguage } from '@/context/language-context'
import { UI, t } from '@/lib/i18n'

interface Transaction {
  id: number
  amount: number
  reason: string
  created_at: string
}

interface Props {
  credits: number
  transactions: Transaction[]
}

const PACKAGES = [
  { id: 'starter',   credits: 100,  price: 9.9,   labelKey: 'starter'  as const, popular: false, bonus: 0 },
  { id: 'standard',  credits: 300,  price: 25,    labelKey: 'standard' as const, popular: true,  bonus: 30 },
  { id: 'pro',       credits: 800,  price: 59,    labelKey: 'pro'      as const, popular: false, bonus: 100 },
  { id: 'team',      credits: 2000, price: 128,   labelKey: 'team'     as const, popular: false, bonus: 300 },
]

// Bilingual cost breakdown
const COST_ROWS = [
  { zh: '视频播客 = 20积分/次',  en: 'Video Podcast = 20 credits' },
  { zh: '爆款二创 = 5积分/次',   en: 'Viral Remix = 5 credits' },
  { zh: '网红科普 = 15积分/次',  en: 'Edu Video = 15 credits' },
  { zh: '动漫营销 = 50积分/次',  en: 'Anime Ad = 50 credits' },
]

export default function CreditsClient({ credits, transactions }: Props) {
  const lang = useLanguage()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState('')
  const isDev = process.env.NODE_ENV === 'development'

  async function handleDevTopUp() {
    setLoading('dev')
    try {
      const res = await fetch('/api/credits/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 200, reason: 'dev_topup' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      window.location.reload()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t(lang, UI.credits.payError))
    } finally {
      setLoading(null)
    }
  }

  async function handleBuy(pkg: typeof PACKAGES[0]) {
    setLoading(pkg.id)
    setError('')
    try {
      const res = await fetch('/api/credits/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId: pkg.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t(lang, UI.credits.payError))
      window.location.href = data.url
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t(lang, UI.credits.payError))
      setLoading(null)
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Coins size={22} className="text-amber-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">{t(lang, UI.credits.title)}</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {lang === 'zh' ? '购买积分用于生成视频' : 'Purchase credits to generate videos'}
          </p>
        </div>
      </div>

      {/* Balance */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-violet-900/40 to-zinc-900 border border-violet-800/50 mb-8">
        <div className="flex items-end gap-3">
          <div>
            <p className="text-sm text-zinc-400 mb-1">{t(lang, UI.credits.balance)}</p>
            <div className="text-5xl font-bold text-white">{credits}</div>
            <p className="text-sm text-zinc-500 mt-1">{t(lang, UI.credits.unit)}</p>
          </div>
          <div className="ml-auto text-right">
            <div className="text-xs text-zinc-600 space-y-1">
              {COST_ROWS.map((row, i) => (
                <div key={i}>{lang === 'zh' ? row.zh : row.en}</div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Packages */}
      <h2 className="text-sm font-medium text-zinc-400 mb-4">{t(lang, UI.credits.buyTitle)}</h2>
      <div className="grid grid-cols-2 gap-3 mb-8">
        {PACKAGES.map(pkg => (
          <div
            key={pkg.id}
            className={`relative p-4 rounded-xl border transition-all ${pkg.popular ? 'border-violet-500 bg-violet-600/10' : 'border-zinc-700 bg-zinc-900'}`}
          >
            {pkg.popular && (
              <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-violet-600 text-white text-xs font-medium">
                {t(lang, UI.credits.popular)}
              </div>
            )}
            <div className="mb-3">
              <div className="text-sm text-zinc-400">{t(lang, UI.credits.packages[pkg.labelKey])}</div>
              <div className="text-2xl font-bold text-white mt-0.5">
                {pkg.credits}
                {pkg.bonus > 0 && (
                  <span className="text-sm font-normal text-green-400 ml-1">
                    {t(lang, UI.credits.bonus)}{pkg.bonus}
                    {lang === 'zh' ? '赠送' : ' bonus'}
                  </span>
                )}
              </div>
              <div className="text-xs text-zinc-500">{t(lang, UI.credits.unit)}</div>
            </div>
            <Button
              onClick={() => handleBuy(pkg)}
              disabled={loading === pkg.id}
              className={`w-full text-sm ${pkg.popular ? 'bg-violet-600 hover:bg-violet-700 text-white' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700'}`}
            >
              {loading === pkg.id
                ? <Loader2 size={14} className="animate-spin" />
                : `¥${pkg.price}`}
            </Button>
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

      {/* Dev mode: quick top-up */}
      {isDev && (
        <div className="p-3 rounded-lg border border-dashed border-zinc-700 mb-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500">
              {lang === 'zh' ? '开发模式 · 快速充值' : 'Dev mode · Quick top-up'}
            </span>
            <Button
              onClick={handleDevTopUp}
              disabled={loading === 'dev'}
              className="h-7 text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-200"
            >
              {loading === 'dev' ? <Loader2 size={11} className="animate-spin" /> : t(lang, UI.credits.devTopup)}
            </Button>
          </div>
        </div>
      )}

      {/* New user bonus notice */}
      <div className="flex items-center gap-2 p-3 rounded-lg bg-green-900/20 border border-green-800/50 mb-8">
        <Gift size={14} className="text-green-400 shrink-0" />
        <p className="text-xs text-green-400">
          {lang === 'zh'
            ? '新用户注册即赠 20 积分 · 首个网红免费创建'
            : 'New users get 20 free credits · First influencer free'}
        </p>
      </div>

      {/* Transaction history */}
      <h2 className="text-sm font-medium text-zinc-400 mb-4">{t(lang, UI.credits.history)}</h2>
      {transactions.length === 0 ? (
        <div className="text-center py-12 text-zinc-600">
          <Coins size={32} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">{t(lang, UI.credits.noHistory)}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {transactions.map(tx => (
            <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg bg-zinc-900 border border-zinc-800">
              <div className="flex items-center gap-3">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center ${tx.amount > 0 ? 'bg-green-900/50' : 'bg-zinc-800'}`}>
                  {tx.amount > 0
                    ? <TrendingUp size={12} className="text-green-400" />
                    : <TrendingDown size={12} className="text-zinc-400" />}
                </div>
                <div>
                  <div className="text-sm text-zinc-200">{tx.reason}</div>
                  <div className="text-xs text-zinc-600">
                    {new Date(tx.created_at).toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US')}
                  </div>
                </div>
              </div>
              <span className={`text-sm font-medium ${tx.amount > 0 ? 'text-green-400' : 'text-zinc-300'}`}>
                {tx.amount > 0 ? '+' : ''}{tx.amount}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
