import { useEffect, useRef } from "react"
import { Check, CircleAlert, X } from "lucide-react"
import { Button } from "@/components/ui/button"

const AUTO_DISMISS_MS = { success: 4000, error: 7000 }

export function Toast({
  message,
  onClose,
  variant = "success",
}: {
  message: string | null
  onClose: () => void
  variant?: "success" | "error"
}) {
  const isError = variant === "error"
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!message) {
      return
    }

    const timeoutId = window.setTimeout(
      () => onCloseRef.current(),
      AUTO_DISMISS_MS[variant]
    )
    return () => window.clearTimeout(timeoutId)
  }, [message, variant])

  if (!message) {
    return null
  }

  return (
    <div
      aria-live={isError ? "assertive" : "polite"}
      className={`fixed top-4 left-1/2 z-[60] flex w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 rounded-xl py-3 pr-2 pl-4 text-sm font-medium text-white shadow-xl ring-1 ring-black/10 sm:top-6 ${
        isError ? "bg-[#a32d2d]" : "bg-[#2b3a55]"
      }`}
      role={isError ? "alert" : "status"}
    >
      {isError ? (
        <CircleAlert
          aria-hidden="true"
          className="size-4 shrink-0 text-[#ffd0d0]"
        />
      ) : (
        <Check aria-hidden="true" className="size-4 shrink-0 text-[#a9c4f5]" />
      )}
      <span>{message}</span>
      <Button
        aria-label="Meldung schließen"
        className="size-7 shrink-0 rounded-lg p-0 text-white hover:bg-white/15 hover:text-white"
        onClick={onClose}
        type="button"
        variant="ghost"
      >
        <X aria-hidden="true" className="size-4" />
      </Button>
    </div>
  )
}
