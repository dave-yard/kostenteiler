import { useEffect, useState } from "react"
import {
  ExternalLink,
  FileQuestion,
  FileText,
  Image as ImageIcon,
  LoaderCircle,
} from "lucide-react"
import { useExpenseLists } from "@/components/contexts/ExpenseListContext"
import type { ReceiptImageResult } from "@/services/itemService"

interface ReceiptPreviewProps {
  itemId: string | null | undefined
  fallbackItemId?: string | null | undefined
  className?: string
}

export function ReceiptPreview({
  itemId,
  fallbackItemId,
  className = "",
}: ReceiptPreviewProps) {
  const { getReceiptImage } = useExpenseLists()
  const [receipt, setReceipt] = useState<ReceiptImageResult | null>(null)
  const [receiptSourceId, setReceiptSourceId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [openError, setOpenError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    async function loadReceipt() {
      setReceipt(null)
      setReceiptSourceId(null)
      setOpenError(null)
      if (!itemId && !fallbackItemId) {
        if (isMounted) {
          setIsLoading(false)
        }
        return
      }

      setIsLoading(true)
      try {
        let result: ReceiptImageResult | null = null
        let resultSourceId: string | null = null
        if (itemId) {
          result = await getReceiptImage(itemId)
          if (result) {
            resultSourceId = itemId
          }
        }
        if (!result && fallbackItemId) {
          result = await getReceiptImage(fallbackItemId)
          if (result) {
            resultSourceId = fallbackItemId
          }
        }
        if (isMounted) {
          setReceipt(result)
          setReceiptSourceId(resultSourceId)
        }
      } catch (err) {
        console.warn("Beleg konnte nicht geladen werden:", err)
        if (isMounted) {
          setReceipt(null)
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadReceipt()

    return () => {
      isMounted = false
    }
  }, [itemId, fallbackItemId, getReceiptImage])

  async function openReceiptInNewTab() {
    if (!receiptSourceId) return

    const newTab = window.open("about:blank", "_blank")
    if (!newTab) {
      setOpenError(
        "Der Beleg konnte nicht geöffnet werden. Bitte Pop-ups für diese Seite erlauben."
      )
      return
    }

    newTab.opener = null
    setOpenError(null)

    try {
      const refreshedReceipt = await getReceiptImage(receiptSourceId, true)
      if (!refreshedReceipt) {
        newTab.close()
        setOpenError("Der Beleg konnte nicht geladen werden. Bitte erneut versuchen.")
        return
      }

      setReceipt(refreshedReceipt)
      newTab.location.href = refreshedReceipt.url
    } catch (err) {
      console.warn("Beleg konnte nicht zum Öffnen aktualisiert werden:", err)
      newTab.close()
      setOpenError("Der Beleg konnte nicht geladen werden. Bitte erneut versuchen.")
    }
  }

  if (isLoading) {
    return (
      <div
        className={`flex items-center justify-center gap-2 rounded-xl border border-border bg-muted/40 p-4 text-xs text-muted-foreground ${className}`}
      >
        <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
        <span>Beleg wird geprüft ...</span>
      </div>
    )
  }

  if (!receipt) {
    return (
      <div
        className={`flex items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/40 p-4 text-xs text-muted-foreground ${className}`}
      >
        <FileQuestion aria-hidden="true" className="size-4 shrink-0" />
        <span>Keine Datei vorhanden</span>
      </div>
    )
  }

  return (
    <div
      className={`flex flex-col gap-2 rounded-xl border border-border bg-card p-3 shadow-xs lg:sticky lg:top-4 lg:h-full lg:max-h-[calc(100vh-2rem)] lg:min-h-0 ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
          {receipt.isPdf ? (
            <FileText
              aria-hidden="true"
              className="size-3.5 text-brand-primary"
            />
          ) : (
            <ImageIcon
              aria-hidden="true"
              className="size-3.5 text-brand-primary"
            />
          )}
          {receipt.isPdf ? "Beleg (PDF)" : "Beleg (Bild)"}
        </span>
        <a
          className="inline-flex items-center gap-1 text-xs text-brand-text hover:underline"
          href={receipt.url}
          onClick={(event) => {
            event.preventDefault()
            void openReceiptInNewTab()
          }}
          rel="noopener noreferrer"
          target="_blank"
        >
          <ExternalLink aria-hidden="true" className="size-3" />
          <span>In neuem Tab öffnen</span>
        </a>
      </div>

      {openError && (
        <p className="text-xs text-danger-text" role="alert">
          {openError}
        </p>
      )}

      {receipt.isPdf ? (
        <iframe
          className="h-72 w-full rounded-lg border border-border bg-muted/20 lg:min-h-72 lg:flex-1"
          src={receipt.url}
          title="Belegvorschau (PDF)"
        />
      ) : (
        <a
          className="group relative block overflow-hidden rounded-lg border border-border bg-black/5 lg:min-h-0 lg:flex-1 lg:overflow-y-auto"
          href={receipt.url}
          onClick={(event) => {
            event.preventDefault()
            void openReceiptInNewTab()
          }}
          rel="noopener noreferrer"
          target="_blank"
          title="Klicken, um in neuem Tab zu öffnen"
        >
          <img
            alt="Beleg"
            className="h-auto w-full object-contain transition duration-200 group-hover:scale-[1.02]"
            loading="lazy"
            src={receipt.url}
          />
        </a>
      )}
    </div>
  )
}
