# ngx-light-rays

<a href="https://ngxui.com" target="_blank" style="display: flex;gap: .5rem;align-items: center;cursor: pointer; padding: 0 0 0 0; height: fit-content;">
  <img src="https://ngxui.com/assets/img/ngxui-logo.png" style="width: 64px;height: 64px;">
</a>

This library is part of the NGXUI ecosystem. <br>
View all available components at [https://ngxui.com](https://ngxui.com)

`@omnedia/ngx-light-rays` is an Angular library that renders animated, shader-driven light rays. It supports configurable origin, color, speed, spread, length, pulsation, and optional mouse-follow, producing cinematic volumetric streaks that work great as a dynamic background or hero accent.

## Features

* WebGL shader-based **light rays** with high performance.
* **Configurable origin** (top/left/right/bottom variants).
* **Color, speed, spread, length, pulsation**, noise and distortion controls.
* **Optional mouse-follow** with adjustable influence.
* Renders only when visible via **IntersectionObserver** for efficiency.
* Standalone Angular 20+ component.

## Installation

```bash
npm install @omnedia/ngx-light-rays ogl
```

## Usage

Import the `NgxLightRaysComponent` into your component:

```ts
import {Component} from '@angular/core';
import {NgxLightRaysComponent} from '@omnedia/ngx-light-rays';

@Component({
  selector: 'app-hero',
  standalone: true,
  imports: [NgxLightRaysComponent],
  template: `
    <section class="hero">
      <om-light-rays
        [raysOrigin]="'top-center'"
        [raysColor]="'#ffffff'"
        [raysSpeed]="1"
        [lightSpread]="1"
        [rayLength]="2"
        [pulsating]="false"
        [fadeDistance]="1.0"
        [saturation]="1.0"
        [followMouse]="false"
        [mouseInfluence]="0.1"
        [noiseAmount]="0.05"
        [distortion]="0.0"
        styleClass="rays"
      ></om-light-rays>
    </section>
  `,
  styles: [
    `.hero{ position:relative; height:480px; }`,
    `om-light-rays, .rays{ position:absolute; inset:0; display:block; }`
  ]
})
export class HeroComponent {
}
```

## How It Works

The component attaches a WebGL canvas and runs a fragment shader that accumulates ray intensity from a configurable origin. It updates only when in view and adapts to container size/scale. Optional mouse-follow adjusts the ray direction smoothly using a smoothed pointer position.

## API

```html

<om-light-rays
  [raysOrigin]="raysOrigin"
  [raysColor]="raysColor"
  [raysSpeed]="raysSpeed"
  [lightSpread]="lightSpread"
  [rayLength]="rayLength"
  [pulsating]="pulsating"
  [fadeDistance]="fadeDistance"
  [saturation]="saturation"
  [followMouse]="followMouse"
  [mouseInfluence]="mouseInfluence"
  [noiseAmount]="noiseAmount"
  [distortion]="distortion"
  [styleClass]="styleClass"
>
  <ng-content></ng-content>
</om-light-rays>
```

### Inputs

* `raysOrigin` (`RaysOrigin`, default `'top-center'`):
  `"top-center" | "top-left" | "top-right" | "right" | "left" | "bottom-center" | "bottom-right" | "bottom-left"`.
* `raysColor` (`string`, default `'#ffffff'`): Hex CSS color.
* `raysSpeed` (`number`, default `1`): Animation speed multiplier.
* `lightSpread` (`number`, default `1`): Beam spread; higher values tighten the rays.
* `rayLength` (`number`, default `2`): Effective length scale of rays.
* `pulsating` (`boolean`, default `false`): Enables subtle pulsing.
* `fadeDistance` (`number`, default `1.0`): Additional fade falloff distance scale.
* `saturation` (`number`, default `1.0`): Color saturation mix (0 = grayscale, 1 = original).
* `followMouse` (`boolean`, default `false`): Enable mouse-follow behavior.
* `mouseInfluence` (`number`, default `0.1`): Mix factor toward mouse direction when `followMouse` is true.
* `noiseAmount` (`number`, default `0.0`): Grain noise intensity.
* `distortion` (`number`, default `0.0`): Angular distortion amount (subtle wavy rays).
* `styleClass` (`string`, optional): Custom CSS class applied to the container.

## Examples

**Hero accent with subtle movement**

```html

<om-light-rays
  [raysOrigin]="'top-left'"
  [raysColor]="'#d2e7ff'"
  [raysSpeed]="0.7"
  [lightSpread]="1.2"
  [rayLength]="2.5"
  [pulsating]="true"
  [fadeDistance]="1.2"
  [saturation]="0.9"
  [followMouse]="false"
  [noiseAmount]="0.03"
  styleClass="cover"
>
  <ng-content></ng-content>
</om-light-rays>
```

**Interactive spotlight**

```html

<om-light-rays
  [raysOrigin]="'left'"
  [raysColor]="'#ffffff'"
  [followMouse]="true"
  [mouseInfluence]="0.2"
  [rayLength]="3"
  [lightSpread]="0.9"
  styleClass="cover"
>
  <p>Light Rays</p>
</om-light-rays>
```

## Styling

The component injects a canvas that fills its host container. Style the host or pass `styleClass` to position/size.

```css
.cover {
  position: absolute;
  inset: 0;
  display: block;
}

om-light-rays {
  display: block;
}
```

> **Tip:** Ensure the host element has an explicit height (e.g., via parent layout) so the canvas has space to render.

## Performance

* Rendering is paused when the element is not visible (IntersectionObserver).
* DPR is capped for efficiency.
* Use lower `noiseAmount`/`distortion` for extra performance headroom.

## Contributing

Contributions are welcome. Please open an issue or PR.

## License

MIT License.
