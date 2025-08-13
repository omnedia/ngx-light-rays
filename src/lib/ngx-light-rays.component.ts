import {
  AfterViewInit,
  Component,
  ElementRef,
  Inject,
  Input,
  OnDestroy,
  PLATFORM_ID,
  signal,
  ViewChild,
} from '@angular/core';
import {CommonModule, isPlatformBrowser} from '@angular/common';
import {Mesh, Program, Renderer, Triangle} from 'ogl';
import {RaysOrigin} from './ngx-light-rays.types';

@Component({
  selector: 'om-light-rays',
  imports: [CommonModule],
  templateUrl: './ngx-light-rays.component.html',
  styleUrl: './ngx-light-rays.component.scss',
  standalone: true,
})
export class NgxLightRaysComponent implements AfterViewInit, OnDestroy {
  @ViewChild('container', {static: true}) containerRef!: ElementRef<HTMLDivElement>;

  @Input() raysOrigin: RaysOrigin = 'top-center';
  @Input() raysColor: string = '#ffffff';
  @Input() raysSpeed = 1;
  @Input() lightSpread = 1;
  @Input() rayLength = 2;
  @Input() pulsating = false;
  @Input() fadeDistance = 1.0;
  @Input() saturation = 1.0;
  @Input() followMouse = false;
  @Input() mouseInfluence = 0.1;
  @Input() noiseAmount = 0.0;
  @Input() distortion = 0.0;
  @Input() styleClass?: string;

  private renderer?: Renderer;
  private program?: Program;
  private mesh?: Mesh;
  private animationId: number | null = null;
  private intersectionObserver?: IntersectionObserver;

  private uniforms: any | null = null;

  private mouse = {x: 0.5, y: 0.5};
  private smoothMouse = {x: 0.5, y: 0.5};
  private mouseMoveHandler?: (e: MouseEvent) => void;

  isInView = signal(false);

  constructor(@Inject(PLATFORM_ID) private platformId: object) {
  }

  private readonly vert = `
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

  private readonly frag = `
  precision highp float;
  uniform float iTime;
  uniform vec2  iResolution;
  uniform vec2  rayPos;
  uniform vec2  rayDir;
  uniform vec3  raysColor;
  uniform float raysSpeed;
  uniform float lightSpread;
  uniform float rayLength;
  uniform float pulsating;
  uniform float fadeDistance;
  uniform float saturation;
  uniform vec2  mousePos;
  uniform float mouseInfluence;
  uniform float noiseAmount;
  uniform float distortion;

  varying vec2 vUv;

  float noise(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
  }

  float rayStrength(vec2 raySource, vec2 rayRefDirection, vec2 coord,
                    float seedA, float seedB, float speed) {
    vec2 sourceToCoord = coord - raySource;
    vec2 dirNorm = normalize(sourceToCoord);
    float cosAngle = dot(dirNorm, rayRefDirection);

    float distortedAngle = cosAngle + distortion * sin(iTime * 2.0 + length(sourceToCoord) * 0.01) * 0.2;

    float spreadFactor = pow(max(distortedAngle, 0.0), 1.0 / max(lightSpread, 0.001));

    float distance = length(sourceToCoord);
    float unit = max(iResolution.x, iResolution.y);
    float maxDistance  = unit * rayLength;
    float lengthFalloff = clamp((maxDistance - distance) / maxDistance, 0.0, 1.0);

    float fadeMax   = unit * fadeDistance;
    float fadeFalloff = clamp((fadeMax - distance) / fadeMax, 0.5, 1.0);

    float pulse = pulsating > 0.5 ? (0.8 + 0.2 * sin(iTime * speed * 3.0)) : 1.0;

    float baseStrength = clamp(
      (0.45 + 0.15 * sin(distortedAngle * seedA + iTime * speed)) +
      (0.3 + 0.2 * cos(-distortedAngle * seedB + iTime * speed)),
      0.0, 1.0
    );

    return baseStrength * lengthFalloff * fadeFalloff * spreadFactor * pulse;
  }

  void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 coord = vec2(fragCoord.x, iResolution.y - fragCoord.y);

