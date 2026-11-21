import csv
from base64 import b64encode
from io import BytesIO
from math import sqrt
from collections import deque
from heapq import heappop, heappush
from typing import Annotated
from time import perf_counter

import networkx as nx
from fastapi import FastAPI, Form, HTTPException, UploadFile
from fastapi.responses import HTMLResponse, Response
from matplotlib.figure import Figure
from pyvis.network import Network

app = FastAPI(title="Prote-Prote API")

PROTEIN_SELECTION_SCRIPT = """
<script>
  network.on('selectNode', function (event) {
    const node = nodes.get(event.nodes[0]);
    if (node && node.protein_details) {
      window.parent.postMessage({ type: 'prote-prote:protein-selected', details: node.protein_details }, '*');
    }
  });
</script>
"""

GRAPH_CONTROLS_SCRIPT = """
<script>
  window.addEventListener('message', function (event) {
    if (event.source !== window.parent || !event.data || event.data.type !== 'prote-prote:graph-control') return;
    const action = event.data.action;
    if (action === 'zoom-in') network.moveTo({scale: network.getScale() * 1.2});
    else if (action === 'zoom-out') network.moveTo({scale: network.getScale() / 1.2});
    else if (action === 'fit') network.fit();
    else if (action === 'download') {
      network.redraw();
      window.parent.postMessage({type: 'prote-prote:graph-image', image: network.canvas.frame.canvas.toDataURL('image/png')}, '*');
    }
  });
</script>
"""


class UnionFind:
    """UFDS con compresión de caminos y unión por tamaño."""

    def __init__(self, nodes):
        self.parent = {node: node for node in nodes}
        self.size = {node: 1 for node in nodes}

    def find(self, node: str) -> str:
        root = node
        while root != self.parent[root]:
            root = self.parent[root]
        while node != root:
            parent = self.parent[node]
            self.parent[node] = root
            node = parent
        return root

    def union(self, first: str, second: str) -> None:
        root_a = self.find(first)
        root_b = self.find(second)
        if root_a == root_b:
            return
        if self.size[root_a] < self.size[root_b]:
            root_a, root_b = root_b, root_a
        self.parent[root_b] = root_a
        self.size[root_a] += self.size[root_b]

    def component_size(self, node: str) -> int:
        return self.size[self.find(node)]


def compare_proteins(
    proteins: dict[str, list[str]],
    edges: dict[tuple[str, str], None],
    protein_a: str,
    protein_b: str,
) -> dict:
    protein_a, protein_b = protein_a.strip(), protein_b.strip()
    if not protein_a or not protein_b:
        raise HTTPException(status_code=422, detail="Ingresa los identificadores de ambas proteínas.")
    for protein_id in (protein_a, protein_b):
        if protein_id not in proteins:
            raise HTTPException(status_code=404, detail=f"No se encontró la proteína {protein_id} en el dataset.")

    ufds = UnionFind(proteins)
    for source, target in edges:
        ufds.union(source, target)

    neighbors_a = set(proteins[protein_a])
    neighbors_b = set(proteins[protein_b])
    shared_neighbors = sorted(neighbors_a & neighbors_b)
    root_a = ufds.find(protein_a)
    root_b = ufds.find(protein_b)

    def details(protein_id: str, neighbors: set[str], root: str) -> dict:
        return {
            "id": protein_id,
            "degree": len(neighbors) + (1 if protein_id in neighbors else 0),
            "neighbors": sorted(neighbors),
            "component_id": root,
            "component_size": ufds.component_size(protein_id),
        }

    result_a = details(protein_a, neighbors_a, root_a)
    result_b = details(protein_b, neighbors_b, root_b)
    return {
        "protein_a": result_a,
        "protein_b": result_b,
        "shared_neighbors": shared_neighbors,
        "shared_neighbors_count": len(shared_neighbors),
        "degree_difference": abs(result_a["degree"] - result_b["degree"]),
        "directly_connected": protein_b in neighbors_a,
        "same_component": root_a == root_b,
    }


