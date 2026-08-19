const SIZE_UNITS = ["KB", "MB", "GB", "TB"] as const;

/**
 * Formats a byte count for display. Sizes arrive as strings because they are
 * Postgres bigints (see NodeDto), and folders have no size at all.
 */
export function formatBytes(bytes: string | null): string {
  if (bytes === null) return "—";

  const value = Number(bytes);
  if (!Number.isFinite(value) || value < 0) return "—";
  if (value < 1024) return `${value} B`;

  let size = value / 1024;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < SIZE_UNITS.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  const unit = SIZE_UNITS[unitIndex] ?? "TB";
  // One decimal below 10 ("1.4 MB"), none above it ("48 MB") - enough
  // precision to be useful without being noisy.
  return `${size < 10 ? size.toFixed(1) : Math.round(size)} ${unit}`;
}

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "—" : dateFormatter.format(date);
}
