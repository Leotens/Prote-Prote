interface UploadResult {
    filename: string
    size_bytes: number | null
    rows: number
    nodes: number
    edges: number
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
