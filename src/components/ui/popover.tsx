import { Popover as PopoverPrimitive } from "@base-ui/react/popover"
import { cn } from "cn"

export const Popover = PopoverPrimitive.Root
export const PopoverTrigger = PopoverPrimitive.Trigger

export function PopoverContent({
  className,
  align = "start",
  ...props
}: PopoverPrimitive.Popup.Props & { align?: "start" | "center" | "end" }) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner
        align={align}
        collisionPadding={12}
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
