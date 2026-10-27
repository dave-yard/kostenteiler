import { ArrowLeft, ReceiptText } from "lucide-react"
import { ExpenseListStatusBadge } from "@/components/ExpenseListStatusBadge"
import { Button } from "@/components/ui/button"
import type { ExpenseList, Group } from "@/types/group"

const dateFormat = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" })

export function ExpenseListDetail({
  group,
  list,
  onBack,
}: {
  group: Group
  list: ExpenseList
  onBack: () => void
}) {
  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-3xl border border-[#e8ebe5] bg-white p-6 shadow-[0_12px_36px_-30px_rgba(32,36,31,0.35)] sm:p-10">
      <div className="shrink-0">
        <Button
          className="mb-8 h-auto p-0 text-sm font-medium text-[#54705a] hover:bg-transparent hover:text-[#263f2e]"
          onClick={onBack}
          type="button"
          variant="ghost"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Zu den Ausgabenlisten
        </Button>

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-[#72766f]">{group.name}</p>
            <h1 className="text-2xl font-semibold tracking-[-0.04em] break-words">
              {list.name}
            </h1>
            <p className="mt-1 text-xs text-[#72766f]">
              Erstellt am {dateFormat.format(new Date(list.createdAt))}
              {list.completedAt &&
                ` · Erledigt am ${dateFormat.format(new Date(list.completedAt))}`}
              {list.paidAt &&
                ` · Bezahlt am ${dateFormat.format(new Date(list.paidAt))}`}
            </p>
          </div>
          <ExpenseListStatusBadge status={list.status} />
        </div>

        <div className="mt-7 border-b border-[#eef0eb] pb-4">
          <h2 className="font-semibold">Positionen</h2>
        </div>
      </div>

      <div className="mt-4 min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-y-contain">
        <div className="rounded-2xl border border-dashed border-[#d7ded3] bg-[#fafbf9] px-5 py-10 text-center">
          <ReceiptText
            aria-hidden="true"
            className="mx-auto mb-2 size-6 text-[#72766f]"
          />
          <p className="font-medium">Noch keine Positionen</p>
          <p className="mt-1 text-sm text-[#72766f]">
            Positionen und Aufteilungen werden hier in einem nächsten Schritt
            ergänzt.
          </p>
        </div>
      </div>
    </section>
  )
}
