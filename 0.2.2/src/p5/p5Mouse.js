export class Mouse {

    constructor( p5Instance ) {
        const p = this.p = p5Instance;

        this.defaultAccumulator = p.createVector();
        this.accumulator = p.createVector();
    }

    get x() { return this.p.mouseX }
    get y() { return this.p.mouseY }

    get dragPositionY() { return this.accumulator.y }
    get dragPositionX() { return this.accumulator.x }
    get dragPosition()  { return this.accumulator }

    static dragSpeedMult = 0.5;
    drag() {
        const pos  = createVector( this.p.mouseX,  this.p.mouseY  );
        const prev = createVector( this.p.pmouseX, this.p.pmouseY );
        const delta = p5.Vector.sub( pos, prev );
        delta.mult( Mouse.dragSpeedMult );
        this.accumulator.add( delta )
    }

    reset() { this.accumulator.set(this.defaultAccumulator) }
}
