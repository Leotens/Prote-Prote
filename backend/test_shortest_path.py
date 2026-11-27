import json
import unittest
from base64 import b64decode
from io import BytesIO
from unittest.mock import ANY, patch

from fastapi import HTTPException, UploadFile
from fastapi.responses import HTMLResponse

from main import generate_shortest_path, generate_subgraph, shortest_path


class ShortestPathTests(unittest.TestCase):
    def dataset(self):
        # DFS encounters the longer branch first; BFS must choose A-D-E.
        return UploadFile(filename="proteins.csv", file=BytesIO(b"A,B\nB,C\nC,E\nA,D\nD,E\nX,Y\n"))

    def query(self, origin="A", destination="E", node_limit=5, interactive=True):
        return generate_shortest_path(self.dataset(), False, origin, destination, node_limit, interactive)

    def test_bfs_prefers_fewer_edges_and_handles_cycles(self):
        graph = {"A": ["B", "D"], "B": ["A", "C"], "C": ["B", "E"], "D": ["A", "E"], "E": ["C", "D"]}
        self.assertEqual(shortest_path(graph, set(graph), "A", "E"), ["A", "D", "E"])
        self.assertEqual(shortest_path(graph, set(graph), "E", "A"), ["E", "D", "A"])

    def test_route_renders_only_consecutive_path_edges(self):
        with patch("main.render_subgraph_html", return_value=HTMLResponse("path")) as render:
            result = self.query(origin=" A ", destination=" E ")
        self.assertEqual(result["path"], ["A", "D", "E"])
        self.assertEqual(result["length"], 2)
        self.assertGreaterEqual(result["elapsed_ms"], 0)
        render.assert_called_once_with(["A", "D", "E"], [("A", "D"), ("D", "E")], "A", ANY, {"A": "#9857c8", "E": "#20a464"})
        self.assertEqual(render.call_args.args[3]["A"]["component_size"], 5)

    def test_same_protein_has_zero_length_and_one_node(self):
        result = self.query(destination="A")
        self.assertEqual(result["path"], ["A"])
        self.assertEqual(result["length"], 0)
        self.assertIn("prote-prote:graph-ready", result["html"])

    def test_unknown_empty_and_excluded_proteins(self):
        for origin, destination, limit, status in [("missing", "E", 5, 404), (" ", "E", 5, 422), ("A", "", 5, 422), ("A", "B", 2, 422), ("X", "Y", 5, 422)]:
            with self.subTest(origin=origin, destination=destination, limit=limit):
                with self.assertRaises(HTTPException) as error:
                    self.query(origin, destination, limit)
                self.assertEqual(error.exception.status_code, status)

    def test_disconnected_search_returns_no_path(self):
        graph = {"A": ["B"], "B": ["A"], "C": []}
        self.assertEqual(shortest_path(graph, set(graph), "A", "C"), [])
        self.assertEqual(shortest_path({"A": ["A"]}, {"A"}, "A", "A"), ["A"])

    def test_interactive_and_png_responses(self):
        result = self.query()
        self.assertIn("prote-prote:graph-ready", result["html"])
        self.assertIn('"id": "D"', result["html"])
        self.assertNotIn('"id": "B"', result["html"])
        json.dumps(result)
        image = self.query(interactive=False)
        self.assertTrue(b64decode(image["image_base64"]).startswith(b"\x89PNG\r\n\x1a\n"))
        self.assertEqual(image["path"], result["path"])

    def test_neighborhood_still_renders(self):
        result = generate_subgraph(self.dataset(), False, "A", 1, 5, True)
        self.assertIn(b"prote-prote:graph-ready", result.body)


if __name__ == "__main__":
    unittest.main()
