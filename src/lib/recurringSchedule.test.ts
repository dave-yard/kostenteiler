import { describe, expect, it } from "vitest"
import {
  calculateNextPeriodDate,
  formatPeriodName,
  getDaysInMonth,
  getEffectiveDayOfMonth,
  isLeapYear,
  isPeriodDue,
} from "./recurringSchedule"

describe("recurringSchedule", () => {
  describe("isLeapYear", () => {
    it("identifies leap years correctly", () => {
      expect(isLeapYear(2024)).toBe(true)
      expect(isLeapYear(2020)).toBe(true)
      expect(isLeapYear(2000)).toBe(true)
      expect(isLeapYear(2023)).toBe(false)
      expect(isLeapYear(2025)).toBe(false)
      expect(isLeapYear(2100)).toBe(false)
    })
  })

  describe("getDaysInMonth", () => {
    it("returns correct days for all months including February in leap years", () => {
      expect(getDaysInMonth(2026, 0)).toBe(31) // Januar
      expect(getDaysInMonth(2026, 1)).toBe(28) // Feb nicht-Schaltjahr
      expect(getDaysInMonth(2024, 1)).toBe(29) // Feb Schaltjahr
      expect(getDaysInMonth(2026, 3)).toBe(30) // April
    })
  })

  describe("getEffectiveDayOfMonth", () => {
    it("clamps days that do not exist in target month to the last day of month", () => {
      expect(getEffectiveDayOfMonth(2026, 1, 31)).toBe(28) // 31. Feb -> 28.
      expect(getEffectiveDayOfMonth(2024, 1, 31)).toBe(29) // 31. Feb in Schaltjahr -> 29.
      expect(getEffectiveDayOfMonth(2026, 3, 31)).toBe(30) // 31. April -> 30.
      expect(getEffectiveDayOfMonth(2026, 0, 15)).toBe(15) // 15. Jan -> 15.
    })
  })

  describe("calculateNextPeriodDate", () => {
    it("calculates next monthly date adjusting for month-end in non-leap year", () => {
      // 31. Januar 2026 -> Folgemonat Februar hat 28 Tage -> 28. Februar 2026
      const start = new Date(2026, 0, 31)
      const next = calculateNextPeriodDate(start, "monthly", 31)
      expect(next.getFullYear()).toBe(2026)
      expect(next.getMonth()).toBe(1) // Februar
      expect(next.getDate()).toBe(28)
    })

    it("calculates next monthly date adjusting for February in leap year", () => {
      // 31. Januar 2024 -> 29. Februar 2024
      const start = new Date(2024, 0, 31)
      const next = calculateNextPeriodDate(start, "monthly", 31)
      expect(next.getFullYear()).toBe(2024)
      expect(next.getMonth()).toBe(1) // Februar
      expect(next.getDate()).toBe(29)
    })

    it("calculates next monthly date for 31st into 30-day month", () => {
      // 31. März 2026 -> 30. April 2026
      const start = new Date(2026, 2, 31)
      const next = calculateNextPeriodDate(start, "monthly", 31)
      expect(next.getFullYear()).toBe(2026)
      expect(next.getMonth()).toBe(3) // April
      expect(next.getDate()).toBe(30)
    })

    it("calculates next quarterly date (3 months)", () => {
      // 31. Januar 2026 -> 30. April 2026
      const start = new Date(2026, 0, 31)
      const next = calculateNextPeriodDate(start, "quarterly", 31)
      expect(next.getFullYear()).toBe(2026)
      expect(next.getMonth()).toBe(3) // April
      expect(next.getDate()).toBe(30)
    })

    it("calculates next quarterly date wrapping over year end", () => {
      // 30. November 2026 -> 28. Februar 2027
      const start = new Date(2026, 10, 30)
      const next = calculateNextPeriodDate(start, "quarterly", 30)
      expect(next.getFullYear()).toBe(2027)
      expect(next.getMonth()).toBe(1) // Februar
      expect(next.getDate()).toBe(28)
    })

    it("calculates next yearly date handling leap year on Feb 29", () => {
      // 29. Februar 2024 (Schaltjahr) + 1 Jahr -> 28. Februar 2025
      const start = new Date(2024, 1, 29)
      const next = calculateNextPeriodDate(start, "yearly", 29)
      expect(next.getFullYear()).toBe(2025)
      expect(next.getMonth()).toBe(1)
      expect(next.getDate()).toBe(28)
    })
  })

  describe("isPeriodDue", () => {
    it("returns true when reference date is on or after next period date", () => {
      const start = new Date(2026, 0, 1) // 1. Jan
      const refDue = new Date(2026, 1, 1) // 1. Feb
      const refNotDue = new Date(2026, 0, 20) // 20. Jan

      expect(isPeriodDue(start, "monthly", 1, refDue)).toBe(true)
      expect(isPeriodDue(start, "monthly", 1, refNotDue)).toBe(false)
    })
  })

  describe("formatPeriodName", () => {
    it("formats monthly period name", () => {
      const date = new Date(2026, 1, 1) // Feb 2026
      expect(formatPeriodName("Miete", date, "monthly")).toBe("Miete (Februar 2026)")
      expect(formatPeriodName("Miete (Januar 2026)", date, "monthly")).toBe("Miete (Februar 2026)")
    })

    it("formats quarterly period name", () => {
      const date = new Date(2026, 4, 1) // Mai 2026 -> Q2
      expect(formatPeriodName("Strom", date, "quarterly")).toBe("Strom (Q2 2026)")
    })

    it("formats yearly period name", () => {
      const date = new Date(2027, 0, 1) // Jan 2027
      expect(formatPeriodName("Rundfunkbeitrag", date, "yearly")).toBe("Rundfunkbeitrag (2027)")
    })
  })
})
