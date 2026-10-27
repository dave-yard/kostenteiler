import type { ExpenseList } from "@/types/group"

const STATUS_LABELS: Record<ExpenseList["status"], string> = {
  open: "Offen",
  completed: "Erledigt",
  isPaid: "Bezahlt",
}

export function ExpenseListStatusBadge({
  status,
}: {
  status: ExpenseList["status"]
}) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
        status === "completed"
          ? "bg-[#f1f1ee] text-[#656960]"
          : "bg-[#edf3e9] text-[#31563e]"
      }`}
    >
      {STATUS_LABELS[status]}
    </span>
  )
}
