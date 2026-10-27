import { describe, expect, it } from "vitest"
import { parseAmountToCents } from "./money"

describe("parseAmountToCents", () => {
  it.each([
    ["12,50", 1250],
    ["12.50", 1250],
    ["12", 1200],
    ["0,29", 29],
    ["0.29", 29],
    ["0,5", 50],
    ["  7,05 ", 705],
    ["1.234,50", 123450],
    ["12.345,6", 1234560],
    ["1.234.567,89", 123456789],
    ["12.5", 1250],
    ["1234.50", 123450],
    ["1.234", 123400],
    ["1.234.567", 123456700],
  ])("wandelt %s in %i Cent um", (input, expected) => {
    expect(parseAmountToCents(input)).toBe(expected)
  })

  it.each([
    "",
    "abc",
    "0",
    "0,00",
    "-5",
    "1,234",
    "12,5,0",
    "1234.567",
    "1.2345",
    "1,234.50",
    "1.23,50",
    "12.34.567,89",
    "12.345.678,90",
  ])("lehnt %j ab", (input) => {
    expect(parseAmountToCents(input)).toBeNull()
  })
})