def protein_details(proteins: dict[str, list[str]], nodes: list[str], component_size: int) -> dict:
    selected = set(nodes)
    details = {}
    for node in nodes:
        neighbors = [neighbor for neighbor in proteins[node] if neighbor in selected]
        details[node] = {
            "id": node,
            "degree": len(neighbors) + (1 if node in neighbors else 0),
            "neighbors": neighbors,
            "component": "Principal",
            "component_size": component_size,
        }
    return details


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


@app.post("/api/datasets/compare")
def compare_dataset_proteins(
    file: UploadFile,
    has_header: Annotated[bool, Form()],
    protein_a: Annotated[str, Form()],
    protein_b: Annotated[str, Form()],
):
    proteins, edges, _ = read_dataset(file, has_header)
    started = perf_counter()
    result = compare_proteins(proteins, edges, protein_a, protein_b)
    result["elapsed_ms"] = (perf_counter() - started) * 1000
    return result


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

    details = protein_details(proteins, nodes, len(component))
    for protein_id in nodes:
        net.add_node(protein_id, label=protein_id,
                     color="#ff8539", title=protein_id, protein_details=details[protein_id])

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
    html = document + ready_script + PROTEIN_SELECTION_SCRIPT + closing_tag + tail
    return HTMLResponse(html)


@app.post("/api/datasets/subgraph")
def generate_subgraph(
    file: UploadFile,
    has_header: Annotated[bool, Form()],
    protein_id: Annotated[str, Form()],
    distance: Annotated[int, Form(ge=1, le=3)],
    node_limit: Annotated[int, Form(ge=1, le=1500)],
    interactive: Annotated[bool, Form()] = True,
    include_details: Annotated[bool, Form()] = False,
):
    proteins, edges, _ = read_dataset(file, has_header)
    protein_id = protein_id.strip()
    if not protein_id:
        raise HTTPException(status_code=422, detail="Ingresa un identificador de proteína.")
    if protein_id not in proteins:
        raise HTTPException(status_code=404, detail=f"No se encontró la proteína {protein_id} en el dataset.")

    component = largest_component(proteins)
    graph_nodes = component[:node_limit]
    graph_node_set = set(graph_nodes)
    if protein_id not in graph_node_set:
        raise HTTPException(
            status_code=422,
            detail=f"La proteína {protein_id} no está entre los {node_limit} nodos del grafo generado. Aumenta el límite de nodos y vuelve a generarlo.",
        )

    distances = {protein_id: 0}
    queue = deque([protein_id])
    while queue:
        node = queue.popleft()
        if distances[node] == distance:
            continue
        for neighbor in proteins[node]:
            if neighbor in graph_node_set and neighbor not in distances:
                distances[neighbor] = distances[node] + 1
                queue.append(neighbor)

    nodes = list(distances)
    selected = set(nodes)
    visible_edges = [(source, target) for source, target in edges if source in selected and target in selected]
    details = protein_details(proteins, graph_nodes, len(component))
    if not interactive:
        image = render_graph_image(nodes, visible_edges)
        if include_details:
            return {"details": details[protein_id], "image_base64": b64encode(image.body).decode("ascii")}
        return image

    html = render_subgraph_html(nodes, visible_edges, protein_id, details)
    if include_details:
        return {"details": details[protein_id], "html": html.body.decode("utf-8")}
    return html


