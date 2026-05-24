export const DEGREE_COLORS = {
  low: '#7B8CDE',
  medium: '#C4A0E8',
  high: '#F4C87B',
}

const RECENT_DAYS = 7
const MS_PER_DAY = 24 * 60 * 60 * 1000

export function colorForDegree(degree = 0) {
  if (degree >= 9) return DEGREE_COLORS.high
  if (degree >= 3) return DEGREE_COLORS.medium
  return DEGREE_COLORS.low
}

export function sizeForDegree(degree = 0) {
  return Math.log(Math.max(0, degree) + 1) * 3 || 2
}

export function isRecentlyAdded(created, now = new Date()) {
  if (!created) return false

  const createdDate = new Date(`${created}T00:00:00`)
  if (Number.isNaN(createdDate.getTime())) return false

  const elapsed = now.getTime() - createdDate.getTime()
  return elapsed >= 0 && elapsed < RECENT_DAYS * MS_PER_DAY
}
