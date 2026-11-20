import { useCallback, useEffect, useRef, useState } from "react"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"

export function useConfirmDialog() {
  const [message, setMessage] = useState<string | null>(null)
  const pending = useRef<((confirmed: boolean) => void) | null>(null)

  const finish = useCallback((confirmed: boolean) => {
    const resolve = pending.current
    pending.current = null
    setMessage(null)
    resolve?.(confirmed)
  }, [])

  useEffect(
    () => () => {
      pending.current?.(false)
      pending.current = null
    },
    []
  )

  const confirm = useCallback((question: string): Promise<boolean> => {
    if (pending.current) return Promise.resolve(false)
    setMessage(question)
    return new Promise((resolve) => {
      pending.current = resolve
    })
  }, [])

  const dialog = (
    <AlertDialog
      open={message !== null}
      onOpenChange={(open) => {
        if (!open) finish(false)
      }}
    >
      <AlertDialogContent className="max-w-md">
        <AlertDialogTitle className="text-lg font-semibold">
          Bestätigung
        </AlertDialogTitle>
        <AlertDialogDescription className="mt-2 text-sm text-muted-foreground">
          {message}
        </AlertDialogDescription>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => finish(false)}>
            Abbrechen
          </Button>
          <Button type="button" onClick={() => finish(true)}>
            Bestätigen
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  )

  return { confirm, dialog }
}
