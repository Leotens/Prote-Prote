interface UploadResult {
    filename: string
    size_bytes: number | null
    rows: number
    nodes: number
    edges: number
}

export interface ProteinDetails {
    id: string
    degree: number
    neighbors: string[]
    component: string
    component_size: number
}

type GraphResponse = ({ html: string } | { image: Blob }) & { details?: ProteinDetails }

export interface ShortestPathResult {
    path: string[]
    length: number | null
    elapsed_ms: number
    html?: string
    image_base64?: string
}

export async function requestDatasetShortestPath(
    file: File,
    hasHeader: boolean,
    origin: string,
    destination: string,
    nodeLimit: number,
    interactive: boolean,
    signal: AbortSignal,
): Promise<ShortestPathResult> {
    const body = new FormData()
    body.append('file', file)
    body.append('has_header', String(hasHeader))
    body.append('origin', origin)
    body.append('destination', destination)
    body.append('node_limit', String(nodeLimit))
    body.append('interactive', String(interactive))

    const response = await fetch('/api/datasets/shortest-path', { method: 'POST', body, signal })
    if (!response.ok) {
        let message = `No se pudo encontrar el camino (HTTP ${response.status}).`
        try {
            const result = await response.json() as { detail?: string }
            if (typeof result.detail === 'string') message = result.detail
        } catch { /* Conserva el mensaje HTTP si la respuesta no es JSON. */ }
        throw new Error(message)
    }
    return response.json()
}

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

export async function requestDatasetSubgraph(
    file: File,
    hasHeader: boolean,
    proteinId: string,
    distance: number,
    nodeLimit: number,
    interactive: boolean,
    signal: AbortSignal,
): Promise<GraphResponse> {
    const body = new FormData()
    body.append('file', file)
    body.append('has_header', String(hasHeader))
    body.append('protein_id', proteinId)
    body.append('distance', String(distance))
    body.append('include_details', 'true')
    body.append('node_limit', String(nodeLimit))
    body.append('interactive', String(interactive))

    const requestController = new AbortController()
    let timedOut = false
    const timeout = window.setTimeout(() => {
        timedOut = true
        requestController.abort()
    }, 60_000)
    const abortRequest = () => requestController.abort()
    signal.addEventListener('abort', abortRequest, { once: true })

    try {
        const response = await fetch('/api/datasets/subgraph', { method: 'POST', body, signal: requestController.signal })
        if (!response.ok) {
            let message = `No se pudo generar el subgrafo (HTTP ${response.status}).`
            try {
                const body = await response.json() as { detail?: string }
                if (body.detail) message = body.detail
            } catch {
                message = `No se pudo generar el subgrafo (HTTP ${response.status}).`
            }
            throw new Error(message)
        }
        const result = await response.json() as { details: ProteinDetails, html: string, image_base64: string }
        if (interactive) return { html: result.html, details: result.details }
        const bytes = Uint8Array.from(atob(result.image_base64), character => character.charCodeAt(0))
        return { image: new Blob([bytes], { type: 'image/png' }), details: result.details }
    } catch (error) {
        if (timedOut && !signal.aborted) {
            throw new Error('La generación del subgrafo tardó más de 60 segundos. Prueba con una distancia menor o desactiva el modo interactivo.')
        }
        throw error
    } finally {
        window.clearTimeout(timeout)
        signal.removeEventListener('abort', abortRequest)
    }
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
