import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { Button } from "./button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"
import { RadioGroup, RadioGroupItem } from "./radio-group"
import { SelectField } from "./select"

afterEach(cleanup)

describe("gemeinsame Controls", () => {
  it("öffnet und bedient die Select-Optionsliste per Tastatur", async () => {
    const user = userEvent.setup()
    function Example() {
      const [value, setValue] = useState("a")
      return (
        <>
          <label htmlFor="choice">Auswahl</label>
          <SelectField
            id="choice"
            value={value}
            onValueChange={setValue}
            options={[
              { value: "a", label: "Alpha" },
              { value: "b", label: "Beta" },
            ]}
          />
        </>
      )
    }

    render(<Example />)
    const trigger = screen.getByRole("combobox", { name: "Auswahl" })
    trigger.focus()
    await user.keyboard("{Enter}")
    expect(
      within(screen.getByRole("listbox")).getAllByRole("option")
    ).toHaveLength(2)
    await user.keyboard("{End}{Enter}")
    expect(trigger.textContent).toContain("Beta")
    expect(trigger.getAttribute("aria-expanded")).toBe("false")
  })

  it("bedient Menü und Popover mit Tastatur und Escape", async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(
      <>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button />}>
            Navigation
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={onSelect}>Gruppen</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Popover>
          <PopoverTrigger render={<Button />}>Filter</PopoverTrigger>
          <PopoverContent>Filteroptionen</PopoverContent>
        </Popover>
      </>
    )

    screen.getByRole("button", { name: "Navigation" }).focus()
    await user.keyboard("{Enter}")
    expect(screen.getByRole("menuitem", { name: "Gruppen" })).toBeTruthy()
    await user.keyboard("{ArrowDown}{Enter}")
    expect(onSelect).toHaveBeenCalledOnce()
    await user.click(screen.getByRole("button", { name: "Filter" }))
    expect(screen.getByText("Filteroptionen")).toBeTruthy()
    await user.keyboard("{Escape}")
    expect(screen.queryByText("Filteroptionen")).toBeNull()
  })

  it("wählt ein Mitglied über die Radio-Gruppe", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <RadioGroup aria-label="Mitglied" onValueChange={onChange}>
        <label>
          <RadioGroupItem value="a" /> Anna
        </label>
        <label>
          <RadioGroupItem value="b" /> Ben
        </label>
      </RadioGroup>
    )
    await user.click(screen.getByRole("radio", { name: "Ben" }))
    expect(onChange).toHaveBeenCalledWith("b", expect.anything())
  })
})
