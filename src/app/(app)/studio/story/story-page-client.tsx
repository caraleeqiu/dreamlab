'use client'

import { useRef } from 'react'
import SeriesPanel from './series-panel'
import StoryWizard from './story-wizard'
import type { Influencer, Language } from '@/types'

interface Props {
  lang: Language
  credits: number
  influencers: Influencer[]
}

export default function StoryPageClient({ lang, credits, influencers }: Props) {
  const wizardRef = useRef<{ jumpToSeries: (name: string, episode: number) => void } | null>(null)

  function handleContinue(seriesName: string, nextEpisode: number) {
    wizardRef.current?.jumpToSeries(seriesName, nextEpisode)
    // Scroll to wizard
    document.getElementById('story-wizard')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <>
      <SeriesPanel onContinue={handleContinue} />
      <div id="story-wizard">
        <StoryWizard
          ref={wizardRef}
          lang={lang}
          credits={credits}
          influencers={influencers}
        />
      </div>
    </>
  )
}
