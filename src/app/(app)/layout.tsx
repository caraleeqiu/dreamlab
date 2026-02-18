import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/layout/sidebar'
import CreditBadge from '@/components/layout/credit-badge'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('credits, display_name, language')
    .eq('id', user.id)
    .single()

  return (
    <div className="flex h-screen bg-zinc-950">
      <Sidebar language={profile?.language ?? 'zh'} />
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* 顶部栏 */}
        <header className="h-14 border-b border-zinc-800 flex items-center justify-between px-4 md:px-6 shrink-0">
          {/* Mobile: Dreamlab logo */}
          <div className="md:hidden flex items-center gap-2">
            <span className="font-bold text-white text-sm">Dreamlab</span>
          </div>
          <div className="hidden md:block" />
          <CreditBadge credits={profile?.credits ?? 0} />
        </header>
        {/* 主内容区 — 底部加 padding 避免被手机底栏遮挡 */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-6">
          {children}
        </main>
      </div>
    </div>
  )
}
