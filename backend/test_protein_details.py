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

    def test_node_limit_scopes_neighbors_but_not_component_size(self):
        result = generate_subgraph(self.dataset(), False, "C", 1, 2, True, True)
        self.assertEqual(result["details"]["neighbors"], ["A"])
        self.assertEqual(result["details"]["degree"], 1)
        self.assertEqual(result["details"]["component_size"], 4)

    def test_image_mode_also_returns_details(self):
        result = generate_subgraph(self.dataset(), False, "C", 1, 4, False, True)
        self.assertEqual(result["details"]["id"], "C")
        self.assertTrue(b64decode(result["image_base64"]).startswith(b"\x89PNG\r\n\x1a\n"))

    def test_original_graph_can_publish_node_details(self):
        response = generate_graph(self.dataset(), False, 4, True)
        self.assertIn(b"network.on('selectNode'", response.body)
        self.assertIn(b'"component_size": 4', response.body)

    def test_zero_neighbors_and_self_loop_degree(self):
        self.assertEqual(protein_details({"A": ["B"]}, ["A"], 2)["A"]["degree"], 0)
        loop = protein_details({"A": ["A"]}, ["A"], 1)["A"]
        self.assertEqual(loop["degree"], 2)
        self.assertEqual(loop["neighbors"], ["A"])


if __name__ == "__main__":
    unittest.main()
