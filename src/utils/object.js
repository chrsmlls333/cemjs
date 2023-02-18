import { isString, isObjectLike } from "../../../submodules/lodash/lodash.js";

export function removeProps(obj = {}, keys = []) {
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