def render_subgraph_html(nodes: list[str], edges: list[tuple[str, str]], origin: str, details: dict | None = None, highlights: dict[str, str] | None = None) -> HTMLResponse:
    net = Network(height="100vh", width="100%", cdn_resources="in_line", bgcolor="transparent")
    net.set_options('{"physics":{"stabilization":{"iterations":100,"updateInterval":25}}}')
    for node in nodes:
        is_origin = node == origin
        color = (highlights or {}).get(node, "#1550bd" if is_origin else "#ff8539")
        net.add_node(node, label=node, color=color, title=f"Proteína de origen: {node}" if is_origin else node, size=32 if is_origin or node in (highlights or {}) else 22, protein_details=details.get(node) if details else None)
    for source, target in edges:
        net.add_edge(source, target)

    styles = """
    <style>
      html, body { margin: 0; overflow: hidden; background: transparent; }
      body > .card, #mynetwork { background: transparent; border: 0; padding: 0; }
      #loadingBar { display: none !important; }
    </style>
    """
    html = net.generate_html().replace("</head>", styles + "</head>", 1)
    ready_script = """
    <script>
      function notifyGraphReady() { window.parent.postMessage('prote-prote:graph-ready', '*'); }
      if (nodes.length <= 1) { notifyGraphReady(); }
      else { network.once('stabilizationIterationsDone', notifyGraphReady); }
    </script>
    """
    document, closing_tag, tail = html.rpartition("</body>")
    return HTMLResponse(document + ready_script + PROTEIN_SELECTION_SCRIPT + GRAPH_CONTROLS_SCRIPT + closing_tag + tail)


def shortest_path(proteins: dict[str, list[str]], selected: set[str], origin: str, destination: str) -> list[str]:
    parents: dict[str, str | None] = {origin: None}
    queue = deque([origin])
    while queue:
        node = queue.popleft()
        if node == destination:
            path = []
            while node is not None:
                path.append(node)
                node = parents[node]
            return path[::-1]
        for neighbor in proteins[node]:
            if neighbor in selected and neighbor not in parents:
                parents[neighbor] = node
                queue.append(neighbor)
    return []


@app.post("/api/datasets/proteins")
def list_proteins(file: UploadFile, has_header: Annotated[bool, Form()]):
    proteins, _, _ = read_dataset(file, has_header)
    return {"proteins": sorted(proteins)}


def prim_mst(nodes: list[str], edges: list[tuple[str, str, int]], start: str) -> tuple[list[tuple[str, str]], int]:
    # Adaptación del Ejercicio 3: lista de adyacencia, key, parent y min-heap.
    # heapq reemplaza decreaseKey con nuevas entradas; se omiten las ya visitadas.
    adjacency: dict[str, list[tuple[str, int]]] = {node: [] for node in nodes}
    for source, target, weight in edges:
        adjacency[source].append((target, weight))
        adjacency[target].append((source, weight))

    key = {node: float('inf') for node in nodes}
    parent: dict[str, str | None] = {node: None for node in nodes}
    order = {node: index for index, node in enumerate(nodes)}
    key[start] = 0
    heap = [(0, order[start], start)]
    visited: set[str] = set()
    tree = []
    total_weight = 0
    while heap:
        weight, _, node = heappop(heap)
        if node in visited:
            continue
        visited.add(node)
        if parent[node] is not None:
            tree.append((parent[node], node))
            total_weight += weight
        for neighbor, edge_weight in adjacency[node]:
            if neighbor not in visited and edge_weight < key[neighbor]:
                key[neighbor] = edge_weight
                parent[neighbor] = node
                heappush(heap, (edge_weight, order[neighbor], neighbor))

    if len(visited) != len(nodes):
        raise ValueError('Prim requiere un subgrafo conectado.')
    return tree, total_weight


