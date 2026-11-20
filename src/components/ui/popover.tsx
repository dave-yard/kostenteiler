import { Popover as PopoverPrimitive } from "@base-ui/react/popover"
import { cn } from "cn"

export const Popover = PopoverPrimitive.Root
export const PopoverTrigger = PopoverPrimitive.Trigger

export function PopoverContent({
  className,
  ...props
}: PopoverPrimitive.Popup.Props) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner
        align="start"
        className="z-40"
        sideOffset={4}
      >
        <PopoverPrimitive.Popup
          className={cn(
            "rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-lg outline-none",
            className
          )}
          {...props}
        />
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  )
}
