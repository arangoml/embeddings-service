import { expect } from "chai";
import {db} from "@arangodb";
import * as graph_module from "@arangodb/general-graph";

import {checkCollectionIsPresent, checkGraphIsPresent} from "../../utils/db";

const TEST_GRAPH = "test_graph";
const TEST_COL = "test_col";

suite("DB Utils Test Suite", () => {
    test("checkGraphIsPresent should return true if graph exists", () => {
        graph_module._create(TEST_GRAPH);
        expect(checkGraphIsPresent(TEST_GRAPH)).to.equal(true);
        graph_module._drop(TEST_GRAPH);
    });
    test("checkGraphIsPresent should return false if graph doesn't exist", () => {
        expect(checkGraphIsPresent(TEST_GRAPH)).to.equal(false);
    });

    test("checkCollectionIsPresent should return true if collection exists", () => {
        db._create(TEST_COL);
        expect(checkCollectionIsPresent(TEST_COL)).to.equal(true);
        db._drop(TEST_COL);
    });
    test("checkCollectionIsPresent should return true if collection doesn't exist", () => {
        expect(checkCollectionIsPresent(TEST_COL)).to.equal(false);
    });
});