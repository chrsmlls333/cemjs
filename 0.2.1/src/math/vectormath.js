
export const operateOnVecComponents = (vec, func) => {
    if (!(vec instanceof p5.Vector)) 
        throw new TypeError("I actually only work with p5.Vector objects, sorry!")
    const xyz = vec.array();
    const newxyz = xyz.map(v => func(v));
    return vec.set(newxyz);
}
export const roundVector = function(vec) { return operateOnVecComponents(vec, Math.round) };
export const floorVector = function(vec) { return operateOnVecComponents(vec, Math.floor) };
export const  ceilVector = function(vec) { return operateOnVecComponents(vec,  Math.ceil) };

export const dot = (v1, v2) => {
    let x1, y1, x2, y2
    if (Array.isArray(v1)) {
        [x1, y1] = v1;
        [x2, y2] = v2;
    } else if (typeof v1 == 'object') {
        ({x: x1, y: y1} = v1);
        ({x: x2, y: y2} = v2);
    } else throw new TypeError('oops')
    return x1 * x2 + y1 * y2;
}