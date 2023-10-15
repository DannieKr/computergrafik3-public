import {AfterViewInit, Component, Input, ViewChild} from '@angular/core';
import {ColorRepresentation, Color, Scene, PerspectiveCamera, WebGLRenderer, PointLight, AmbientLight} from 'three';
import {Cloth, GRAVITY} from "../cloth_sim/cloth";
import {MatDialog, MatDialogConfig, MatDialogModule} from "@angular/material/dialog";
import {MatButtonModule} from "@angular/material/button";
import {MarkdownModule} from "ngx-markdown";

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements AfterViewInit {
  title = 'computergrafik';

  @ViewChild('canvas')
  private canvasRef: any;
  @Input() public clothDimension: number = 10;
  @Input() public particleMass: number = 0.1;
  @Input() public neighborSpringConstant: number = 1.5;
  @Input() public shearSpringConstant: number = 1.5;
  @Input() public bendingSpringConstant: number = 1.5;
  @Input() public hasNeighborSprings: boolean = true;
  @Input() public hasShearSprings: boolean = true;
  @Input() public hasBendSprings: boolean = true;
  @Input() public areSpringsColored: boolean = false;
  @Input() public bendingSpringsColor: ColorRepresentation = 0x0000ff;
  @Input() public neighborSpringsColor: ColorRepresentation = 0x00ff00;
  @Input() public shearSpringsColor: ColorRepresentation = 0xff0000;
  @Input() public gravity: number = GRAVITY.y;
  @Input() public deltaT: number = 0.1;
  @Input() public cameraZ: number = this.clothDimension * 80;
  @Input() public fieldOfView: number = 1;
  @Input() public nearClippingPane: number = 0.1;
  @Input() public farClippingPane: number = 100000;
  @Input() public interpolationMethod: string = "euler";
  @Input() public isMeshRendered: boolean = false;

  inputSchrittweite: number = this.deltaT;
  inputGravity: number = this.gravity;
  inputInterpolationMethod: string = this.interpolationMethod;

  private camera!: PerspectiveCamera;

  private get canvas(): HTMLCanvasElement {
    return this.canvasRef.nativeElement;
  }

  private cloth: Cloth = new Cloth(
    this.clothDimension,
    this.particleMass,
    this.neighborSpringConstant,
    this.shearSpringConstant,
    this.bendingSpringConstant,
    this.hasNeighborSprings,
    this.hasShearSprings,
    this.hasBendSprings,
    this.areSpringsColored ? this.neighborSpringsColor : undefined,
    this.areSpringsColored ? this.shearSpringsColor : undefined,
    this.areSpringsColored ? this.bendingSpringsColor : undefined,
    this.isMeshRendered
  );
  private renderer!: WebGLRenderer;
  private scene!: Scene;

  constructor(private dialog: MatDialog) {
  }

  ngAfterViewInit() {
    this.openDialog();
    this.createScene();
    this.startRenderingLoop();
  }

  private createScene() {
    this.scene = new Scene();
    this.scene.background = new Color(0x000000);

    if (!this.isMeshRendered) {
      this.cloth.getGeometry().forEach(mesh => {
        this.scene.add(mesh);
      });
    }

    this.scene.add(this.cloth.frontMesh);
    this.scene.add(this.cloth.backMesh);

    const aspectRatio = this.getAspectRatio();
    this.camera = new PerspectiveCamera(
      this.fieldOfView,
      aspectRatio,
      this.nearClippingPane,
      this.farClippingPane
    );

    const clothCenter = this.cloth.getCenter();
    this.camera.position.set(
      -this.clothDimension * 60,
      -this.clothDimension / 2,
      this.cameraZ
    )

    this.camera.lookAt(clothCenter.x, clothCenter.y - this.clothDimension / 2, clothCenter.z);
    this.camera.updateProjectionMatrix();

    const ambientLight = new AmbientLight(0x404040);
    this.scene.add(ambientLight);

    const light = new PointLight(0xFFFFFF, 1);
    light.position.set(this.camera.position.x - 10, this.camera.position.y, this.camera.position.z);
    this.scene.add(light);
  }

  private startRenderingLoop() {
    this.renderer = new WebGLRenderer({canvas: this.canvas});
    this.renderer.setPixelRatio(devicePixelRatio);
    this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight);

    let component: AppComponent = this;
    (function render() {
      requestAnimationFrame(render);
      component.renderer.render(component.scene, component.camera);
      if (component.interpolationMethod === "euler")
        component.cloth.updateEuler(component.deltaT);
      else if (component.interpolationMethod === "midpoint")
        component.cloth.updateMidpoint(component.deltaT);
    }());
  }

  private getAspectRatio() {
    return this.canvas.clientWidth / this.canvas.clientHeight;
  }

  resetCloth() {
    this.interpolationMethod = this.inputInterpolationMethod;
    this.deltaT = this.inputSchrittweite;
    GRAVITY.setY(this.inputGravity);
    this.cloth.reset();
    this.cloth = new Cloth(
      this.clothDimension,
      this.particleMass,
      this.neighborSpringConstant,
      this.shearSpringConstant,
      this.bendingSpringConstant,
      this.hasNeighborSprings,
      this.hasShearSprings,
      this.hasBendSprings,
      this.areSpringsColored ? this.neighborSpringsColor : undefined,
      this.areSpringsColored ? this.shearSpringsColor : undefined,
      this.areSpringsColored ? this.bendingSpringsColor : undefined,
      this.isMeshRendered
    );
    this.createScene();
  }

  openDialog() {
    const dialogConfig = new MatDialogConfig();

    dialogConfig.disableClose = true;
    dialogConfig.autoFocus = true;

    this.dialog.open(DialogTutorial, dialogConfig);
  }
}

@Component({
  selector: 'dialog-tutorial',
  templateUrl: 'dialog-tutorial.html',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MarkdownModule],
})
export class DialogTutorial {
}
