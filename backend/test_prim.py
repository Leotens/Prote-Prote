import unittest

import networkx as nx

from main import prim_mst


class PrimTests(unittest.TestCase):
    def test_chooses_minimum_weight_edges_and_updates_parents(self):
        nodes = ["A", "B", "C", "D"]
        edges = [("A", "B", 4), ("A", "C", 1), ("C", "B", 2), ("B", "D", 1), ("C", "D", 5)]
        tree, weight = prim_mst(nodes, edges, "A")
        self.assertEqual(tree, [("A", "C"), ("C", "B"), ("B", "D")])
        self.assertEqual(weight, 4)

    def test_matches_exercise_3_weighted_graph_from_every_start(self):
        nodes = list("abcdefg")
        edges = [("a", "b", 1), ("a", "c", 5), ("b", "c", 4), ("b", "d", 8), ("b", "e", 7), ("c", "d", 6), ("c", "f", 2), ("d", "e", 11), ("d", "f", 9), ("e", "f", 3), ("e", "g", 10), ("f", "g", 12)]
        graph = nx.Graph()
        graph.add_weighted_edges_from(edges)
        expected = nx.minimum_spanning_tree(graph).size(weight="weight")
        for start in nodes:
            with self.subTest(start=start):
                edges_mst, weight = prim_mst(nodes, edges, start)
                self.assertEqual(weight, expected)
                tree = nx.Graph()
                tree.add_nodes_from(nodes)
                tree.add_edges_from(edges_mst)
                self.assertTrue(nx.is_tree(tree))

    def test_unit_weights_keep_every_node_without_cycles(self):
        nodes = ["A", "B", "C"]
        tree, weight = prim_mst(nodes, [("A", "A", 1), ("A", "B", 1), ("B", "C", 1), ("A", "C", 1)], "B")
        self.assertEqual(len(tree), len(nodes) - 1)
        self.assertEqual(weight, 2)
        self.assertTrue(nx.is_tree(nx.Graph(tree)))

    def test_one_node_and_disconnected_graph(self):
        self.assertEqual(prim_mst(["A"], [("A", "A", 1)], "A"), ([], 0))
        with self.assertRaises(ValueError):
            prim_mst(["A", "B"], [], "A")


if __name__ == "__main__":
    unittest.main()
