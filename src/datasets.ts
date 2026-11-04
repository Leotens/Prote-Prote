export interface Dataset {
  name: string
  nodes?: number
  edges?: number
  rows?: number
  sizeBytes?: number
}

const countFormatter = new Intl.NumberFormat('en-US')

export function formatCount(value: number) {
  return countFormatter.format(value)
}

const fileSizeFormatter = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 1 })

export function formatFileSize(bytes: number) {
  if (bytes >= 1_000_000) return `${fileSizeFormatter.format(bytes / 1_000_000)} MB`
  if (bytes >= 1_000) return `${fileSizeFormatter.format(bytes / 1_000)} kB`
  return `${fileSizeFormatter.format(bytes)} B`
}
