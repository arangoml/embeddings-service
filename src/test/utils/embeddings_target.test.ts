import { expect } from "chai";
import {db} from "@arangodb";
import * as graph_module from "@arangodb/general-graph";

import {embeddingsTargetsAreValid} from "../../utils/embeddings_target";

const TEST_GRAPH = "test_graph";
const TEST_COL = "test_col";

suite("Embeddings Target Test Suite", () => {
    test("embeddingsTarget should return true if graph and collection exist", () => {
        graph_module._create(TEST_GRAPH);
        db._create(TEST_COL);
        expect(embeddingsTargetsAreValid(TEST_GRAPH, TEST_COL)).to.equal(true);
        graph_module._drop(TEST_GRAPH);
        db._drop(TEST_COL);
    });

    test("embeddingsTarget should return false if provided graph doesn't exist (while collection exists)", () => {
        db._create(TEST_COL);
        expect(embeddingsTargetsAreValid(TEST_GRAPH, TEST_COL)).to.equal(false);
        db._drop(TEST_COL);
    });

    test("embeddingsTarget should return false if provided collection doesn't exist (while graph exists)", () => {
        graph_module._create(TEST_GRAPH);
        expect(embeddingsTargetsAreValid(TEST_GRAPH, TEST_COL)).to.equal(false);
        graph_module._drop(TEST_GRAPH);
    });

    test("embeddingsTarget should return false if provided collection + graph don't exist", () => {
        expect(embeddingsTargetsAreValid(TEST_GRAPH, TEST_COL)).to.equal(false);
    });

    test("embeddingsTarget should return true if collection exists (with missing graph)", () => {
        db._create(TEST_COL);
        expect(embeddingsTargetsAreValid(null, TEST_COL)).to.equal(true);
        db._drop(TEST_COL);
    });

    test("embeddingsTarget should return false if collection doesn't exist (with missing graph)", () => {
        expect(embeddingsTargetsAreValid(null, TEST_COL)).to.equal(false);
    });
});
