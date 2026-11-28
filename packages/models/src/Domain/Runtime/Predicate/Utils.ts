/**
 * Predicate date strings are of form "x.days.ago" or "x.hours.ago"
 */
export function dateFromDSLDateString(string: string): Date {
  const comps = string.split('.')
  const unit = comps[1]
  const date = new Date()
  const offset = parseInt(comps[0])
  if (unit === 'days') {
    date.setDate(date.getDate() - offset)
  } else if (unit === 'hours') {
    date.setHours(date.getHours() - offset)
  } else if (unit === 'months') {
    date.setMonth(date.getMonth() - offset)
  } else if (unit === 'years') {
    date.setFullYear(date.getFullYear() - offset)
  }
  return date
}

/** A date as YYYY-MM-DD in local time. */
export function localDateString(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/**
 * In a "matches" pattern, {N.days.ago} (or hours, months, years) stands for that day written as YYYY-MM-DD
 * in local time: "^{1.years.ago}$" matches a diary note titled with the date one year ago, and
 * {0.days.ago} is today.
 */
export function replaceDatePlaceholders(pattern: string): string {
  return pattern.replace(/\{(\d+\.(?:hours|days|months|years)\.ago)\}/g, (_match, relativeDate: string) =>
    localDateString(dateFromDSLDateString(relativeDate)),
  )
}
