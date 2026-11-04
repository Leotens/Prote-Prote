import csv
from typing import Annotated

from fastapi import FastAPI, Form, HTTPException, UploadFile

app = FastAPI(title="Prote-Prote API")


@app.post("/api/datasets")
def recibir_dataset(file: UploadFile, has_header: Annotated[bool | None, Form()] = None):
    filename = file.filename or ""

    if not filename.lower().endswith(".csv"):
        raise HTTPException(status_code=415, detail="Elige un archivo CSV.")

    proteins = set()
    edges = set()
    row_count = 0

    try:
        lines = (line.decode("utf-8-sig") for line in file.file)
        for index, row in enumerate(csv.reader(lines, strict=True)):
            skip_header = has_header if has_header is not None else row == ["protein_a_id", "protein_b_id"]
            if index == 0 and skip_header:
                continue

            if len(row) != 2 or not all(value.strip() for value in row):
                raise HTTPException(
                    status_code=422,
                    detail="Cada fila debe tener dos identificadores de proteína.",
                )

            source, target = (value.strip() for value in row)
            row_count += 1
            proteins.update((source, target))
            edges.add(tuple(sorted((source, target))))
    except (UnicodeDecodeError, csv.Error) as error:
        raise HTTPException(status_code=422, detail="El CSV no se pudo leer.") from error

    if not edges:
        raise HTTPException(status_code=422, detail="El CSV no tiene interacciones.")

    return {
        "filename": filename,
        "size_bytes": file.size,
        "rows": row_count,
        "nodes": len(proteins),
        "edges": len(edges),
    }
