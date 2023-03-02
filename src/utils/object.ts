import { isString, isObjectLike } from "lodash-es";


export function removeProps(obj: {[key: string]: any} = {}, keys: string|string[] = []) {
    if (!Array.isArray(keys) && isString(keys)) keys = [keys];
    if (!Array.isArray(keys)) throw TypeError("I need an array of key strings here!")

    if (Array.isArray(obj)) {
        obj.forEach(function (item) {
            removeProps(item, keys)
        });
    } else if (isObjectLike(obj)) {
        Object.getOwnPropertyNames(obj).forEach(function (key) {
            if (keys.indexOf(key) !== -1) delete obj[key];
            else removeProps(obj[key], keys);
        });
    }
}

/**
 * For use in JSON.stringify to conserve complicated Vector objects
 * @param _k key of nested property, unused
 * @param v some nested property value from object
 * @returns 
 */
export function vectorReplacer(_k: string, v: any) {
    if (v.x === undefined) return v
    return ['x','y','z','w'].reduce( (pv, key) => ({
        ...pv,
        ...(v[key] !== undefined && { [key]: v[key] })
    }), {})
    // return {
    //   ...(v.x !== undefined && { x: v.x }),
    //   ...(v.y !== undefined && { y: v.y }),
    //   ...(v.z !== undefined && { z: v.z }),
    //   ...(v.w !== undefined && { w: v.w })
    // }
}

