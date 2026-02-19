/**
 * BGM style → royalty-free audio URL
 *
 * Tracks by Kevin MacLeod (incompetech.com) licensed under Creative Commons
 * Attribution 4.0 (CC BY 4.0). Attribution required in published content.
 *
 * Replace these URLs with licensed commercial tracks for production use.
 * All URLs are cached in R2 on first download (see downloadBgm() below).
 */

export const BGM_MAP: Record<string, string> = {
  '轻松欢快': 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Ukulele.mp3',
  '科技感':   'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Digital%20Lemonade.mp3',
  '励志':     'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Strolling.mp3',
  '悬疑':     'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Investigations.mp3',
  '温馨':     'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Take%20a%20Chance.mp3',
  '紧张':     'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Dark%20Times.mp3',
  // English aliases
  'cheerful':      'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Ukulele.mp3',
  'tech':          'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Digital%20Lemonade.mp3',
  'motivational':  'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Strolling.mp3',
  'suspense':      'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Investigations.mp3',
  'warm':          'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Take%20a%20Chance.mp3',
  'tense':         'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Dark%20Times.mp3',
}

/**
 * Determine the dominant BGM style from a list of clips.
 * Returns the most-common non-empty bgm value, or null if none.
 */
export function dominantBgm(bgmValues: (string | undefined)[]): string | null {
  const counts: Record<string, number> = {}
  for (const v of bgmValues) {
    if (v) counts[v] = (counts[v] ?? 0) + 1
  }
  let best: string | null = null
  let max = 0
  for (const [k, n] of Object.entries(counts)) {
    if (n > max) { max = n; best = k }
  }
  return best
}

/**
 * Download BGM audio for a given style to a local file path.
 * Returns the file path on success, null on failure (non-fatal).
 */
export async function downloadBgm(style: string, destPath: string): Promise<boolean> {
  const url = BGM_MAP[style]
  if (!url) return false
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
    if (!res.ok) return false
    const { writeFileSync } = await import('fs')
    writeFileSync(destPath, Buffer.from(await res.arrayBuffer()))
    return true
  } catch {
    return false
  }
}