def compare_proteins(proteins: dict[str, list[str]], protein_a: str, protein_b: str) -> dict:
    protein_a, protein_b = protein_a.strip(), protein_b.strip()
    if not protein_a or not protein_b:
        raise HTTPException(status_code=422, detail="Ingresa las dos proteínas que deseas comparar.")
    for protein_id in (protein_a, protein_b):
        if protein_id not in proteins:
            raise HTTPException(status_code=404, detail=f"No se encontró la proteína {protein_id} en el dataset.")
    if protein_a == protein_b:
        raise HTTPException(status_code=422, detail="Selecciona dos proteínas diferentes.")

    components: dict[str, int] = {}
    sizes: dict[int, int] = {}
    for start in proteins:
        if start in components:
            continue
        component_id = len(sizes) + 1
        stack = [start]
        components[start] = component_id
        size = 0
        while stack:
            node = stack.pop()
            size += 1
            for neighbor in proteins[node]:
                if neighbor not in components:
                    components[neighbor] = component_id
                    stack.append(neighbor)
        sizes[component_id] = size

    def details(node: str):
        neighbors = proteins[node]
        return {
            "id": node,
            "degree": len(neighbors) + (1 if node in neighbors else 0),
            "neighbor_count": len(neighbors),
            "component": components[node],
            "component_size": sizes[components[node]],
        }

    neighbors_a, neighbors_b = set(proteins[protein_a]), set(proteins[protein_b])
    centers = {protein_a, protein_b}
    shared = sorted((neighbors_a & neighbors_b) - centers)
    detail_a, detail_b = details(protein_a), details(protein_b)

    def neighborhood(center: str) -> dict:
        nodes = [center, *sorted(set(proteins[center]) - {center})]
        selected = set(nodes)
        edges = set()
        for source in nodes:
            for target in proteins[source]:
                if target in selected:
                    edges.add(tuple(sorted((source, target))))
        # El dataset es no ponderado: todas las asociaciones tienen peso 1.
        tree, total_weight = prim_mst(nodes, [(a, b, 1) for a, b in sorted(edges)], center)
        return {
            "nodes": nodes, "edges": tree, "original_edge_count": len(edges),
            "mst_weight": total_weight, "edge_weight": 1,
        }

    return {
        "protein_a": detail_a,
        "protein_b": detail_b,
        "shared_neighbors": shared,
        "degree_difference": abs(detail_a["degree"] - detail_b["degree"]),
        "same_component": components[protein_a] == components[protein_b],
        "directly_connected": protein_b in neighbors_a,
        "graph_a": neighborhood(protein_a),
        "graph_b": neighborhood(protein_b),
    }


@app.post("/api/datasets/compare")
def compare_dataset_proteins(
    file: UploadFile,
    has_header: Annotated[bool, Form()],
    protein_a: Annotated[str, Form()],
    protein_b: Annotated[str, Form()],
):
    proteins, _, _ = read_dataset(file, has_header)
    result = compare_proteins(proteins, protein_a, protein_b)
    for side in ("a", "b"):
        graph = result[f"graph_{side}"]
        center = result[f"protein_{side}"]["id"]
        colors = {node: "#9be775" for node in result["shared_neighbors"]}
        colors[center] = "#1550bd" if side == "a" else "#0bc5c7"
        html = render_subgraph_html(graph["nodes"], graph["edges"], center, highlights=colors)
        graph["html"] = html.body.decode("utf-8")
    return result


@app.post("/api/datasets/shortest-path")
def generate_shortest_path(
    file: UploadFile,
    has_header: Annotated[bool, Form()],
    origin: Annotated[str, Form()],
    destination: Annotated[str, Form()],
    node_limit: Annotated[int, Form(ge=1, le=1500)],
    interactive: Annotated[bool, Form()] = True,
):
    proteins, _, _ = read_dataset(file, has_header)
    origin, destination = origin.strip(), destination.strip()
    if not origin or not destination:
        raise HTTPException(status_code=422, detail="Ingresa las proteínas de origen y destino.")
    selected = set(largest_component(proteins)[:node_limit])
    for protein_id in (origin, destination):
        if protein_id not in proteins:
            raise HTTPException(status_code=404, detail=f"No se encontró la proteína {protein_id} en el dataset.")
        if protein_id not in selected:
            raise HTTPException(status_code=422, detail=f"La proteína {protein_id} no está entre los {node_limit} nodos del grafo generado. Aumenta el límite de nodos y vuelve a generarlo.")

    started = perf_counter()
    path = shortest_path(proteins, selected, origin, destination)
    elapsed_ms = (perf_counter() - started) * 1000
    result = {"path": path, "length": len(path) - 1 if path else None, "elapsed_ms": elapsed_ms}
    if not path:
        return result

    path_edges = list(zip(path, path[1:]))
    if interactive:
        result["html"] = render_subgraph_html(path, path_edges, origin).body.decode("utf-8")
    else:
        result["image_base64"] = b64encode(render_graph_image(path, path_edges).body).decode("ascii")
    return result
