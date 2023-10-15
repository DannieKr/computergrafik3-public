import {
  MeshBasicMaterial,
  SphereGeometry,
  Vector3,
  Mesh,
  Line,
  BufferGeometry,
  LineBasicMaterial,
  Object3D,
  ColorRepresentation,
  Float32BufferAttribute,
  MeshPhongMaterial,
  FrontSide,
  BackSide
} from "three";

export let GRAVITY = new Vector3(0, -0.1, 0);

class Spring {
  particleA: ClothParticle;
  particleB: ClothParticle;
  springConstant: number;
  restingLength: number;
  lineMesh: Line;

  constructor(
    particleA: ClothParticle,
    particleB: ClothParticle,
    springConstant: number,
    color: ColorRepresentation = 0xffffff
  ) {
    this.particleA = particleA;
    this.particleB = particleB;
    this.springConstant = springConstant;
    this.restingLength = this.getLength();
    let geometry = new BufferGeometry().setFromPoints([particleA.position, particleB.position]);
    this.lineMesh = new Line(
      geometry,
      new LineBasicMaterial({color: color})
    );
  }

  getLength(): number {
    return this.particleA.position.distanceTo(this.particleB.position);
  }

  getForce(): Vector3 {
    // F = -k * deviationFromRestingLength * direction
    let force = new Vector3();
    const distance = this.getLength();
    const direction = this.particleA.position.clone().sub(this.particleB.position);
    direction.normalize();
    const deviationFromRestingLength = distance - this.restingLength;
    force = direction.multiplyScalar(
      -this.springConstant * deviationFromRestingLength
    );
    return force;
  }

  updateGeometry() {
    this.lineMesh.geometry.dispose();
    this.lineMesh.geometry = new BufferGeometry().setFromPoints(
      [this.particleA.position, this.particleB.position]
    );
  }
}

class ClothParticle {
  private _originalPosition: Vector3;
  private _position: Vector3;
  private _velocity: Vector3;
  private _mass: number;
  private _acceleration: Vector3;
  private _mesh: Mesh;
  isAffectedByForce: boolean = true;

  public get position(): Vector3 {
    return this._position;
  }

  public get mesh(): Mesh {
    return this._mesh;
  }

  public set acceleration(acceleration: Vector3) {
    this._acceleration = acceleration;
  }

  public get velocity(): Vector3 {
    return this._velocity;
  }

  constructor(position: Vector3, velocity: Vector3, mass: number, isAffectedByForce: boolean = true) {
    this.isAffectedByForce = isAffectedByForce;
    this._position = position;
    this._originalPosition = this._position.clone();
    this._velocity = velocity;
    this._mass = mass;
    this._acceleration = GRAVITY.clone();
    this._mesh = new Mesh(
      new SphereGeometry(0.1, 16, 16),
      new MeshBasicMaterial({color: 0x00ff00})
    );
    this._mesh.position.set(position.x, position.y, position.z);
  }

  reset() {
    this._position = this._originalPosition.clone();
    this._velocity = new Vector3();
    this._acceleration = GRAVITY.clone();
  }

  applyForce(force: Vector3) {
    if (!this.isAffectedByForce) return;

    // a = F / m
    this._acceleration.add(force.clone().divideScalar(this._mass));
  }

  updateEuler(deltaTime: number) {
    if (!this.isAffectedByForce) return;

    // 𝑥(⃗𝑡0 + h) = 𝑥⃗0 + deltaTime*𝑣⃗0
    // m/s^2 * s = m/s
    this._velocity.add(this._acceleration.clone().multiplyScalar(deltaTime));
    // m/s * s = m
    this.position.add(this._velocity.clone().multiplyScalar(deltaTime));
    this.mesh.position.set(this.position.x, this.position.y, this.position.z);
  }

  updateMidpoint(deltaTime: number) {
    if (!this.isAffectedByForce) return;

    // euler with a half time step
    this._velocity.add(this._acceleration.clone().multiplyScalar(deltaTime * 0.5));

    // update/reset acceleration
    this._acceleration = GRAVITY.clone();
    // TODO: maybe need to add spring forces here
    this._velocity.add(this._acceleration.clone().multiplyScalar(deltaTime * 0.5));
    this.position.add(this._velocity.clone().multiplyScalar(deltaTime));
    this._mesh.position.set(this.position.x, this.position.y, this.position.z);
  }

//   updateMidpoint2(deltaTime: number) {
//     if (!this.isAffectedByForce) return;

//     this._velocity.add(this._acceleration.clone().multiplyScalar(deltaTime * 0.5));
//     this.position.add(this._velocity.clone().multiplyScalar(deltaTime));
//     this._mesh.position.set(this.position.x, this.position.y, this.position.z);
//   }
}

