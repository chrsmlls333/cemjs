import { Vec, Vec3, setVec, vecAddVec, vecMultScalar } from "../math";

export interface p5NoiseFieldOptions {
  seed?: number;
  amplitude?: number;
  scale?: number;
  lod?: number;
  falloff?: number;
  speed?: Vec;
  mono?: boolean;
}

export class p5NoiseField {
  pInst: p5;

  seed = 0;
  amplitude = 1;
  scale = 1; //0.2
  lod = 4;
  falloff = 0.5;
  
  speed = Vec3();
  position = Vec3();
  
  mono = false;

  constructor( p5Instance: p5, options: p5NoiseFieldOptions = {}) {
    this.pInst = p5Instance

    this.amplitude = options.amplitude ?? 1
    this.scale = options.scale ?? 1
    this.setDetail(options.lod ?? 4)
    this.setFalloff(options.falloff ?? 0.5)
    this.setSeed(options.seed ?? p5NoiseField.randomSeed())

    this.setSpeed(options.speed)

    this.mono = options.mono ?? false
  }

  static randomSeed = () => Math.round(Math.random()*10000000)
  setSeed(seed: number) {
    this.seed = seed
    this.pInst.noiseSeed(seed)
  }
  setDetail(lod: number) { 
    this.lod = lod
    this.pInst.noiseDetail(lod, this.falloff) 
  }
  setFalloff(falloff: number) { 
    this.falloff = falloff
    this.pInst.noiseDetail(this.lod, falloff) 
  }

  setSpeed(v = Vec3()) {
    setVec(this.speed, v)
  }

  tick(delta = (this.pInst.deltaTime/1000)) {
    const deltaPosition = vecMultScalar(this.speed, this.scale * delta)
    setVec( this.position, vecAddVec(this.position, deltaPosition) )
    return this.position
  }

  get({ x, y }: Vec, centered = false) {
    const scale = (1 / this.scale) - 0.9 //TODO needs refinement
    const offset = centered ? -0.5 : 0;
    return (this.pInst.noise( 
      (x + this.position.x) * scale, 
      (y + this.position.y) * scale, 
      (this.position.z || 0) * scale
    ) + offset) * this.amplitude;
  }

  getVec({ x, y }: Vec, centered = false, mono = this.mono) {
    let nx = this.get({ x, y }, centered)
    return Vec(
      nx, 
      mono ? nx : this.get({ x: x+1000, y: y+1000 }, centered)
    )
  }

}