

export class ExpiringData<T = any> {
    #expiry: number = 0;
    #data?: T;
    #generator?: () => T;

    constructor( callback?: ()=>T ) {
        if (callback) {
            this.registerDataCallback(callback);
            this.update(0)
        }
    }
    registerDataCallback( callback: ()=>T ) {
        // TODO check for null or function type, return success, and use in the constructor
        if (callback) this.#generator = callback
    }
    
    update( expiry = Date.now(), data?: T ) { 
        this.#expiry = expiry

        if (data !== undefined) this.#data = data
        else if (this.#generator) this.#data = this.#generator()
        // else leave alone

        return data;
    }
    set( data: T, expiry = 0 ) { return this.update(expiry, data) }

    getFresh() { this.#data = this.#generator ? this.#generator() : this.#data; return this.#data }
    getStale() { return this.#data }
    get( now = Date.now(), maxAge: number = 0 ) {
        if (this.isExpired(now, maxAge)) return this.update(now)
        else return this.getStale();
    }

    isExpired(now: number, maxAge: number = 0 ) { return now > (this.#expiry + maxAge) }
    isFresh(now: number, maxAge: number = 0) { return !this.isExpired(now, maxAge) }
}

export class p5FrameData<T = any> {
    #ed: ExpiringData<T>;

    #pInst: p5;
    #getFrameCount = () => this.#pInst.frameCount;

    constructor(p5Instance: p5, callback?: ()=>T ) {
        this.#ed = new ExpiringData(callback)
        this.#pInst = p5Instance;
    }
    registerDataCallback = ( callback: ()=>T ) => this.#ed.registerDataCallback(callback)

    update = ( data?: T ) => this.#ed.update(this.#getFrameCount(), data )
    set = this.update
    getFresh = () => this.#ed.getFresh()
    getStale = () => this.#ed.getStale()

    get = ( maxAge: number = 0 ) => this.#ed.get(this.#getFrameCount(), maxAge)

    isExpired = (maxAge: number = 0) => this.#ed.isExpired(this.#getFrameCount(), maxAge)
    isFresh = (maxAge: number = 0) => !this.isExpired(maxAge)
}