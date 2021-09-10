"use strict";

export interface TargetDoc {
    _key: string;
    field: any;
}

export interface TraversalResult {
    node: TargetDoc;
    neighbors?: TraversalResult[];
}

export function flattenTraversalResult(t: TraversalResult): { features: any[]; adj_lists: number[][][] } {
    let q: { v: TraversalResult, s_ind: number, level: number }[] = [{v: t, s_ind: 0, level: -1}];

    const features = []
    const adj_lists: number[][][] = [];

    while (q.length !== 0) {
        const res = q.shift();
        if (res !== undefined) {
            const this_ind = features.length;

            features.push(res.v.node.field);

            if (adj_lists.length == res.level) {
                adj_lists.push([]);
            }

            if (res.level !== -1) {
                adj_lists[res.level].push([this_ind, res.s_ind]);
            }

            if (res.v.neighbors !== undefined) {
                res.v.neighbors.forEach((neighbor) => {
                    q.push({
                        v: neighbor,
                        s_ind: this_ind,
                        level: res.level + 1
                    });
                });
            }
        }
    }


    for (let i = 0; i < adj_lists.length; i++) {
        if (i > 0) {
            const clone = Array.from(adj_lists[i - 1].map(m => Array.from(m)))
            adj_lists[i].push(...clone);
        }
    }

    return {
        features,
        adj_lists
    };
}
