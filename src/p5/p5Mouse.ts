import { Vector2 } from "@math.gl/core";


export class Mouse {
    pInst: p5;
    readonly defaultAccumulator = new Vector2();
    accumulator = new Vector2();
    position = new Vector2();
    previous = new Vector2();
    delta = new Vector2();
    dragCoefficent = 0.5;

    constructor( p5Instance: p5, externalDragVec?: Vector2 ) {
        this.pInst = p5Instance;
        if (externalDragVec) this.accumulator = externalDragVec;
    }

    set dragPosition(v: Vector2) { this.accumulator.copy(v) }

    get x() { return this.pInst.mouseX }
    get y() { return this.pInst.mouseY }

    get dragPositionY() { return this.accumulator.y }
    get dragPositionX() { return this.accumulator.x }
    get dragPosition()  { return this.accumulator }

    drag() {
        this.position.set( this.pInst.mouseX,  this.pInst.mouseY )
        this.previous.set( this.pInst.pmouseX, this.pInst.pmouseY )
        this.delta.subVectors( this.position, this.previous )
        this.delta.multiplyByScalar(this.dragCoefficent)
        this.accumulator.add(this.delta)
    }

    reset() { this.accumulator.copy(this.defaultAccumulator) }
}
