export class Mouse {
    pInst: p5;
    readonly defaultAccumulator: p5.Vector;
    accumulator: p5.Vector;

    constructor( p5Instance: p5 ) {
        this.pInst = p5Instance;
        this.defaultAccumulator = p5Instance.createVector();
        this.accumulator = p5Instance.createVector();
    }

    get x() { return this.pInst.mouseX }
    get y() { return this.pInst.mouseY }

    get dragPositionY() { return this.accumulator.y }
    get dragPositionX() { return this.accumulator.x }
    get dragPosition()  { return this.accumulator }

    static dragSpeedMult = 0.5;
    drag() {
        const pos  = this.pInst.createVector( this.pInst.mouseX,  this.pInst.mouseY  );
        const prev = this.pInst.createVector( this.pInst.pmouseX, this.pInst.pmouseY );
        const delta = this.pInst.createVector().add(pos).sub( prev );
        delta.mult( Mouse.dragSpeedMult );
        this.accumulator.add( delta )
    }

    reset() { this.accumulator.set(this.defaultAccumulator) }
}
