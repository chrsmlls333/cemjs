import { isEqual } from "lodash";
// TODO possibly copy loose equality from math.gl

const dot = (a: Readonly<number[]>, b:Readonly<number[]>) => a.map((_x, i) => a[i] * b[i]).reduce((m, n) => m + n);

export const bboxVertices = (x = 0, y = 0, width = 100, height = 100) => [
    [x, y], [x + width, y], [x + width, y + height], [x, y + height]
];

export const bboxCorners = (x = 0, y = 0, width = 100, height = 100) => [
    [x, y], [x + width, y + height],
];

/**
 * Cyrus-Beck Algorithm
 *  for use with convex bounds
 * 
 * @param line [ point1[ x,y ], point2[ x,y ] ]
 * @param vertices [ boundingCorner[ x,y ]... ]
 * 
 * @link https://www.geeksforgeeks.org/line-clipping-set-2-cyrus-beck-algorithm/
 * @link https://gist.github.com/w8r/7b701519a7c5b4840bec4609ceab3171
 */
export const cyrusBeck = (line: number[][], vertices = bboxVertices()) => {
    const x = 0; //array index
    const y = 1; //array index
    
    const n = vertices.length;
  
    // Normals initialized dynamically(can do it statically also, doesn't matter)
    const normal: number[][] = [];
  
    // Calculating the normals
    for (let i = 0; i < n; i++) {
        normal[i] = [0,0];
        normal[i][y] = vertices[(i + 1) % n][x] - vertices[i][x];
        normal[i][x] = vertices[i][y] - vertices[(i + 1) % n][y];
    }
  
    // Calculating P1 - P0
    const P1_P0 = [
        line[1][x] - line[0][x],
        line[1][y] - line[0][y]
    ]
  
    // Initializing all values of P0 - PEi
    let P0_PEi: number[][] = [];
  
    // Calculating the values of P0 - PEi for all edges
    for (let i = 0; i < n; i++) {
        // Calculating PEi - P0, so that the
        // denominator won't have to multiply by -1
        // while calculating 't'
        P0_PEi[i] = [
            vertices[i][x] - line[0][x],
            vertices[i][y] - line[0][y]
        ]
    }
  
    // Initializing the 't' values dynamically
    let t: number[] = [];
  
    // Making two vectors called 't entering'
    // and 't leaving' to group the 't's
    // according to their denominators
    let tE: number[] = [], 
        tL: number[] = [];
  
    // Calculating 't' and grouping them accordingly
    for (let i = 0; i < n; i++) {
        let numerator = dot(normal[i], P0_PEi[i])
        let denominator = dot(normal[i], P1_P0)
  
        t[i] = numerator / denominator;
  
        if (denominator > 0)
            tE.push(t[i]);
        else
            tL.push(t[i]);
    }
  
    // Initializing the final two values of 't'
    // Taking the max of all 'tE' and 0
    let tEntering = Math.max(0, ...tE)
  
    // Taking the min of all 'tL' and 1
    let tLeaving = Math.min(1, ...tL)
  
    // Entering 't' value cannot be
    // greater than exiting 't' value,
    // hence, this is the case when the line
    // is completely outside
    if (tEntering > tLeaving) return null
  
    // Calculating the coordinates in terms of x and y
    let newLine = [[0,0], [0,0]];
    newLine[0][x] = line[0][x] + P1_P0[x] * tEntering
    newLine[0][y] = line[0][y] + P1_P0[y] * tEntering
    newLine[1][x] = line[0][x] + P1_P0[x] * tLeaving
    newLine[1][y] = line[0][y] + P1_P0[y] * tLeaving

    // Extra - Check if they were collapsed to a point.
    if (isEqual(newLine[0], newLine[1])) return null

    return newLine;
}



/**
 * Liang-Barsky function by Daniel White 
 *  for use with rectangular bounds
 * 
 * @param line [ point1[ x,y ], point2[ x,y ] ]
 * @param bbox [ minCorner[ x,y ], maxCorner[ x,y ] ]
 * 
 * @link http://www.skytopia.com/project/articles/compsci/clipping.html
 * @link https://gist.github.com/w8r/7b701519a7c5b4840bec4609ceab3171
 */
export function liangBarsky (line: number[][], bbox: number[][] = bboxCorners()) {
    var [[x0, y0], [x1, y1]] = line;
    var [[xmin, ymin], [xmax, ymax]] = bbox;
    var t0 = 0, 
        t1 = 1;
    var dx = x1 - x0, 
        dy = y1 - y0;
    var p = 0, //default eq0 for typescript
        q = 0, 
        r = 0;

    for(var edge = 0; edge < 4; edge++) {   // Traverse through left, right, bottom, top edges.
        if (edge === 0) { p = -dx; q = -(xmin - x0); }
        if (edge === 1) { p =  dx; q =  (xmax - x0); }
        if (edge === 2) { p = -dy; q = -(ymin - y0); }
        if (edge === 3) { p =  dy; q =  (ymax - y0); }

        r = q / p;

        if (p === 0 && q < 0) return null;   // Don't draw line at all. (parallel line outside)

        if(p < 0) {
        if (r > t1) return null;     // Don't draw line at all.
        else if (r > t0) t0 = r;     // Line is clipped!
        } else if (p > 0) {
        if(r < t0) return null;      // Don't draw line at all.
        else if (r < t1) t1 = r;     // Line is clipped!
        }
    }

    return [
        [x0 + t0 * dx, y0 + t0 * dy],
        [x0 + t1 * dx, y0 + t1 * dy]
    ];
}