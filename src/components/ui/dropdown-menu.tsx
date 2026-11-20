import { Menu } from "@base-ui/react/menu"
import { cn } from "cn"

export const DropdownMenu = Menu.Root
export const DropdownMenuTrigger = Menu.Trigger

export function DropdownMenuContent({ className, ...props }: Menu.Popup.Props) {
  return (
    <Menu.Portal>
      <Menu.Positioner align="start" className="z-50" sideOffset={4}>
        <Menu.Popup
          className={cn(
            "w-56 rounded-2xl border border-border bg-popover p-2 text-popover-foreground shadow-xl outline-none",
            className
          )}
          {...props}
        />
      </Menu.Positioner>
    </Menu.Portal>
  )
}

export function DropdownMenuItem({ className, ...props }: Menu.Item.Props) {
  return (
    <Menu.Item
      className={cn(
        "flex cursor-default items-center gap-3 rounded-xl px-3 py-2 text-sm outline-none select-none data-highlighted:bg-muted",
        className
      )}
      {...props}
    />
  )
}
