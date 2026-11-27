import unittest
from io import BytesIO

from fastapi import HTTPException, UploadFile

from main import UnionFind, compare_dataset_proteins, compare_dataset_proteins_mst, compare_proteins, read_dataset


class ProteinComparisonTests(unittest.TestCase):
    def dataset(self):
        return UploadFile(
            filename="proteins.csv",
            file=BytesIO(b"A,C\nA,D\nB,C\nB,E\nD,E\nX,Y\n"),
        )

    def test_union_find_compresses_paths_and_tracks_component_size(self):
        ufds = UnionFind(["A", "B", "C", "D"])
        ufds.union("A", "B")
        ufds.union("C", "D")
        ufds.union("B", "C")

        self.assertEqual(ufds.find("A"), ufds.find("D"))
        self.assertEqual(ufds.component_size("C"), 4)

    def test_comparison_returns_shared_neighbors_and_ufds_components(self):
        proteins, edges, _ = read_dataset(self.dataset(), False)
        result = compare_proteins(proteins, edges, " A ", " B ")

        self.assertEqual(result["shared_neighbors"], ["C"])
        self.assertEqual(result["shared_neighbors_count"], 1)
        self.assertEqual(result["degree_difference"], 0)
        self.assertFalse(result["directly_connected"])
        self.assertTrue(result["same_component"])
        self.assertEqual(result["protein_a"]["degree"], 2)
        self.assertEqual(result["protein_a"]["component_size"], 5)
        self.assertEqual(result["protein_b"]["component_size"], 5)

    def test_disconnected_proteins_have_different_components(self):
        proteins, edges, _ = read_dataset(self.dataset(), False)
        result = compare_proteins(proteins, edges, "A", "X")

        self.assertFalse(result["same_component"])
        self.assertEqual(result["protein_a"]["component_size"], 5)
        self.assertEqual(result["protein_b"]["component_size"], 2)

    def test_endpoint_includes_elapsed_time(self):
        result = compare_dataset_proteins(self.dataset(), False, "A", "B")
        self.assertGreaterEqual(result["elapsed_ms"], 0)

    def test_mst_endpoint_embeds_node_details_in_both_graphs(self):
        result = compare_dataset_proteins_mst(self.dataset(), False, "A", "B")

        self.assertIn('"protein_details"', result["graph_a"]["html"])
        self.assertIn('"protein_details"', result["graph_b"]["html"])

    def test_empty_and_unknown_proteins_are_rejected(self):
        proteins, edges, _ = read_dataset(self.dataset(), False)
        for protein_a, protein_b, status in [("", "B", 422), ("A", "missing", 404)]:
            with self.subTest(protein_a=protein_a, protein_b=protein_b):
                with self.assertRaises(HTTPException) as error:
                    compare_proteins(proteins, edges, protein_a, protein_b)
                self.assertEqual(error.exception.status_code, status)


if __name__ == "__main__":
    unittest.main()