export class Cloth {
  particles: ClothParticle[];
  springs: Spring[];
  neighborSpringConstant: number = 1;
  shearSpringConstant: number = 1;
  bendingSpringConstant: number = 1;
  width: number;
  height: number;
  frontMesh: Mesh;
  backMesh: Mesh;
  isMeshRendered: boolean = true;

  constructor(
    dimension: number,
    particleMass: number = 1,
    neighborSpringConstant: number = 1,
    shearSpringConstant: number = 1,
    bendingSpringConstant: number = 1,
    hasNeighborSprings: boolean = true,
    hasShearSprings: boolean = true,
    hasBendingSprings: boolean = true,
    neighborSpringColor: ColorRepresentation = 0xffffff,
    shearSpringColor: ColorRepresentation = 0xffffff,
    bendingSpringColor: ColorRepresentation = 0xffffff,
    isMeshRendered: boolean = true,
  ) {
    this.width = dimension;
    this.height = dimension;
    this.neighborSpringConstant = neighborSpringConstant;
    this.shearSpringConstant = shearSpringConstant;
    this.bendingSpringConstant = bendingSpringConstant;
    this.isMeshRendered = isMeshRendered;

    this.particles = [];
    for (let x = 0; x < this.width; x++) {
      for (let y = 0; y < this.height; y++) {
        const particle: ClothParticle = new ClothParticle(
          new Vector3(x, 0, y),
          new Vector3(),
          particleMass
        );
        const isTopRightOrLeftCorner = (y === this.height - 1 && (x === 0 || x === this.width - 1));
        if (isTopRightOrLeftCorner) {
          particle.isAffectedByForce = false;
        }
        this.particles.push(particle);
      }
    }

    this.springs = [];
    if (hasNeighborSprings) this.createNeighboringSprings(neighborSpringConstant, neighborSpringColor);
    if (hasShearSprings) this.createShearSprings(shearSpringConstant, shearSpringColor);
    if (hasBendingSprings) this.createBendingSprings(bendingSpringConstant, bendingSpringColor);

    // generate cloth meshes
    let geometry = new BufferGeometry();

    let vertices: number[] = [];
    let triangleIndices: number[] = [];

    // get vertices and indices from particles
    for (let i = 0; i < this.particles.length; i++) {
      let particle = this.particles[i];
      vertices.push(particle.position.x, particle.position.y, particle.position.z);

      const isInLastColumn = i % this.width === this.width - 1;
      const isInLastRow = i >= this.width * (this.height - 1);
      if (!isInLastColumn && !isInLastRow) {
        triangleIndices.push(i, i + 1, i + this.width);
        triangleIndices.push(i + this.width, i + 1, i + this.width + 1);
      }
    }

    geometry.setIndex(triangleIndices);
    geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));

    const frontMat = new MeshPhongMaterial({
      side: FrontSide,
      color: 0xC09BD8,
    })
    this.frontMesh = new Mesh(geometry, frontMat);

    const backMat = new MeshPhongMaterial({
      side: BackSide,
      color: 0xC2185B,
    })
    this.backMesh = new Mesh(geometry, backMat);
  }

  public reset() {
    this.particles.forEach(particle => {
      particle.mesh.geometry.dispose();
    });
    this.springs.forEach(spring => {
      spring.lineMesh.geometry.dispose();
    });

    this.frontMesh.geometry.dispose();
    this.backMesh.geometry.dispose();
  }

  private createBendingSprings(springConstant: number = 1, color: ColorRepresentation = 0xffffff) {
    // bending springs (skip one particle)
    // vertical springs
    //  x
    //  |
    // (x)
    //  |
    //  x
    for (let row = 0; row < this.width; row++) {
      for (let col = 0; col < this.height - 2; col++) {
        const particleA = this.particles[row * this.width + col];
        const particleB = this.particles[row * this.width + col + 2];
        const spring = new Spring(particleA, particleB, springConstant, color);
        this.springs.push(spring);
      }
    }

    // horizontal springs
    // x-(x)-x
    for (let row = 0; row < this.width - 2; row++) {
      for (let col = 0; col < this.height; col++) {
        const particleA = this.particles[row * this.width + col];
        const particleB = this.particles[(row + 2) * this.width + col];
        const spring = new Spring(particleA, particleB, springConstant, color);
        this.springs.push(spring);
      }
    }
  }

  private createShearSprings(springConstant: number = 1, color: ColorRepresentation = 0xffffff) {
    // diagonal shear springs
    //   x
    //  /
    // x
    for (let row = 0; row < this.width - 1; row++) {
      for (let col = 0; col < this.height - 1; col++) {
        const particleA = this.particles[row * this.width + col];
        const particleB = this.particles[(row + 1) * this.width + col + 1];
        const spring = new Spring(particleA, particleB, springConstant, color);
        this.springs.push(spring);
      }
    }
    //  x
    //   \
    //    x
    for (let row = 0; row < this.width - 1; row++) {
      for (let col = 1; col < this.height; col++) {
        const particleA = this.particles[row * this.width + col];
        const particleB = this.particles[(row + 1) * this.width + col - 1];
        const spring = new Spring(particleA, particleB, springConstant, color);
        this.springs.push(spring);
      }
    }
  }

  private createNeighboringSprings(springConstant: number = 1, color: ColorRepresentation = 0xffffff) {
    // connect particles horizontally and vertically with springs
    // x-x-x
    // | | |
    // x-x-x
    // horizontal springs
    for (let row = 0; row < this.width - 1; row++) {
      for (let col = 0; col < this.height; col++) {
        const particleA = this.particles[row * this.width + col];
        const particleB = this.particles[(row + 1) * this.width + col];
        const spring = new Spring(particleA, particleB, springConstant, color);
        this.springs.push(spring);
      }
    }
    // vertical springs
    for (let row = 0; row < this.width; row++) {
      for (let col = 0; col < this.height - 1; col++) {
        const particleA = this.particles[row * this.width + col];
        const particleB = this.particles[row * this.width + col + 1];
        const spring = new Spring(particleA, particleB, springConstant, color);
        this.springs.push(spring);
      }
    }
  }

  updateEuler(deltaTime: number) {
    this.particles.forEach(particle => {
      if (!particle.isAffectedByForce) return;
      particle.acceleration = GRAVITY.clone();
    });

    this.springs.forEach(spring => {
      const force = spring.getForce();
      spring.particleA.applyForce(force);
      spring.particleB.applyForce(force.clone().multiplyScalar(-1));
    });

    this.particles.forEach(particle => {
      particle.updateEuler(deltaTime);
    });

    this.springs.forEach(spring => {
      spring.updateGeometry();
    });

    this.updateGeometry();
  }

  updateMidpoint(deltaTime: number) {
    this.particles.forEach(particle => {
      if (!particle.isAffectedByForce) return;
      particle.acceleration = GRAVITY.clone();
    });

    this.springs.forEach(spring => {
      const force = spring.getForce();
      spring.particleA.applyForce(force);
      spring.particleB.applyForce(force.clone().multiplyScalar(-1));
    });

    this.particles.forEach(particle => {
      particle.updateMidpoint(deltaTime);
    });

    // this.springs.forEach(spring => {
    //     const force = spring.getForce();
    //     spring.particleA.applyForce(force);
    //     spring.particleB.applyForce(force.clone().multiplyScalar(-1));
    // });

    // this.particles.forEach(particle => {
    //     particle.updateMidpoint2(deltaTime);
    // });

    this.springs.forEach(spring => {
      spring.updateGeometry();
    });

    this.updateGeometry();
  }

  updateGeometry() {
    if (!this.isMeshRendered) return;

    for (let i = 0; i < this.particles.length; i++) {
      let particle = this.particles[i];
      this.frontMesh.geometry.attributes['position'].setXYZ(i, particle.position.x, particle.position.y, particle.position.z);
    }

    this.frontMesh.geometry.attributes['position'].needsUpdate = true;
    this.frontMesh.geometry.computeVertexNormals();
  }

  getGeometry(): Object3D[] {
    const geometry: Object3D[] = [];
    this.particles.forEach(particle => {
      geometry.push(particle.mesh);
    });
    this.springs.forEach(spring => {
      geometry.push(spring.lineMesh);
    });
    return geometry;
  }

  getCenter(): Vector3 {
    const firstParticle = this.particles[0];
    const lastParticle = this.particles[this.particles.length - 1];
    const center = firstParticle.position.clone().add(lastParticle.position).multiplyScalar(0.5);
    return center;
  }
}
