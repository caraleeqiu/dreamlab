'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { PLATFORMS } from '@/lib/language'
import { UI, t } from '@/lib/i18n'
import type { Language, Influencer, ScriptClip } from '@/types'

interface Props { lang: Language; credits: number; influencers: Influencer[] }

export default function ScriptWizard({ lang, credits, influencers }: Props) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)

  const [rawScript, setRawScript] = useState('')
  const [selectedInfluencer, setSelectedInfluencer] = useState<Influencer | null>(null)
  const [refined, setRefined] = useState('')
  const [platform, setPlatform] = useState(PLATFORMS[lang][0].value)
  const [duration, setDuration] = useState(180)
  const [storyboard, setStoryboard] = useState<ScriptClip[]>([])

  const platforms = PLATFORMS[lang]
  const aspectRatio = platforms.find(p => p.value === platform)?.aspectRatio ?? '9:16'
  const STEPS = UI.wizard.scriptSteps[lang]

  async function refineScript() {
    setLoading(true)
    const inf = selectedInfluencer ?? influencers[0]
    const res = await fetch('/api/studio/script/refine', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw_script: rawScript, language: lang, influencer: inf }),
    })
    const data = await res.json()
    setRefined(data.refined || rawScript)
    setLoading(false)
  }

  async function generateStoryboard() {
    setLoading(true)
    const inf = selectedInfluencer ?? influencers[0]
    const res = await fetch('/api/studio/storyboard', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: refined, influencers: inf ? [inf] : [], platform, duration_s: duration, lang, job_type: 'script' }),
    })
    const data = await res.json()
    setStoryboard(Array.isArray(data.script) ? data.script : [])
    setLoading(false)
  }

  async function submitJob() {
    setLoading(true)
    const inf = selectedInfluencer ?? influencers[0]
    const res = await fetch('/api/studio/script', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: rawScript.slice(0, 40), platform, aspect_ratio: aspectRatio, duration_s: duration, influencer_ids: inf ? [inf.id] : [], script: storyboard, language: lang }),
    })
    const data = await res.json()
    setLoading(false)
    if (data.job_id) router.push(`/jobs/${data.job_id}`)
  }

  const tableHeaders = lang === 'zh'
    ? ['#', '景别', '运动', '台词', 'BGM', '旁白', '时长']
    : ['#', 'Shot', 'Motion', 'Dialogue', 'BGM', 'Voiceover', 'Dur']

  return (
    <div className="max-w-2xl mx-auto">
      {/* Step indicator */}
      <div className="flex items-center gap-0 mb-8">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center flex-1">
            <div className="flex flex-col items-center">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-colors
                ${i < step ? 'bg-violet-600 text-white' : i === step ? 'bg-violet-600 text-white ring-2 ring-violet-400/30' : 'bg-zinc-800 text-zinc-600'}`}>
                {i < step ? '✓' : i + 1}
              </div>
              <span className={`text-xs mt-1 whitespace-nowrap ${i === step ? 'text-white' : 'text-zinc-600'}`}>{s}</span>
            </div>
            {i < STEPS.length - 1 && <div className={`flex-1 h-px mx-1 mb-4 ${i < step ? 'bg-violet-600' : 'bg-zinc-800'}`} />}
          </div>
        ))}
      </div>

      {/* Step 0: Write script */}
      {step === 0 && (
        <div className="space-y-3">
          <p className="text-sm text-zinc-400">{t(lang, UI.wizard.scriptSubtitle)}</p>
          <Textarea
            value={rawScript} onChange={e => setRawScript(e.target.value)}
            placeholder={t(lang, UI.wizard.scriptPH)}
            className="bg-zinc-800 border-zinc-700 text-white resize-none min-h-64" rows={12}
          />
          <p className="text-xs text-zinc-600">{rawScript.length} {lang === 'zh' ? '字' : 'chars'}</p>
        </div>
      )}

      {/* Step 1: Choose influencer */}
      {step === 1 && (
        <div className="space-y-3">
          <p className="text-sm text-zinc-400">{t(lang, UI.wizard.scriptPickInf)}</p>
          <div className="grid grid-cols-3 gap-2 max-h-96 overflow-y-auto pr-1">
            {influencers.map(inf => {
              const selected = selectedInfluencer?.id === inf.id
              return (
                <button key={inf.id} onClick={() => setSelectedInfluencer(inf)}
                  className={`p-3 rounded-lg border text-left transition-all ${selected ? 'border-violet-500 bg-violet-600/10' : 'border-zinc-800 hover:border-zinc-600'}`}>
                  <div className="font-medium text-white text-sm">{inf.name}</div>
                  <div className="text-zinc-500 text-xs mt-0.5 truncate">{inf.tagline}</div>
                  {inf.speaking_style && <div className="text-zinc-700 text-xs mt-1 truncate">{inf.speaking_style}</div>}
                </button>
              )
            })}
          </div>
          {!selectedInfluencer && <p className="text-xs text-zinc-600">{t(lang, UI.wizard.noDefault)}</p>}
        </div>
      )}

      {/* Step 2: AI polish */}
      {step === 2 && (
        <div className="space-y-3">
          {loading ? (
            <div className="flex flex-col items-center py-12 gap-3 text-zinc-500">
              <Loader2 size={24} className="animate-spin text-violet-400" />
              <span className="text-sm">
                {lang === 'zh'
                  ? `AI 按照 ${(selectedInfluencer ?? influencers[0])?.name} 的风格润色中...`
                  : `AI polishing in ${(selectedInfluencer ?? influencers[0])?.name}'s style...`}
              </span>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-zinc-400">
                  {lang === 'zh'
                    ? <>已按 <span className="text-violet-400">{(selectedInfluencer ?? influencers[0])?.name}</span> 风格优化，可直接编辑</>
                    : <>Optimised for <span className="text-violet-400">{(selectedInfluencer ?? influencers[0])?.name}</span>, editable</>}
                </p>
                <Button variant="ghost" size="sm" onClick={refineScript} className="text-zinc-500 hover:text-white text-xs gap-1">
                  <RefreshCw size={12} /> {lang === 'zh' ? '重新优化' : 'Re-polish'}
                </Button>
              </div>
              <Textarea value={refined} onChange={e => setRefined(e.target.value)}
                className="bg-zinc-800 border-zinc-700 text-white resize-none min-h-64" rows={12} />
              <p className="text-xs text-zinc-600">{refined.length} {lang === 'zh' ? '字' : 'chars'}</p>
            </>
          )}
        </div>
      )}

      {/* Step 3: Setup */}
      {step === 3 && (
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm text-zinc-400">{t(lang, UI.wizard.platform)}</label>
            <div className="flex flex-wrap gap-2">
              {platforms.map(p => (
                <button key={p.value} onClick={() => setPlatform(p.value)}
                  className={`px-3.5 py-2 rounded-lg border text-sm transition-colors ${platform === p.value ? 'border-violet-500 bg-violet-600/10 text-white' : 'border-zinc-700 text-zinc-400 hover:text-white'}`}>
                  {p.label}<span className="ml-1 text-xs text-zinc-600">{p.aspectRatio}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm text-zinc-400">{t(lang, UI.wizard.duration)}</label>
            <div className="flex flex-wrap gap-2">
              {[60, 180, 300, 600].map(d => (
                <button key={d} onClick={() => setDuration(d)}
                  className={`px-3.5 py-2 rounded-lg border text-sm transition-colors ${duration === d ? 'border-violet-500 bg-violet-600/10 text-white' : 'border-zinc-700 text-zinc-400'}`}>
                  {d < 60 ? `${d}s` : `${d / 60}${t(lang, UI.wizard.min)}`}
                </button>
              ))}
            </div>
            <p className="text-xs text-zinc-600">
              {lang === 'zh' ? `约 ${Math.floor(duration / 15)} 个切片` : `~${Math.floor(duration / 15)} clips`}
            </p>
          </div>
        </div>
      )}

      {/* Step 4: Storyboard preview */}
      {step === 4 && (
        <div className="space-y-3">
          {loading ? (
            <div className="flex flex-col items-center py-12 gap-3 text-zinc-500">
              <Loader2 size={24} className="animate-spin text-violet-400" />
              <span className="text-sm">{lang === 'zh' ? 'AI 生成分镜中...' : 'AI generating storyboard...'}</span>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-zinc-500">{storyboard.length} {t(lang, UI.wizard.shots)}</p>
                <Button variant="ghost" size="sm" onClick={generateStoryboard} className="text-zinc-500 hover:text-white text-xs gap-1">
                  <RefreshCw size={12} /> {t(lang, UI.wizard.regenerateBtn)}
                </Button>
              </div>
              <div className="overflow-x-auto rounded-xl border border-zinc-800">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-zinc-800 bg-zinc-900">
                      {tableHeaders.map(h => <th key={h} className="px-3 py-2 text-left text-zinc-500 font-medium">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {storyboard.map((clip, i) => (
                      <tr key={i} className={`border-b border-zinc-800/60 ${i % 2 === 0 ? 'bg-zinc-900' : 'bg-zinc-900/50'}`}>
                        <td className="px-3 py-2 text-zinc-600">{clip.index + 1}</td>
                        <td className="px-3 py-2"><span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">{clip.shot_type || '—'}</span></td>
                        <td className="px-3 py-2"><span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">{clip.camera_movement || '—'}</span></td>
                        <td className="px-3 py-2 text-white max-w-48"><span className="line-clamp-2">{clip.dialogue}</span></td>
                        <td className="px-3 py-2 text-zinc-400">{clip.bgm || '—'}</td>
                        <td className="px-3 py-2 text-zinc-500 max-w-32"><span className="line-clamp-1">{clip.voiceover || '—'}</span></td>
                        <td className="px-3 py-2 text-zinc-600">{clip.duration}s</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* Step 5: Confirm */}
      {step === 5 && (
        <div className="space-y-6">
          <div className="p-4 rounded-xl bg-zinc-800 space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-zinc-400">{t(lang, UI.wizard.pickInfluencer)}</span><span className="text-white">{(selectedInfluencer ?? influencers[0])?.name}</span></div>
            <div className="flex justify-between"><span className="text-zinc-400">{t(lang, UI.wizard.platform)}</span><span className="text-white">{platforms.find(p => p.value === platform)?.label} ({aspectRatio})</span></div>
            <div className="flex justify-between"><span className="text-zinc-400">{t(lang, UI.wizard.duration)}</span><span className="text-white">{Math.floor(duration / 60)} {t(lang, UI.wizard.min)}</span></div>
            <div className="flex justify-between"><span className="text-zinc-400">{lang === 'zh' ? '切片数' : 'Clips'}</span><span className="text-white">{storyboard.length}</span></div>
            <div className="flex justify-between font-medium"><span className="text-zinc-400">{t(lang, UI.wizard.cost)}</span><span className="text-violet-400">15 {t(lang, UI.wizard.credits)}</span></div>
          </div>
          {credits < 15 && <p className="text-sm text-red-400">{t(lang, UI.wizard.insufficient)}<a href="/credits" className="underline ml-1">{t(lang, UI.wizard.topUp)}</a></p>}
        </div>
      )}

      {/* Bottom navigation */}
      <div className="flex justify-between mt-8 pt-6 border-t border-zinc-800">
        <Button variant="ghost" onClick={() => step === 0 ? router.back() : setStep(s => s - 1)} className="text-zinc-400 hover:text-white">
          <ChevronLeft size={16} className="mr-1" />{step === 0 ? t(lang, UI.wizard.backBtn) : t(lang, UI.wizard.prevBtn)}
        </Button>
        {step === 0 && (
          <Button onClick={() => setStep(1)} disabled={!rawScript.trim()} className="bg-violet-600 hover:bg-violet-700 text-white">
            {lang === 'zh' ? '下一步：选网红' : 'Next: Pick Influencer'}
          </Button>
        )}
        {step === 1 && (
          <Button onClick={() => { setStep(2); refineScript() }} className="bg-violet-600 hover:bg-violet-700 text-white">
            {lang === 'zh' ? 'AI 润色优化' : 'AI Polish'}
          </Button>
        )}
        {step === 2 && !loading && (
          <Button onClick={() => setStep(3)} disabled={!refined.trim()} className="bg-violet-600 hover:bg-violet-700 text-white">
            {lang === 'zh' ? '下一步：节目设置' : 'Next: Setup'}
          </Button>
        )}
        {step === 3 && (
          <Button onClick={() => { setStep(4); generateStoryboard() }} className="bg-violet-600 hover:bg-violet-700 text-white">
            {lang === 'zh' ? 'AI 生成分镜' : 'AI Storyboard'}
          </Button>
        )}
        {step === 4 && !loading && (
          <Button onClick={() => setStep(5)} disabled={storyboard.length === 0} className="bg-violet-600 hover:bg-violet-700 text-white">
            {lang === 'zh' ? '下一步：确认生成' : 'Next: Confirm'}
          </Button>
        )}
        {step === 5 && (
          <Button onClick={submitJob} disabled={loading || credits < 15} className="bg-violet-600 hover:bg-violet-700 text-white">
            {loading ? <><Loader2 size={14} className="animate-spin mr-1.5" />{t(lang, UI.wizard.generating)}</> : `${t(lang, UI.wizard.confirmBtn)} (15 ${t(lang, UI.wizard.credits)})`}
          </Button>
        )}
      </div>
    </div>
  )
}
