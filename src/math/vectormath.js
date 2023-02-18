import mapValues from "lodash/mapValues"

export const Vec = (x = 0, y = 0) => ({x,y}); // Simple vector object
export const Vec3 = (x = 0, y = 0, z = 0) => ({x,y,z}); // Simple vector object
export const VecToP5Vector = ({x,y,z}) => createVector(x, y, z || 0);
export const VecToArray = ({x,y,z}) => z === undefined ? [x, y] : [x, y, z];
export const VecEquals = (v1, v2) => (v1.x === v2.x && v1.y === v2.y)

// ==========================================================================

export const mapVector = (vec, func) => {
    if ((p5 && vec instanceof p5.Vector) ||
        (vec && vec.x !== undefined && vec.y !== undefined)) {
        return mapValues(vec, (v, k) => {
            if (k === 'x' || k === 'y' || k === 'z' ) 
                return func(v, k);
            return v;
        });
    } else {
        throw new TypeError("I actually only work with p5.Vector and Vector-like objects, sorry!")
    }
}

export const vecMultScalar = (vec1, s) => mapVector(vec1, v => v * s );
export const vecMultVec = (vec1, vec2) => mapVector(vec1, (v, k) => v * vec2[k]);
export const vecDivScalar =  (vec1, s) => mapVector(vec1, v => v / s );
export const vecDivVec =  (vec1, vec2) => mapVector(vec1, (v, k) => v / vec2[k]);
export const vecAddScalar =  (vec1, s) => mapVector(vec1, v => v + s );
export const vecAddVec =  (vec1, vec2) => mapVector(vec1, (v, k) => v + vec2[k]);
export const vecSubScalar =  (vec1, s) => mapVector(vec1, v => v - s );
export const vecSubVec =  (vec1, vec2) => mapVector(vec1, (v, k) => v - vec2[k]);

export const roundVector = (vec) => mapVector(vec, Math.round);
export const floorVector = (vec) => mapVector(vec, Math.floor);
export const  ceilVector = (vec) => mapVector(vec,  Math.ceil);


export const dot = (v1, v2) => {
    const va1 = VecToArray(v1),
          va2 = VecToArray(v2);
    if (va1.length !== va2.length) throw "Different-size matrices!"
    return va1
        .map((x, i) => va1[i] * va2[i])
        .reduce((m, n) => m + n);
}