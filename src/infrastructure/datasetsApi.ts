interface UploadResult {
    filename: string
    size_bytes: number | null
    rows: number
    nodes: number
    edges: number
}

type GraphResponse = { html: string } | { image: Blob }

export async function requestDatasetGraph(
    file: File,
    hasHeader: boolean,
    nodeLimit: number,
    interactive: boolean,
    signal: AbortSignal,
): Promise<GraphResponse> {
    const body = new FormData()
    body.append('file', file)
    body.append('has_header', String(hasHeader))
    body.append('node_limit', String(nodeLimit))
    body.append('interactive', String(interactive))

    const response = await fetch('/api/datasets/graph', { method: 'POST', body, signal })
    if (!response.ok) {
        throw new Error(`No se pudo generar el grafo (HTTP ${response.status}).`)
    }
    return interactive ? { html: await response.text() } : { image: await response.blob() }
}

export async function uploadDataset(file: File, hasHeader: boolean): Promise<UploadResult> {
    const body = new FormData()
    body.append('file', file)
    body.append('has_header', String(hasHeader))

    const response = await fetch('/api/datasets', {
        method: 'POST',
        body,
    })

    if (!response.ok) {
        throw new Error(`La carga falló (HTTP ${response.status}).`)
    }

    return response.json()
}
