import Link from 'next/link'
import { Coins } from 'lucide-react'

export default function CreditBadge({ credits }: { credits: number }) {
  return (
    <Link
      href="/credits"
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-800 hover:bg-zinc-700 transition-colors text-sm font-medium text-zinc-300"
    >
      <Coins size={14} className="text-yellow-400" />
      <span>{credits} 积分</span>
    </Link>
  )
}
