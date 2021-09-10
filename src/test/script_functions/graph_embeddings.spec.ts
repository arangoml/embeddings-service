"use strict";

import {expect} from "chai";
import {TraversalResult, flattenTraversalResult} from "../../script_functions/graph_embeddings";
import {logMsg} from "../../utils/logging";

suite("Graph Embeddings results suite", () => {
    test("flattenTraversalResult returns a correct map", () => {
        const input: TraversalResult = {
            node: {
                _key: "0",
                field: [0, 0]
            },
            neighbors: [
                {
                    node: {
                        _key: "1",
                        field: [1, 1]
                    },
                    neighbors: [
                        {
                            node: {
                                _key: "3",
                                field: [3, 3]
                            },
                            neighbors: [
                                {
                                    node: {
                                        _key: "5",
                                        field: [5,5]
                                    }
                                }
                            ]
                        },
                        {
                            node: {
                                _key: "4",
                                field: [4,4]
                            }
                        }
                    ]
                },
                {
                    node: {
                        _key: "2",
                        field: [2,2]
                    }
                }
            ]
        };

        const expected = {
            features: [
                [0,0],
                [1,1],
                [2,2],
                [3,3],
                [4,4],
                [5,5]
            ],
            adj_lists: [
                [
                    [1,0],
                    [2,0]
                ],
                [
                    [3,1],
                    [4,1],
                    [1,0],
                    [2,0]
                ],
                [
                    [5,3],
                    [3,1],
                    [4,1],
                    [1,0],
                    [2,0]
                ]
            ]
        };

        const res = flattenTraversalResult(input);
        logMsg(res);
        expect(res).to.eql(expected);

    })
})