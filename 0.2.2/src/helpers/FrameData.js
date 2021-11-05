// TODO make agnostic to frame numbers, allow replacing count function
//      allow to dynamically accept function or normal data

export class FrameData {

    #fd = {
        expiry: 0,
        data: null,
    }

    constructor( cb = null ) {
        if (cb) this.registerFrameData(cb);
    }

    #dataCallback = () => null;
    registerFrameData( callback ) {
        // TODO check for function type
        this.#dataCallback = callback;
    }
    fetch() { return this.#dataCallback() }
    set( data = this.fetch() ) { 
        this.#fd = {
            expiry: window.frameCount,
            data,
        }
    }

    get( expiredAllowed = false ) {
        console.log(this.#fd);
        if (!expiredAllowed && this.isExpired()) this.set();
        return this.#fd.data;
    }

    #expiryTest = function() { return (window.frameCount !== this.#fd.expiry)};
    #fetchExpiry() {
        return this.#expiryTest();
    }
    registerExpiryTest(f) { 
        // TODO check for function type
        this.#expiryTest = f; 
    }
    isExpired() { return  this.#fetchExpiry(); }
    isValid()   { return !this.#fetchExpiry(); }
}