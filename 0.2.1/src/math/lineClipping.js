import { dot } from "./vectormath.js"

export const canvasVectorSet = () => [
    createVector(0,0),
    createVector(width, 0),
    createVector(width,height),
    createVector(0, height)
];

// from: https://www.geeksforgeeks.org/line-clipping-set-2-cyrus-beck-algorithm/
export const cyrusBeck = (lin, vertices = canvasVectorSet()) => {

    const n = vertices.length;

    // Temporary holder value that will be returned
    let newPair = [createVector(), createVector()];
  
    // Normals initialized dynamically(can do it statically also, doesn't matter)
    const normal = [];
  
    // Calculating the normals
    for (let i = 0; i < n; i++) {
        normal[i] = createVector();
        normal[i].y = vertices[(i + 1) % n].x - vertices[i].x;
        normal[i].x = vertices[i].y - vertices[(i + 1) % n].y;
    }
  
    // Calculating P1 - P0
    const P1_P0 = createVector( lin[1].x - lin[0].x,
                                lin[1].y - lin[0].y);
  
    // Initializing all values of P0 - PEi
    let P0_PEi = [];
  
    // Calculating the values of P0 - PEi for all edges
    for (let i = 0; i < n; i++) {
        P0_PEi[i] = createVector();
        // Calculating PEi - P0, so that the
        // denominator won't have to multiply by -1
        P0_PEi[i].x = vertices[i].x - lin[0].x;
  
        // while calculating 't'
        P0_PEi[i].y = vertices[i].y - lin[0].y;
    }
  
    let numerator = [], denominator = [];
  
    // Calculating the numerator and denominators
    // using the dot function
    for (let i = 0; i < n; i++) {
        numerator[i] = dot(normal[i], P0_PEi[i]);
        denominator[i] = dot(normal[i], P1_P0);
    }
  
    // Initializing the 't' values dynamically
    let t = [];
  
    // Making two vectors called 't entering'
    // and 't leaving' to group the 't's
    // according to their denominators
    let tE = [], tL = [];
  
    // Calculating 't' and grouping them accordingly
    for (let i = 0; i < n; i++) {
  
        t[i] = numerator[i] / denominator[i];
  
        if (denominator[i] > 0)
            tE.push(t[i]);
        else
            tL.push(t[i]);
    }
  
    // Initializing the final two values of 't'
    let temp = [];
  
    // Taking the max of all 'tE' and 0, so pushing 0
    tE.push(0.0);
    temp[0] = max(tE);
  
    // Taking the min of all 'tL' and 1, so pushing 1
    tL.push(1.0);
    temp[1] = min(tL);
  
    // Entering 't' value cannot be
    // greater than exiting 't' value,
    // hence, this is the case when the line
    // is completely outside
    if (temp[0] > temp[1]) {
        // newPair[0] = createVector(-1, -1);
        // newPair[1] = createVector(-1, -1);
        // return newPair;
        return null;
    }
  
    // Calculating the coordinates in terms of x and y
    newPair[0].x
        = lin[0].x
          + P1_P0.x * temp[0];
    newPair[0].y
        = lin[0].y
          + P1_P0.y * temp[0];
    newPair[1].x
        = lin[0].x
          + P1_P0.x * temp[1];
    newPair[1].y
        = lin[0].y
          + P1_P0.y * temp[1]; 
    return newPair;
}