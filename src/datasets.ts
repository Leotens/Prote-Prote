export interface Dataset {
  name: string
  nodes?: number
  edges?: number
  averageDegree?: number
  largestComponent?: number
}

export const exampleDatasets = [
  { name: 'PP-Decagon', nodes: 19081, edges: 715612, averageDegree: 75, largestComponent: 19065 },
  { name: 'PP-Miner' },
  { name: 'PP-Pathways' },
] satisfies [Dataset, ...Dataset[]]

const countFormatter = new Intl.NumberFormat('en-US')

export function formatCount(value: number) {
  return countFormatter.format(value)
}
