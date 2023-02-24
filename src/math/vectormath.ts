import mapValues from "lodash/mapValues"

export interface Vec { x: number, y: number, z?: number, [key: string]: any }

export const Vec = (x = 0, y = 0) => (<Vec>{x,y}); // Simple vector object
export const Vec3 = (x = 0, y = 0, z = 0) => (<Vec>{x,y,z}); // Simple vector object
// export const VecToP5Vector = ({x,y,z}) => createVector(x, y, z || 0);
export const VecToArray = ({x,y,z}:Vec) => z === undefined ? [x, y] : [x, y, z];
export const ObjToVec = ({x,y,z}:{x:number,y:number,z?:number}) => z === undefined ? Vec(x,y) : Vec3(x,y,z);
export const ArraytoVec = (arr:number[]) => arr.length < 3 ? Vec(...arr) : Vec3(...arr);
export const setVec = (v:Vec, {x,y,z}:{x:number,y:number,z?:number}) => {
    v.x = x; v.y = y; if (v.z !== undefined) v.z = z;
}

// ==========================================================================

export const mapVector = (vec: Vec, func: (v:number, k:string)=>number) => {
    if ((!vec || vec.x === undefined || vec.y === undefined)) 
        throw new TypeError("I actually only work with Vector-like objects, sorry!");
    
    return <Vec>mapValues(vec, (v:any, k:string) => {
        if (k === 'x' || k === 'y' || k === 'z' && typeof v == "number") 
            return func(v, k);
        else return v;
    });
}

export const vecMultScalar = (vec1:Vec, s:number) => mapVector(vec1, v => v * s );
export const vecMultVec =    (vec1:Vec, vec2:Vec) => mapVector(vec1, (v, k) => v * vec2[k]);
export const vecDivScalar =  (vec1:Vec, s:number) => mapVector(vec1, v => v / s );
export const vecDivVec =     (vec1:Vec, vec2:Vec) => mapVector(vec1, (v, k) => v / vec2[k]);
export const vecAddScalar =  (vec1:Vec, s:number) => mapVector(vec1, v => v + s );
export const vecAddVec =     (vec1:Vec, vec2:Vec) => mapVector(vec1, (v, k) => v + vec2[k]);
export const vecSubScalar =  (vec1:Vec, s:number) => mapVector(vec1, v => v - s );
export const vecSubVec =     (vec1:Vec, vec2:Vec) => mapVector(vec1, (v, k) => v - vec2[k]);

export const roundVector = (vec:Vec) => mapVector(vec, Math.round);
export const floorVector = (vec:Vec) => mapVector(vec, Math.floor);
export const  ceilVector = (vec:Vec) => mapVector(vec,  Math.ceil);

export function VecEquals(v1:Vec, v2:Vec):boolean {
    const va1 = VecToArray(v1),
          va2 = VecToArray(v2);
    if (va1.length !== va2.length) throw "Different-size matrices!"
    return va1.every((x, i) => x === va2[i]);
}

export function dot(v1:Vec, v2:Vec):number {
    const va1 = VecToArray(v1),
          va2 = VecToArray(v2);
    if (va1.length !== va2.length) throw "Different-size matrices!"
    return va1
        .map((x, i) => va1[i] * va2[i])
        .reduce((m, n) => m + n);
}