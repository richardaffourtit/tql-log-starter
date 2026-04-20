export type Point2 = [number, number];

export interface Homography {
    matrix: number[];
}

export function solveHomography(src: Point2[], dst: Point2[]): Homography | null {
    if (src.length !== 4 || dst.length !== 4) return null;
    const A: number[][] = [];
    const b: number[] = [];
    for (let i = 0; i < 4; i++) {
        const [x, y] = src[i];
        const [u, v] = dst[i];
        A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
        A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
        b.push(u, v);
    }
    const h = solve8x8(A, b);
    if (!h) return null;
    return { matrix: [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1] };
}

export function applyHomography(h: Homography, pt: Point2): Point2 {
    const m = h.matrix;
    const [x, y] = pt;
    const w = m[6] * x + m[7] * y + m[8];
    const u = (m[0] * x + m[1] * y + m[2]) / w;
    const v = (m[3] * x + m[4] * y + m[5]) / w;
    return [u, v];
}

function solve8x8(A: number[][], b: number[]): number[] | null {
    const n = 8;
    const M = A.map((row, i) => [...row, b[i]]);
    for (let col = 0; col < n; col++) {
        let pivot = col;
        for (let r = col + 1; r < n; r++) {
            if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
        }
        if (Math.abs(M[pivot][col]) < 1e-10) return null;
        [M[col], M[pivot]] = [M[pivot], M[col]];
        for (let r = 0; r < n; r++) {
            if (r === col) continue;
            const factor = M[r][col] / M[col][col];
            for (let c = col; c <= n; c++) M[r][c] -= factor * M[col][c];
        }
    }
    return M.map((row) => row[n] / row[row.length - 2]);
}

export function homographyToCssMatrix(h: Homography): string {
    const m = h.matrix;
    return `matrix3d(${m[0]}, ${m[3]}, 0, ${m[6]}, ${m[1]}, ${m[4]}, 0, ${m[7]}, 0, 0, 1, 0, ${m[2]}, ${m[5]}, 0, ${m[8]})`;
}

export interface PlaneAnchor {
    videoCorners: Point2[];
    planeCorners: Point2[];
    widthMeters: number;
    heightMeters: number;
}

export function anchorTransformMatrix(anchor: PlaneAnchor): Homography | null {
    return solveHomography(anchor.planeCorners, anchor.videoCorners);
}

export function cornersFromClicks(points: Point2[]): Point2[] | null {
    if (points.length !== 4) return null;
    const cx = points.reduce((a, p) => a + p[0], 0) / 4;
    const cy = points.reduce((a, p) => a + p[1], 0) / 4;
    const sorted = [...points].sort((a, b) => {
        const angleA = Math.atan2(a[1] - cy, a[0] - cx);
        const angleB = Math.atan2(b[1] - cy, b[0] - cx);
        return angleA - angleB;
    });
    return sorted;
}
