export function relativeAge(postedAt: string | null, now: Date = new Date()): string {
  if (!postedAt) return ''
  const posted = new Date(postedAt)
  if (Number.isNaN(posted.getTime())) return ''
  const ms = now.getTime() - posted.getTime()
  const days = Math.floor(ms / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${days}d`
}
