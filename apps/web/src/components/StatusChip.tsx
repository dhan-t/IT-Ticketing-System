type Status = "Open" | "In Progress" | "Escalated" | "Resolved" | "Closed";

const STYLES: Record<Status, string> = {
  Open: "bg-m-primary-container text-m-on-primary-container",
  "In Progress": "bg-m-tertiary-container text-m-on-tertiary-container",
  Escalated: "bg-m-error-container text-m-on-error-container",
  Resolved: "bg-m-secondary-container text-m-on-secondary-container",
  Closed: "bg-m-surface-variant text-m-on-surface-variant",
};

export default function StatusChip({ status }: { status: Status }) {
  return (
    <span
      className={`inline-flex items-center rounded-m-sm px-3 py-1 text-xs font-medium ${STYLES[status]}`}
    >
      {status}
    </span>
  );
}
