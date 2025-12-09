# p5 Vector Curve Editor

A lightweight p5.js-powered editor for turning raster images into editable Bezier curves. Upload an image, add and adjust points/handles, then export the curve data as JSON for later playback or rendering inside p5.

## Features
- Upload an image as a canvas backdrop while you trace curves
- Add, remove, and drag anchor points as well as their in/out handles
- Save the current curve to a portable JSON format
- Load the saved JSON back into the editor or sample it with `evaluateCurve(t)` to draw inside p5.js
- Optionally close the path to loop between the first and last anchors

## Getting started
1. Open `index.html` in a browser (no build step needed).
2. Upload an image (optional) and start placing points on the canvas.
3. Drag anchors or handles to sculpt the path; hold **Shift** to mirror handles while dragging.
4. Toggle **Close path** to loop the end of the curve back to the start.
5. Click **Save curve JSON** to download the current curve, or **Load curve JSON** to reload a saved file.

## JSON format
Exported files follow this structure:

```json
{
  "version": 1,
  "canvas": { "width": 960, "height": 720 },
  "closed": false,
  "image": { "dataUrl": "data:image/...", "name": "optional-filename" },
  "points": [
    {
      "position": { "x": 120, "y": 140 },
      "inHandle": { "x": 80, "y": 140 },
      "outHandle": { "x": 160, "y": 140 }
    }
  ]
}
```

## Sampling a saved curve
Load `reader.js` (or import `loadCurveData` as a module) and create an evaluator:

```js
import { loadCurveData } from './reader.js';

const evaluator = loadCurveData(curveJson);
const pt = evaluator.evaluateCurve(0.5); // -> { x, y }
```

Use `evaluateCurve(t)` with values from 0–1 to sample along the entire multi-segment path.