    vec2 finalRayDir = rayDir;
    if (mouseInfluence > 0.0) {
      vec2 mouseScreenPos = mousePos * iResolution.xy;
      vec2 mouseDirection = normalize(mouseScreenPos - rayPos);
      finalRayDir = normalize(mix(rayDir, mouseDirection, mouseInfluence));
    }

    vec4 rays1 = vec4(1.0) * rayStrength(rayPos, finalRayDir, coord, 36.2214, 21.11349, 1.5 * raysSpeed);
    vec4 rays2 = vec4(1.0) * rayStrength(rayPos, finalRayDir, coord, 22.3991, 18.0234, 1.1 * raysSpeed);

    fragColor = rays1 * 0.5 + rays2 * 0.4;

    if (noiseAmount > 0.0) {
      float n = noise(coord * 0.01 + iTime * 0.1);
      fragColor.rgb *= (1.0 - noiseAmount + noiseAmount * n);
    }

    vec2 rayN = normalize(finalRayDir);
    float coordAlong = dot(coord - rayPos, rayN);
    float extent = iResolution.x * rayLength;
    float brightness = clamp(1.0 - coordAlong / extent, 0.0, 1.0);

    fragColor.x *= 0.1 + brightness * 0.8;
    fragColor.y *= 0.3 + brightness * 0.6;
    fragColor.z *= 0.5 + brightness * 0.5;

    if (saturation != 1.0) {
      float gray = dot(fragColor.rgb, vec3(0.299, 0.587, 0.114));
      fragColor.rgb = mix(vec3(gray), fragColor.rgb, saturation);
    }

    fragColor.rgb *= raysColor;
  }

  void main() {
    vec4 color;
    mainImage(color, gl_FragCoord.xy);
    gl_FragColor = color;
  }
