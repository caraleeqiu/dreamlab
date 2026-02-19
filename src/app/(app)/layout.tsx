import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/layout/sidebar'
import AppHeader from '@/components/layout/app-header'
import { LanguageProvider } from '@/context/language-context'
import type { Language } from '@/types'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('credits, display_name, language')
    .eq('id', user.id)
    .single()

  const lang = (profile?.language ?? 'zh') as Language

  // Sync language to cookie so root layout can set <html lang>
  const cookieStore = await cookies()
  cookieStore.set('dreamlab-lang', lang, { path: '/', maxAge: 60 * 60 * 24 * 365 })

  return (
    <LanguageProvider lang={lang}>
    <div className="flex h-screen bg-zinc-950">
      <Sidebar language={lang} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <AppHeader credits={profile?.credits ?? 0} />
        {/* 主内容区 — 底部加 padding 避免被手机底栏遮挡 */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-6">
          {children}
        </main>
      </div>
    </div>
    </LanguageProvider>
  )
}
