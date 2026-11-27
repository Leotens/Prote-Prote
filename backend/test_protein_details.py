import unittest
from base64 import b64decode
from io import BytesIO

from fastapi import UploadFile

from main import generate_graph, generate_subgraph, protein_details


class ProteinDetailsTests(unittest.TestCase):
    def dataset(self):
        return UploadFile(filename="proteins.csv", file=BytesIO(b"A,B\nA,C\nC,D\nX,Y\n"))

    def test_neighborhood_returns_central_protein_details(self):
        result = generate_subgraph(self.dataset(), False, " C ", 1, 4, True, True)
        self.assertEqual(result["details"], {
            "id": "C", "degree": 2, "neighbors": ["A", "D"],
            "component": "Principal", "component_size": 4,
        })
        self.assertIn("prote-prote:protein-selected", result["html"])
        # A has B as a neighbor in the generated graph, outside C's distance-1 view.
        self.assertIn('"neighbors": ["B", "C"]', result["html"])

    def test_node_limit_preserves_original_neighbors_and_degree(self):
        result = generate_subgraph(self.dataset(), False, "C", 1, 2, True, True)
        self.assertEqual(result["details"]["neighbors"], ["A", "D"])
        self.assertEqual(result["details"]["degree"], 2)
        self.assertEqual(result["details"]["component_size"], 4)

    def test_image_mode_also_returns_details(self):
        result = generate_subgraph(self.dataset(), False, "C", 1, 4, False, True)
        self.assertEqual(result["details"]["id"], "C")
        self.assertTrue(b64decode(result["image_base64"]).startswith(b"\x89PNG\r\n\x1a\n"))

    def test_original_graph_can_publish_node_details(self):
        response = generate_graph(self.dataset(), False, 4, True)
        self.assertIn(b"network.on('click'", response.body)
        self.assertIn(b'"component_size": 4', response.body)

    def test_original_and_neighborhood_graphs_accept_viewer_controls(self):
        responses = [
            generate_graph(self.dataset(), False, 4, True),
            generate_subgraph(self.dataset(), False, "C", 1, 4, True, False),
        ]
        for response in responses:
            with self.subTest():
                self.assertIn(b"prote-prote:graph-control", response.body)
                for action in (b"zoom-in", b"zoom-out", b"fit"):
                    self.assertIn(b"event.data.action === '" + action + b"'", response.body)

    def test_zero_neighbors_and_self_loop_degree(self):
        self.assertEqual(protein_details({"A": []}, ["A"], 1)["A"]["degree"], 0)
        self.assertEqual(protein_details({"A": ["B"]}, ["A"], 2)["A"]["degree"], 1)
        loop = protein_details({"A": ["A"]}, ["A"], 1)["A"]
        self.assertEqual(loop["degree"], 2)
        self.assertEqual(loop["neighbors"], ["A"])


if __name__ == "__main__":
    unittest.main()
