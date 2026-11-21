import unittest
from base64 import b64decode
from io import BytesIO

from fastapi import UploadFile

from main import generate_comparison_subgraph, multi_source_neighborhood


class ComparisonSubgraphTests(unittest.TestCase):
    def dataset(self):
        return UploadFile(
            filename="proteins.csv",
            file=BytesIO(b"A,C\nA,D\nA,F\nB,C\nB,E\nB,G\nD,H\nE,I\n"),
        )

    def test_multi_source_bfs_includes_both_origins_and_balances_limit(self):
        proteins = {
            "A": ["C", "D", "F"], "B": ["C", "E", "G"],
            "C": ["A", "B"], "D": ["A"], "E": ["B"],
            "F": ["A"], "G": ["B"],
        }
        nodes = multi_source_neighborhood(proteins, ("A", "B"), 1, 6)
        self.assertEqual(nodes[:2], ["A", "B"])
        self.assertIn("D", nodes)
        self.assertIn("E", nodes)
        self.assertEqual(len(nodes), 6)

    def test_distance_two_reaches_second_level(self):
        proteins = {"A": ["C"], "B": ["D"], "C": ["A", "E"], "D": ["B", "F"], "E": ["C"], "F": ["D"]}
        self.assertEqual(set(multi_source_neighborhood(proteins, ("A", "B"), 2, 10)), set(proteins))

    def test_interactive_endpoint_returns_pyvis_html(self):
        result = generate_comparison_subgraph(self.dataset(), False, "A", "B", 1, 20, True)
        self.assertIn("prote-prote:comparison-graph-ready", result["html"])
        self.assertIn('Prote\\u00edna A: A', result["html"])
        self.assertIn('Vecino compartido: C', result["html"])
        self.assertGreaterEqual(result["node_count"], 2)

    def test_expanded_view_preserves_multi_source_network(self):
        result = generate_comparison_subgraph(self.dataset(), False, "A", "B", 1, 6, True, "expanded")
        self.assertIn("prote-prote:comparison-graph-ready", result["html"])
        self.assertEqual(result["node_count"], 6)

    def test_image_endpoint_returns_png(self):
        result = generate_comparison_subgraph(self.dataset(), False, "A", "B", 1, 20, False)
        self.assertTrue(b64decode(result["image_base64"]).startswith(b"\x89PNG\r\n\x1a\n"))


if __name__ == "__main__":
    unittest.main()