`;

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const container = this.containerRef.nativeElement;

    this.intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        this.isInView.set(entry.isIntersecting);
        if (entry.isIntersecting) this.initAndStart();
        else this.stopAndCleanup();
      },
      {threshold: 0.1}
    );
    this.intersectionObserver.observe(container);
  }

  private initAndStart() {
    this.stopAndCleanup();

    const container = this.containerRef.nativeElement;

    this.renderer = new Renderer({
      dpr: Math.min(window.devicePixelRatio, 2),
      alpha: true,
    });

    const gl = this.renderer.gl;
    gl.canvas.style.width = '100%';
    gl.canvas.style.height = '100%';

    while (container.firstChild) container.removeChild(container.firstChild);
    container.appendChild(gl.canvas);

    this.uniforms = {
      iTime: {value: 0},
      iResolution: {value: [1, 1]},

      rayPos: {value: [0, 0]},
      rayDir: {value: [0, 1]},

      raysColor: {value: this.hexToRgb(this.raysColor)},
      raysSpeed: {value: this.raysSpeed},
      lightSpread: {value: this.lightSpread},
      rayLength: {value: this.rayLength},
      pulsating: {value: this.pulsating ? 1.0 : 0.0},
      fadeDistance: {value: this.fadeDistance},
      saturation: {value: this.saturation},
      mousePos: {value: [0.5, 0.5]},
      mouseInfluence: {value: this.mouseInfluence},
      noiseAmount: {value: this.noiseAmount},
      distortion: {value: this.distortion},
    };

    const geometry = new Triangle(gl);
    this.program = new Program(gl, {
      vertex: this.vert,
      fragment: this.frag,
      uniforms: this.uniforms,
    });
    this.mesh = new Mesh(gl, {geometry, program: this.program});

    const updatePlacement = () => {
      if (!this.renderer || !this.uniforms) return;
      this.renderer.dpr = Math.min(window.devicePixelRatio, 2);
      const wCSS = container.clientWidth;
      const hCSS = container.clientHeight;
      this.renderer.setSize(wCSS, hCSS);
      const dpr = this.renderer.dpr;
      const w = wCSS * dpr;
      const h = hCSS * dpr;
      this.uniforms.iResolution.value = [w, h];

      const {anchor, dir} = this.getAnchorAndDir(this.raysOrigin, w, h);
      this.uniforms.rayPos.value = anchor;
      this.uniforms.rayDir.value = dir;
    };

    window.addEventListener('resize', updatePlacement);
    this._cleanupFns.push(() => window.removeEventListener('resize', updatePlacement));
    updatePlacement();

    if (this.followMouse) {
      this.mouseMoveHandler = (e: MouseEvent) => {
        const rect = container.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;
        this.mouse = {x, y};
      };
      window.addEventListener('mousemove', this.mouseMoveHandler);
      this._cleanupFns.push(() => {
        if (this.mouseMoveHandler) window.removeEventListener('mousemove', this.mouseMoveHandler);
      });
    }

    const loop = (t: number) => {
      if (!this.renderer || !this.program || !this.mesh || !this.uniforms) return;

      this.uniforms.iTime.value = t * 0.001;

      if (this.followMouse && this.mouseInfluence > 0.0) {
        const smoothing = 0.92;
        this.smoothMouse.x = this.smoothMouse.x * smoothing + this.mouse.x * (1 - smoothing);
        this.smoothMouse.y = this.smoothMouse.y * smoothing + this.mouse.y * (1 - smoothing);
        this.uniforms.mousePos.value = [this.smoothMouse.x, this.smoothMouse.y];
      }

      this.uniforms.raysColor.value = this.hexToRgb(this.raysColor);
      this.uniforms.raysSpeed.value = this.raysSpeed;
      this.uniforms.lightSpread.value = this.lightSpread;
      this.uniforms.rayLength.value = this.rayLength;
      this.uniforms.pulsating.value = this.pulsating ? 1.0 : 0.0;
      this.uniforms.fadeDistance.value = this.fadeDistance;
      this.uniforms.saturation.value = this.saturation;
      this.uniforms.mouseInfluence.value = this.mouseInfluence;
      this.uniforms.noiseAmount.value = this.noiseAmount;
      this.uniforms.distortion.value = this.distortion;

      try {
        this.renderer.render({scene: this.mesh});
        this.animationId = requestAnimationFrame(loop);
      } catch (err) {
        this.animationId && cancelAnimationFrame(this.animationId);
        this.animationId = null;
      }
    };

    this.animationId = requestAnimationFrame(loop);
  }

  private stopAndCleanup() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    if (this.mouseMoveHandler) {
      window.removeEventListener('mousemove', this.mouseMoveHandler);
      this.mouseMoveHandler = undefined;
    }

    this._cleanupFns.splice(0).forEach((fn) => fn());

    if (this.renderer) {
      try {
        const loseCtx = this.renderer.gl.getExtension('WEBGL_lose_context');
        loseCtx?.loseContext();
        const canvas = this.renderer.gl.canvas;
        canvas?.parentNode?.removeChild(canvas);
      } catch {
      }
    }

    this.mesh = undefined;
    this.program = undefined;
    this.renderer = undefined;
    this.uniforms = null;
  }

  ngOnDestroy(): void {
    this.intersectionObserver?.disconnect();
    this.stopAndCleanup();
  }

  private hexToRgb(hex: string): [number, number, number] {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return m
      ? [
        parseInt(m[1], 16) / 255,
        parseInt(m[2], 16) / 255,
        parseInt(m[3], 16) / 255,
      ]
      : [1, 1, 1];
  }

  private getAnchorAndDir(
    origin: RaysOrigin,
    w: number,
    h: number
  ): { anchor: [number, number]; dir: [number, number] } {
    const outside = 0.2;
    switch (origin) {
      case 'top-left':
        return {anchor: [0, -outside * h], dir: [0, 1]};
      case 'top-right':
        return {anchor: [w, -outside * h], dir: [0, 1]};
      case 'left':
        return {anchor: [-outside * w, 0.5 * h], dir: [1, 0]};
      case 'right':
        return {anchor: [(1 + outside) * w, 0.5 * h], dir: [-1, 0]};
      case 'bottom-left':
        return {anchor: [0, (1 + outside) * h], dir: [0, -1]};
      case 'bottom-center':
        return {anchor: [0.5 * w, (1 + outside) * h], dir: [0, -1]};
      case 'bottom-right':
        return {anchor: [w, (1 + outside) * h], dir: [0, -1]};
      default: // 'top-center'
        return {anchor: [0.5 * w, -outside * h], dir: [0, 1]};
    }
  }

  private _cleanupFns: Array<() => void> = [];
}
