import { Vec, vecAddVec, vecSubVec, vecMultScalar, setVec } from "../math";

export class Mouse {
    pInst: p5;
    readonly defaultAccumulator: Vec;
    accumulator: Vec;

    constructor( p5Instance: p5, externalDragVec = Vec() ) {
        this.pInst = p5Instance;
        this.defaultAccumulator = Vec();
        this.accumulator = externalDragVec;
    }

    set dragPosition(vector:Vec) { setVec(this.accumulator, vector) }

    get x() { return this.pInst.mouseX }
    get y() { return this.pInst.mouseY }

    get dragPositionY() { return this.accumulator.y }
    get dragPositionX() { return this.accumulator.x }
    get dragPosition()  { return this.accumulator }

    static dragSpeedMult = 0.5;
    drag() {
        const pos  = Vec( this.pInst.mouseX,  this.pInst.mouseY  );        
        const prev = Vec( this.pInst.pmouseX, this.pInst.pmouseY );
        let delta = vecMultScalar(vecSubVec(pos, prev), Mouse.dragSpeedMult);
        setVec(this.accumulator, vecAddVec(this.accumulator, delta))
    }

    reset() { setVec(this.accumulator, this.defaultAccumulator) }
}
