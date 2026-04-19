
/**
 * mergeCellEdges
 * Merges adjacent grid cells into one or more polygons (boundary paths).
 * Useful for "pixel-perfect" map zone rendering.
 */
export function mergeCellEdges(cells: { x: number, y: number }[]): { x: number, y: number }[][] {
    if (!cells || cells.length === 0) return [];

    // 1. Map edges to their occurence count
    // Edge key format: "x1,y1|x2,y2" where points are sorted to ensure uniqueness
    const edgeCount = new Map<string, number>();
    const edges: [number, number, number, number][] = [];

    const getEdgeKey = (x1: number, y1: number, x2: number, y2: number) => {
        if (x1 < x2 || (x1 === x2 && y1 < y2)) {
            return `${x1},${y1}|${x2},${y2}`;
        }
        return `${x2},${y2}|${x1},${y1}`;
    };

    for (const cell of cells) {
        const { x, y } = cell;
        const cellEdges = [
            [x, y, x + 1, y],         // Top
            [x + 1, y, x + 1, y + 1], // Right
            [x + 1, y + 1, x, y + 1], // Bottom
            [x, y + 1, x, y]          // Left
        ];

        for (const [x1, y1, x2, y2] of cellEdges) {
            const key = getEdgeKey(x1, y1, x2, y2);
            edgeCount.set(key, (edgeCount.get(key) || 0) + 1);
        }
    }

    // 2. Keep only unique edges (the boundary)
    const boundaryEdges: [number, number, number, number][] = [];
    edgeCount.forEach((count, key) => {
        if (count === 1) {
            const [p1, p2] = key.split('|');
            const [x1, y1] = p1.split(',').map(Number);
            const [x2, y2] = p2.split(',').map(Number);
            boundaryEdges.push([x1, y1, x2, y2]);
        }
    });

    if (boundaryEdges.length === 0) return [];

    // 3. Chain edges into polygons
    const polygons: { x: number, y: number }[][] = [];
    while (boundaryEdges.length > 0) {
        const polygon: { x: number, y: number }[] = [];
        let currentEdge = boundaryEdges.shift()!;
        let [startX, startY, endX, endY] = currentEdge;
        polygon.push({ x: startX, y: startY });
        polygon.push({ x: endX, y: endY });

        let found = true;
        while (found) {
            found = false;
            for (let i = 0; i < boundaryEdges.length; i++) {
                const [x1, y1, x2, y2] = boundaryEdges[i];
                if (x1 === endX && y1 === endY) {
                    endX = x2; endY = y2;
                    polygon.push({ x: endX, y: endY });
                    boundaryEdges.splice(i, 1);
                    found = true;
                    break;
                } else if (x2 === endX && y2 === endY) {
                    endX = x1; endY = y1;
                    polygon.push({ x: endX, y: endY });
                    boundaryEdges.splice(i, 1);
                    found = true;
                    break;
                }
            }
            // Check if we closed the loop
            if (endX === startX && endY === startY) break;
        }
        polygons.push(polygon);
    }

    return polygons;
}
