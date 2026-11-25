import unittest
import json
import re
from io import BytesIO

from fastapi import HTTPException, UploadFile

from main import compare_dataset_proteins, compare_proteins, list_proteins


class ComparisonTests(unittest.TestCase):
    def graph(self):
        return {"A": ["B", "C", "D"], "B": ["A", "C"], "C": ["A", "B"], "D": ["A"], "X": ["Y"], "Y": ["X"]}

    def test_shared_neighbors_and_direct_edge(self):
        result = compare_proteins(self.graph(), " A ", "B")
        self.assertEqual(result["shared_neighbors"], ["C"])
        self.assertEqual(result["degree_difference"], 1)
        self.assertTrue(result["same_component"])
        self.assertTrue(result["directly_connected"])
        self.assertEqual(result["protein_a"]["degree"], 3)
        self.assertEqual(result["protein_a"]["component_size"], 4)
        self.assertIn("D", result["graph_a"]["nodes"])
        self.assertNotIn("D", result["graph_b"]["nodes"])

    def test_different_components_and_indirect_relation(self):
        result = compare_proteins(self.graph(), "A", "X")
        self.assertFalse(result["same_component"])
        self.assertFalse(result["directly_connected"])
        self.assertEqual(result["protein_b"]["component_size"], 2)
        self.assertNotEqual(result["protein_a"]["component"], result["protein_b"]["component"])
        indirect = compare_proteins(self.graph(), "D", "B")
        self.assertTrue(indirect["same_component"])
        self.assertFalse(indirect["directly_connected"])
        self.assertEqual(indirect["shared_neighbors"], ["A"])

    def test_invalid_inputs(self):
        for a, b, status in [("A", "A", 422), ("", "B", 422), ("A", " ", 422), ("missing", "B", 404)]:
            with self.subTest(a=a, b=b), self.assertRaises(HTTPException) as error:
                compare_proteins(self.graph(), a, b)
            self.assertEqual(error.exception.status_code, status)

    def test_all_neighbors_are_included_without_limits(self):
        shared = [f"S{i}" for i in range(20)]
        exclusive = [f"E{i}" for i in range(30)]
        graph = {"A": shared + exclusive, "B": shared}
        graph.update({node: ["A", "B"] for node in shared})
        graph.update({node: ["A"] for node in exclusive})
        result = compare_proteins(graph, "A", "B")
        self.assertEqual(len(result["shared_neighbors"]), 20)
        self.assertTrue(set(shared).issubset(result["graph_a"]["nodes"]))
        self.assertTrue(set(shared).issubset(result["graph_b"]["nodes"]))
        self.assertTrue(set(exclusive).issubset(result["graph_a"]["nodes"]))
        self.assertTrue(set(exclusive).isdisjoint(result["graph_b"]["nodes"]))
        self.assertEqual(len(result["graph_a"]["nodes"]), 51)
        self.assertEqual(len(result["graph_b"]["nodes"]), 21)
        self.assertEqual(len(result["graph_a"]["edges"]), 50)
        self.assertEqual(len(result["graph_b"]["edges"]), 20)
        self.assertEqual(result["protein_a"]["degree"], 50)
        self.assertEqual(result["protein_a"]["component_size"], 52)

    def test_csv_endpoints_deduplicate_and_list_all_components(self):
        def dataset():
            return UploadFile(filename="test.csv", file=BytesIO(b"protein_a_id,protein_b_id\nA,B\nB,A\nA,A\nX,Y\n"))
        self.assertEqual(list_proteins(dataset(), True)["proteins"], ["A", "B", "X", "Y"])
        result = compare_dataset_proteins(dataset(), True, "A", "B")
        self.assertEqual(result["protein_a"]["degree"], 3)
        self.assertEqual(result["protein_a"]["neighbor_count"], 2)
        self.assertNotIn(("A", "A"), result["graph_a"]["edges"])
        self.assertEqual(result["graph_a"]["original_edge_count"], 2)
        self.assertEqual(set(result["graph_a"]["nodes"]), {"A", "B"})
        self.assertEqual(result["shared_neighbors"], [])
        self.assertIn("prote-prote:graph-ready", result["graph_a"]["html"])
        self.assertIn("prote-prote:graph-control", result["graph_a"]["html"])

    def test_mst_removes_cycles_but_preserves_all_neighbors(self):
        graph = self.graph()
        graph["C"].append("D")
        graph["D"].append("C")
        result = compare_proteins(graph, "A", "B")
        self.assertEqual(len(result["graph_a"]["edges"]), 3)
        self.assertEqual(result["graph_a"]["original_edge_count"], 5)
        self.assertEqual(set(result["graph_a"]["nodes"]), {"A", "B", "C", "D"})
        self.assertNotIn("X", result["graph_a"]["nodes"])

    def test_interactive_view_contains_every_node_and_edge(self):
        rows = [("A", f"S{i}") for i in range(20)]
        rows += [("B", f"S{i}") for i in range(20)]
        rows += [("A", f"E{i}") for i in range(30)]
        rows += [("E29", "S19")]
        content = "\n".join(f"{a},{b}" for a, b in rows).encode()
        file = UploadFile(filename="test.csv", file=BytesIO(content))
        result = compare_dataset_proteins(file, False, "A", "B")
        for side, count, edge_count, center, color in [("a", 51, 50, "A", "#ff941f"), ("b", 21, 20, "B", "#20c9c3")]:
            with self.subTest(side=side):
                graph = result[f"graph_{side}"]
                html = graph["html"]
                nodes = json.loads(re.search(r"nodes = new vis.DataSet\((.*?)\);", html, re.S).group(1))
                edges = json.loads(re.search(r"edges = new vis.DataSet\((.*?)\);", html, re.S).group(1))
                self.assertEqual({node["id"] for node in nodes}, set(graph["nodes"]))
                self.assertEqual(len(nodes), count)
                self.assertEqual(len(edges), edge_count)
                colors = {node["id"]: node["color"] for node in nodes}
                self.assertEqual(colors[center], color)
                for index in range(20):
                    self.assertEqual(colors[f"S{index}"], "#7a68cf")
                if side == "a":
                    self.assertEqual(colors["E29"], "#83cfee")
                    self.assertNotIn({"E29", "S19"}, [{edge["from"], edge["to"]} for edge in edges])
                else:
                    self.assertNotIn("E29", colors)



if __name__ == "__main__":
    unittest.main()
