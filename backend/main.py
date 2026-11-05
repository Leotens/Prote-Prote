import csv
from io import BytesIO
from math import sqrt
from typing import Annotated

import networkx as nx
from fastapi import FastAPI, Form, HTTPException, UploadFile
from fastapi.responses import HTMLResponse, Response
from matplotlib.figure import Figure
from pyvis.network import Network

app = FastAPI(title="Prote-Prote API")


@app.post("/api/datasets")
def recibir_dataset(file: UploadFile, has_header: Annotated[bool | None, Form()] = None):
    proteins, edges, row_count = read_dataset(file, has_header)
    return {
        "filename": file.filename,
        "size_bytes": file.size,
        "rows": row_count,
        "nodes": len(proteins),
        "edges": len(edges),
    }


def read_dataset(file: UploadFile, has_header: bool | None):
    filename = file.filename or ""

    if not filename.lower().endswith(".csv"):
        raise HTTPException(status_code=415, detail="Elige un archivo CSV.")

    proteins: dict[str, list[str]] = {}
    edges: dict[tuple[str, str], None] = {}
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
            source_neighbors = proteins.setdefault(source, [])
            target_neighbors = proteins.setdefault(target, [])
            edge = (source, target) if source <= target else (target, source)
            if edge not in edges:
                edges[edge] = None
                source_neighbors.append(target)
                if source != target:
                    target_neighbors.append(source)
    except (UnicodeDecodeError, csv.Error) as error:
        raise HTTPException(status_code=422, detail="El CSV no se pudo leer.") from error

    if not edges:
        raise HTTPException(status_code=422, detail="El CSV no tiene interacciones.")

    return proteins, edges, row_count


def largest_component(proteins: dict[str, list[str]]) -> list[str]:
    visited: set[str] = set()
    largest: list[str] = []
    for start in proteins:
        if start in visited:
            continue

        stack = [start]
        visited.add(start)
        component = []
        while stack:
            node = stack.pop()
            component.append(node)
            for neighbor in proteins[node]:
                if neighbor not in visited:
                    visited.add(neighbor)
                    stack.append(neighbor)

        if len(component) > len(largest):
            largest = component

    return largest


def render_graph_image(nodes: list[str], edges: list[tuple[str, str]]) -> Response:
    graph = nx.Graph()
    graph.add_nodes_from(nodes)
    graph.add_edges_from(edges)
    positions = nx.spring_layout(graph, seed=42, k=0.20, iterations=50)
    show_labels = len(nodes) <= 20
    node_size = max(28, 900 / sqrt(len(nodes)))

    figure = Figure(figsize=(10, 8))
    axes = figure.subplots()
    nx.draw_networkx_edges(
        graph, positions, ax=axes, edge_color="#164c5c",
        width=1.4 if show_labels else 0.65, alpha=0.65 if show_labels else 0.4,
        node_size=node_size,
    )
    nx.draw_networkx_nodes(
        graph, positions, ax=axes, node_color="#ff8539",
        node_size=node_size, edgecolors="#fff3dd",
        linewidths=1.3 if show_labels else 0.45,
    )
    if show_labels:
        for protein_id, position in positions.items():
            axes.annotate(
                protein_id, position, xytext=(0, -sqrt(node_size) / 2 - 5),
                textcoords="offset points", ha="center", va="top",
                fontsize=16 if len(nodes) == 1 else 12, color="#12333f",
                bbox={"boxstyle": "round,pad=0.3", "fc": "#e4f7fb", "ec": "none"},
                annotation_clip=False, parse_math=False,
            )

    axes.margins(0.15)
    axes.set_axis_off()

    with BytesIO() as output:
        figure.savefig(output, format="png", backend="agg", transparent=True, bbox_inches="tight", dpi=160)
        return Response(output.getvalue(), media_type="image/png")


@app.post("/api/datasets/graph")
def generate_graph(
    file: UploadFile,
    has_header: Annotated[bool, Form()],
    node_limit: Annotated[int, Form(ge=1, le=1500)],
    interactive: Annotated[bool, Form()] = True,
):
    proteins, edges, _ = read_dataset(file, has_header)
    component = largest_component(proteins)
    nodes = component[:node_limit]
    selected = set(nodes)
    visible_edges = [(source, target) for source, target in edges if source in selected and target in selected]
    if not interactive:
        return render_graph_image(nodes, visible_edges)

    net = Network(
        height="100vh",
        width="100%",
        cdn_resources="in_line",
        bgcolor="transparent",
    )

    for protein_id in nodes:
        net.add_node(protein_id, label=protein_id,
                     color="#ff8539", title=protein_id)

    for source, target in visible_edges:
        net.add_edge(source, target)

    styles = """
    <style>
      html, body {
        margin: 0;
        overflow: hidden;
        background: transparent;
      }

      body > .card,
      #mynetwork {
        background: transparent;
        border: 0;
        padding: 0;
      }

      #loadingBar {
        display: none !important;
      }
    </style>
    """

    html = net.generate_html()
    html = html.replace("</head>", styles + "</head>", 1)
    ready_script = """
    <script>
      function notifyGraphReady() {
        window.parent.postMessage('prote-prote:graph-ready', '*');
      }

      if (nodes.length <= 1) {
        notifyGraphReady();
      } else {
        network.once('stabilizationIterationsDone', notifyGraphReady);
      }
    </script>
    """
    document, closing_tag, tail = html.rpartition("</body>")
    html = document + ready_script + closing_tag + tail
    return HTMLResponse(html)
