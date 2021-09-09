export function transposeMatrix(matrix: number[][]): number[][] {
    if (matrix.length === 0 || matrix[0].length === 0) {
        return matrix;
    }
    return matrix[0].map((_, c) => matrix.map((_, r) => matrix[r][c]));
}