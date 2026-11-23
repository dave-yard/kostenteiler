import type { RecurringInterval } from "@/types/group"

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

export function getDaysInMonth(year: number, monthIndex: number): number {
  // monthIndex: 0 = Januar, ..., 11 = Dezember
  // Tag 0 des Folgemonats liefert die Anzahl der Tage des Zielmonats
  return new Date(year, monthIndex + 1, 0).getDate()
}

export function getEffectiveDayOfMonth(
  year: number,
  monthIndex: number,
  preferredDay: number
): number {
  const maxDays = getDaysInMonth(year, monthIndex)
  return Math.min(preferredDay, maxDays)
}

/**
 * Berechnet das nächste Fälligkeitsdatum einer wiederkehrenden Liste.
 * Berücksichtigt Monatsende und Schaltjahre gemäß FR-5.2:
 * Fällt ein Stichtag im Zielmonat weg (z. B. der 31. oder der 29. Feb),
 * wird der letzte Kalendertag dieses Monats gewählt.
 */
export function calculateNextPeriodDate(
  startDate: Date | string,
  interval: RecurringInterval,
  preferredDayOfMonth?: number | null
): Date {
  const current = typeof startDate === "string" ? new Date(startDate) : new Date(startDate)
  const baseYear = current.getFullYear()
  const baseMonth = current.getMonth()
  const targetDay = preferredDayOfMonth ?? current.getDate()

  let nextYear = baseYear
  let nextMonth = baseMonth

  switch (interval) {
    case "monthly":
      nextMonth += 1
      break
    case "quarterly":
      nextMonth += 3
      break
    case "yearly":
      nextYear += 1
      break
  }

  // Überlauf von Monaten ausgleichen (z.B. Monat 12 -> Jahr + 1, Monat 0)
  while (nextMonth > 11) {
    nextMonth -= 12
    nextYear += 1
  }

  const effectiveDay = getEffectiveDayOfMonth(nextYear, nextMonth, targetDay)
  return new Date(nextYear, nextMonth, effectiveDay, current.getHours(), current.getMinutes(), current.getSeconds())
}

/**
 * Prüft, ob eine neue Periode fällig ist.
 */
export function isPeriodDue(
  periodStartDate: Date | string,
  interval: RecurringInterval,
  preferredDayOfMonth?: number | null,
  referenceDate: Date = new Date()
): boolean {
  const nextDate = calculateNextPeriodDate(periodStartDate, interval, preferredDayOfMonth)
  return referenceDate.getTime() >= nextDate.getTime()
}

const MONTH_NAMES_DE = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
]

/**
 * Formatiert den Namen einer Folgeperiode.
 * Wenn der Name z.B. "Miete" ist, wird bei monatlich "Miete (März 2026)" daraus,
 * bei quartalsweise "Miete (Q2 2026)" und bei jährlich "Miete (2027)".
 */
export function formatPeriodName(
  baseName: string,
  periodDate: Date | string,
  interval: RecurringInterval
): string {
  const date = typeof periodDate === "string" ? new Date(periodDate) : periodDate
  const cleanBase = baseName.replace(/\s*\([^)]+\)$/, "").trim()
  const year = date.getFullYear()

  switch (interval) {
    case "monthly": {
      const monthName = MONTH_NAMES_DE[date.getMonth()]
      return `${cleanBase} (${monthName} ${year})`
    }
    case "quarterly": {
      const quarter = Math.floor(date.getMonth() / 3) + 1
      return `${cleanBase} (Q${quarter} ${year})`
    }
    case "yearly":
      return `${cleanBase} (${year})`
  }
}
