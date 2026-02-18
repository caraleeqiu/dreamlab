'use client'

import { createContext, useContext } from 'react'
import type { Language } from '@/types'

const LanguageContext = createContext<Language>('zh')

export function LanguageProvider({
  lang,
  children,
}: {
  lang: Language
  children: React.ReactNode
}) {
  return (
    <LanguageContext.Provider value={lang}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage(): Language {
  return useContext(LanguageContext)
}
