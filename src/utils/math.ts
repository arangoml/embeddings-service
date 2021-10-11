export function transposeMatrix(matrix: number[][]): number[][] {
    if (matrix.length === 0 || matrix[0].length === 0) {
        return matrix;
    }
    return matrix[0].map((_, c) => matrix.map((_, r) => matrix[r][c]));
}

export function indexOfMax(arr: number[]) {
    if (arr.length === 0) {
        return -1;
    }

    let max = arr[0];
    let maxIndex = 0;

    for (let i = 1; i < arr.length; i++) {
        if (arr[i] > max) {
            maxIndex = i;
            max = arr[i];
        }
    }

    return maxIndex;
}
