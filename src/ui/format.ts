const KB = 1024;

export function summarize(values: Record<string, string | boolean>): string {
  return Object.entries(values)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(', ');
}

export function formatSize(bytes: number): string {
  if (bytes >= KB * KB) return `${(bytes / KB / KB).toFixed(1)} MB`;
  if (bytes >= KB) return `${Math.round(bytes / KB)} KB`;
  return `${bytes} B`;
}
