const state = {
  points: [],
  selected: null,
  imageDataUrl: null,
  imageName: null,
  image: null,
  mode: 'add',
  canvasSize: { width: 960, height: 720 },
  closed: false,
  transform: { scale: 1, offset: { x: 0, y: 0 } },
  resolution: { width: 960, height: 720 },
  pointSize: 14,
  isPanning: false,
  lastMouse: { x: 0, y: 0 },
  defaultPointMode: 'smooth',
};

function setup() {
  const canvas = createCanvas(state.canvasSize.width, state.canvasSize.height);
  canvas.parent('canvas-container');
  pixelDensity(1);
  strokeCap(ROUND);
  noFill();
  setupUi();
  updateTransform();
}

function updateTransform() {
  if (!state.image) {
    state.transform = { scale: 1, offset: { x: 0, y: 0 } };
    state.resolution = { ...state.canvasSize };
    return;
  }
  
  const imgW = state.image.width;
  const imgH = state.image.height;
  state.resolution = { width: imgW, height: imgH };
  
  const scaleX = state.canvasSize.width / imgW;
  const scaleY = state.canvasSize.height / imgH;
  const scale = Math.min(scaleX, scaleY);
  
  const offsetX = (state.canvasSize.width - imgW * scale) / 2;
  const offsetY = (state.canvasSize.height - imgH * scale) / 2;
  
  state.transform = { scale, offset: { x: offsetX, y: offsetY } };
}

function worldToScreen(x, y) {
  // If input is an object {x, y}
  if (typeof x === 'object') {
    y = x.y;
    x = x.x;
  }
  return {
    x: x * state.transform.scale + state.transform.offset.x,
    y: y * state.transform.scale + state.transform.offset.y
  };
}

function screenToWorld(x, y) {
  return {
    x: (x - state.transform.offset.x) / state.transform.scale,
    y: (y - state.transform.offset.y) / state.transform.scale
  };
}

function draw() {
  background('#0b1220');
  
  if (state.image) {
    const { scale: s, offset } = state.transform;
    image(state.image, offset.x, offset.y, state.image.width * s, state.image.height * s);
  }

  drawCurve();
  drawPoints();
  drawOverlay();
}

function drawCurve() {
  if (state.points.length < 2) return;
  stroke('#22d3ee');
  strokeWeight(2);
  noFill();

  const segments = getSegments();
  segments.forEach((seg) => {
    const p0 = worldToScreen(seg.p0);
    const p1 = worldToScreen(seg.p1);
    const p2 = worldToScreen(seg.p2);
    const p3 = worldToScreen(seg.p3);
    
    bezier(p0.x, p0.y, p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
  });
}

function drawPoints() {
  if (state.pointSize <= 0) return;
  
  strokeWeight(1);
  const handleSize = Math.max(4, state.pointSize * 0.7); // Scale handles relative to points, min 4px

  for (let i = 0; i < state.points.length; i++) {
    const pt = state.points[i];
    const isSelected = state.selected && state.selected.index === i;

    const pos = worldToScreen(pt.position);
    const inH = worldToScreen(pt.inHandle);
    const outH = worldToScreen(pt.outHandle);

    // Only draw handles if selected, to reduce clutter when checking curve
    if (isSelected) {
        // Handle lines
        stroke('#94a3b8');
        line(pos.x, pos.y, inH.x, inH.y);
        line(pos.x, pos.y, outH.x, outH.y);

        // Handles
        fill('#1e293b');
        stroke('#22d3ee');
        circle(inH.x, inH.y, handleSize);
        circle(outH.x, outH.y, handleSize);
    }

    // Anchor
    fill(isSelected ? '#22d3ee' : '#f8fafc');
    stroke('#0f172a');
    circle(pos.x, pos.y, state.pointSize);
  }
}

function drawOverlay() {
  noStroke();
  fill(0, 0, 0, 80);
  rect(0, 0, width, 24);
  fill('#e2e8f0');
  textSize(12);
  textAlign(LEFT, CENTER);
  const closedLabel = state.closed ? 'Closed' : 'Open';
  text(`Mode: ${state.mode.toUpperCase()} | Points: ${state.points.length} | ${closedLabel}`, 10, 12);
}

function mousePressed() {
  if (!mouseInCanvas()) return;
  state.lastMouse = { x: mouseX, y: mouseY };

  // Middle mouse or Ctrl + Click for panning
  if (mouseButton === CENTER || (keyIsDown(CONTROL) && mouseButton === LEFT)) {
    state.isPanning = true;
    return;
  }

  if (state.mode === 'add') {
    const worldPos = screenToWorld(mouseX, mouseY);
    addPoint(worldPos.x, worldPos.y);
  } else if (state.mode === 'remove') {
    const hit = hitTest(mouseX, mouseY);
    if (hit && hit.type === 'point') {
      state.points.splice(hit.index, 1);
      state.selected = null;
      updatePointModeUI();
    }
  } else if (state.mode === 'adjust') {
    state.selected = hitTest(mouseX, mouseY);
    updatePointModeUI();
    
    // If we clicked on nothing in adjust mode, start panning
    if (!state.selected) {
        state.isPanning = true;
    }
  }
}

function mouseDragged() {
  if (!mouseInCanvas()) return;

  if (state.isPanning) {
    const dx = mouseX - state.lastMouse.x;
    const dy = mouseY - state.lastMouse.y;
    state.transform.offset.x += dx;
    state.transform.offset.y += dy;
    state.lastMouse = { x: mouseX, y: mouseY };
    return;
  }

  if (!state.selected || state.mode !== 'adjust') return;

  const { index, type } = state.selected;
  const pt = state.points[index];
  const worldPos = screenToWorld(mouseX, mouseY);

  if (type === 'point') {
    const offset = { x: worldPos.x - pt.position.x, y: worldPos.y - pt.position.y };
    pt.position.x = worldPos.x;
    pt.position.y = worldPos.y;
    pt.inHandle.x += offset.x;
    pt.inHandle.y += offset.y;
    pt.outHandle.x += offset.x;
    pt.outHandle.y += offset.y;
  } else if (type === 'inHandle') {
    pt.inHandle.x = worldPos.x;
    pt.inHandle.y = worldPos.y;
    
    // Smooth mode: mirror outHandle
    if (pt.mode === 'smooth') {
      const dx = pt.position.x - pt.inHandle.x;
      const dy = pt.position.y - pt.inHandle.y;
      pt.outHandle.x = pt.position.x + dx;
      pt.outHandle.y = pt.position.y + dy;
    } else if (keyIsDown(SHIFT)) { 
      // Legacy shift behavior for 'broken' mode
      const dx = pt.position.x - pt.inHandle.x;
      const dy = pt.position.y - pt.inHandle.y;
      pt.outHandle.x = pt.position.x + dx;
      pt.outHandle.y = pt.position.y + dy;
    }
  } else if (type === 'outHandle') {
    pt.outHandle.x = worldPos.x;
    pt.outHandle.y = worldPos.y;

    // Smooth mode: mirror inHandle
    if (pt.mode === 'smooth') {
      const dx = pt.position.x - pt.outHandle.x;
      const dy = pt.position.y - pt.outHandle.y;
      pt.inHandle.x = pt.position.x + dx;
      pt.inHandle.y = pt.position.y + dy;
    } else if (keyIsDown(SHIFT)) {
      const dx = pt.position.x - pt.outHandle.x;
      const dy = pt.position.y - pt.outHandle.y;
      pt.inHandle.x = pt.position.x + dx;
      pt.inHandle.y = pt.position.y + dy;
    }
  }
  
  state.lastMouse = { x: mouseX, y: mouseY };
}

function mouseReleased() {
  state.isPanning = false;
  // Don't deselect immediately to allow UI interaction
  // state.selected = null; 
}

function mouseWheel(event) {
  if (!mouseInCanvas()) return;
  
  const zoomFactor = 0.1;
  const zoomIn = event.delta < 0;
  const newScale = zoomIn ? state.transform.scale * (1 + zoomFactor) : state.transform.scale / (1 + zoomFactor);
  
  // Limit min/max zoom
  if (newScale < 0.05 || newScale > 20) return;
  
  // Zoom towards mouse
  const worldMouse = screenToWorld(mouseX, mouseY);
  
  state.transform.scale = newScale;
  
  // Calculate new offset to keep worldMouse at mouseX, mouseY
  // screenX = worldX * scale + offsetX
  // offsetX = screenX - worldX * scale
  state.transform.offset.x = mouseX - worldMouse.x * newScale;
  state.transform.offset.y = mouseY - worldMouse.y * newScale;
  
  // Prevent default scrolling behavior
  return false;
}

function mouseInCanvas() {
  return mouseX >= 0 && mouseX <= width && mouseY >= 0 && mouseY <= height;
}

function addPoint(x, y) {
  // Default values
  let inHandle = { x: x - 40, y };
  let outHandle = { x: x + 40, y };
  
  // Smart initialization based on previous point
  if (state.points.length > 0) {
     const prev = state.points[state.points.length - 1];
     const dx = x - prev.position.x;
     const dy = y - prev.position.y;
     const dist = Math.sqrt(dx*dx + dy*dy);
     
     if (dist > 0.001) {
        // Tangent direction is simply the vector from prev to current
        // Ideally we might want to continue the curvature, but linear projection is a safe default
        const nx = dx / dist;
        const ny = dy / dist;
        const handleLen = dist * 0.3; // Heuristic length
        
        inHandle = { x: x - nx * handleLen, y: y - ny * handleLen };
        outHandle = { x: x + nx * handleLen, y: y + ny * handleLen };
        
        // Also adjust the previous point's outHandle to point towards the new point
        // This creates a smooth flow coming INTO the new segment
        // Only do this if the previous point is also in 'smooth' mode or if we want to force valid tangents
        
        // Use defaultPointMode to decide if we strictly enforce smooth on the previous point
        // Logic: 
        // 1. We ALWAYS adjust prev.outHandle to point to the new location (to make the segment nice)
        // 2. BUT, we only rotate prev.inHandle (affecting previous segment) if prev.mode is 'smooth'
        
        prev.outHandle.x = prev.position.x + nx * handleLen;
        prev.outHandle.y = prev.position.y + ny * handleLen;
        
        if (prev.mode === 'smooth') {
             const pdx = prev.position.x - prev.outHandle.x;
             const pdy = prev.position.y - prev.outHandle.y;
             // Keep the original length of the inHandle? Or mirror the new length?
             // Usually mirroring length is good for symmetry, but might destroy the previous segment shape.
             // Let's preserve the original inHandle length but rotate it.
             const originalInDx = prev.inHandle.x - prev.position.x;
             const originalInDy = prev.inHandle.y - prev.position.y;
             const originalInLen = Math.sqrt(originalInDx*originalInDx + originalInDy*originalInDy);
             
             // Normalize the new direction (which is opposite to outHandle)
             const newDirX = pdx / Math.sqrt(pdx*pdx + pdy*pdy);
             const newDirY = pdy / Math.sqrt(pdx*pdx + pdy*pdy);
             
             prev.inHandle.x = prev.position.x + newDirX * originalInLen;
             prev.inHandle.y = prev.position.y + newDirY * originalInLen;
        }
     }
  }

  // If adding in Broken mode, we shouldn't force the NEW point handles to be perfectly aligned 
  // with the incoming tangent if we don't want to. 
  // However, initially aligning them to the flow is usually helpful even for broken points.
  // The User logic requested: "if broken mode, then it should just be broke, where only the second half of the previous point should be adjust"
  
  // My logic above does exactly that:
  // 1. It ALWAYS adjusts prev.outHandle (the "second half of the previous point") to point to new point.
  // 2. It ONLY adjusts prev.inHandle (the "first half") if prev is smooth.
  // 3. The NEW point is created with aligned handles initially. Since it's 'broken', the user can immediately move them independently.
  
  state.points.push({
    position: { x, y },
    inHandle,
    outHandle,
    mode: state.defaultPointMode
  });
  
  // Auto-select the new point
  if (state.mode === 'adjust') {
    state.selected = { type: 'point', index: state.points.length - 1 };
    updatePointModeUI();
  }
}

function hitTest(x, y) {
  if (state.pointSize <= 0) return null; // Cannot interact with hidden points
  
  const radius = Math.max(10, state.pointSize / 2 + 2); // Dynamic hit area, min 10px
  
  for (let i = 0; i < state.points.length; i++) {
    const pt = state.points[i];
    
    // Project to screen space for hit testing
    const pos = worldToScreen(pt.position);
    const inH = worldToScreen(pt.inHandle);
    const outH = worldToScreen(pt.outHandle);
    
    // Check handles first (they are usually smaller/on top visually)
    // Only check handles if the point is selected or if we want to allow handle grabbing generally
    // (Logic modified in drawPoints to only show handles when selected, let's mirror that for hit testing logic or keep it permissive?)
    // Let's keep hit testing permissive but prioritize what's visible. 
    // If handles are hidden in drawPoints (not selected), we probably shouldn't be able to grab them easily unless we select the point first.
    // However, existing logic didn't strictly hide handles. 
    // New draw logic: handles only drawn if selected.
    
    const isSelected = state.selected && state.selected.index === i;
    
    if (isSelected) {
        if (dist(x, y, inH.x, inH.y) <= radius) {
          return { type: 'inHandle', index: i };
        }
        if (dist(x, y, outH.x, outH.y) <= radius) {
          return { type: 'outHandle', index: i };
        }
    }

    if (dist(x, y, pos.x, pos.y) <= radius) {
      return { type: 'point', index: i };
    }
  }
  return null;
}

function getSegments() {
  const segments = [];
  if (state.points.length < 2) return segments;
  const limit = state.closed ? state.points.length : state.points.length - 1;
  for (let i = 0; i < limit; i++) {
    const a = state.points[i];
    const b = state.points[(i + 1) % state.points.length];
    segments.push({
      p0: a.position,
      p1: a.outHandle,
      p2: b.inHandle,
      p3: b.position,
    });
  }
  return segments;
}

function setupUi() {
  const fileInput = document.getElementById('image-input');
  const fileName = document.getElementById('file-name');
  const addButton = document.getElementById('add-point');
  const removeButton = document.getElementById('remove-point');
  const adjustButton = document.getElementById('adjust-point');
  const saveButton = document.getElementById('save-data');
  const loadButton = document.getElementById('load-data');
  const clearButton = document.getElementById('clear-data');
  const closedToggle = document.getElementById('toggle-closed');
  const modeBroken = document.getElementById('mode-broken');
  const modeSmooth = document.getElementById('mode-smooth');
  const pointSizeSlider = document.getElementById('point-size');
  const pointSizeValue = document.getElementById('point-size-value');
  const defaultModeBroken = document.getElementById('default-mode-broken');
  const defaultModeSmooth = document.getElementById('default-mode-smooth');

  fileInput.addEventListener('change', (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result;
      if (!dataUrl) return;
      state.imageDataUrl = dataUrl.toString();
      state.imageName = file.name;
      loadImage(state.imageDataUrl, (img) => {
        state.image = img;
        fileName.textContent = file.name;
        updateTransform();
      });
    };
    reader.readAsDataURL(file);
  });

  addButton.addEventListener('click', () => switchMode('add'));
  removeButton.addEventListener('click', () => switchMode('remove'));
  adjustButton.addEventListener('click', () => switchMode('adjust'));
  saveButton.addEventListener('click', saveCurveData);
  loadButton.addEventListener('change', loadCurveDataFromFile);
  clearButton.addEventListener('click', clearCanvas);
  closedToggle.addEventListener('change', (e) => {
    state.closed = e.target.checked;
  });
  
  if (pointSizeSlider) {
    pointSizeSlider.addEventListener('input', (e) => {
        state.pointSize = parseInt(e.target.value, 10);
        if (pointSizeValue) pointSizeValue.textContent = state.pointSize;
    });
  }
  
  if (modeBroken) modeBroken.addEventListener('click', () => setPointMode('broken'));
  if (modeSmooth) modeSmooth.addEventListener('click', () => setPointMode('smooth'));

  if (defaultModeBroken) defaultModeBroken.addEventListener('click', () => setDefaultPointMode('broken'));
  if (defaultModeSmooth) defaultModeSmooth.addEventListener('click', () => setDefaultPointMode('smooth'));
}

function switchMode(mode) {
  state.mode = mode;
  ['add-point', 'remove-point', 'adjust-point'].forEach((id) => {
    const button = document.getElementById(id);
    if (button) button.classList.toggle('active', id.startsWith(mode));
  });
  
  // Deselect if switching away from adjust (optional, but cleaner)
  if (mode !== 'adjust') {
    state.selected = null;
    updatePointModeUI();
  }
}

function saveCurveData() {
  const payload = serializeCurve();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  
  const name = state.imageName ? state.imageName.replace(/\.[^/.]+$/, "") : 'curve-data';
  link.download = `${name}.json`;
  
  link.click();
  URL.revokeObjectURL(url);
}

// Utility exposed for external use when p5 is available.
function serializeCurve() {
  const meta = calculateCurveMetadata();
  return {
    version: 1,
    canvas: { width, height },
    resolution: { ...state.resolution }, // Save reference resolution
    closed: state.closed,
    image: state.imageName ? { name: state.imageName } : null,
    totalLength: meta.totalLength,
    points: state.points.map((pt) => ({
      position: { ...pt.position },
      inHandle: { ...pt.inHandle },
      outHandle: { ...pt.outHandle },
      mode: pt.mode || 'broken'
    })),
    segments: meta.segments, // Store calculated lengths
  };
}

function calculateCurveMetadata() {
  const segments = getSegments();
  const metaSegments = [];
  let totalLength = 0;

  segments.forEach(seg => {
    const len = estimateBezierLength(seg.p0, seg.p1, seg.p2, seg.p3);
    metaSegments.push({ length: len });
    totalLength += len;
  });

  return { totalLength, segments: metaSegments };
}

function estimateBezierLength(p0, p1, p2, p3, steps = 20) {
  let len = 0;
  let prevX = p0.x;
  let prevY = p0.y;

  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const pt = cubicBezierPoint(p0, p1, p2, p3, t);
    const dx = pt.x - prevX;
    const dy = pt.y - prevY;
    len += Math.sqrt(dx * dx + dy * dy);
    prevX = pt.x;
    prevY = pt.y;
  }
  return len;
}

function cubicBezierPoint(p0, p1, p2, p3, t) {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  const uuu = uu * u;
  const ttt = tt * t;

  const x = uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x;
  const y = uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y;
  return { x, y };
}

window.serializeCurve = serializeCurve;

function loadCurveDataFromFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const json = JSON.parse(e.target?.result);
      applyCurveData(json);
    } catch (err) {
      console.error('Failed to load curve JSON', err);
    }
  };
  reader.readAsText(file);
}

function applyCurveData(data) {
  if (!data || !Array.isArray(data.points)) return;
  state.points = data.points.map((pt) => ({
    position: { ...pt.position },
    inHandle: { ...pt.inHandle },
    outHandle: { ...pt.outHandle },
    mode: pt.mode || 'broken'
  }));
  state.closed = Boolean(data.closed);
  const closedToggle = document.getElementById('toggle-closed');
  if (closedToggle) closedToggle.checked = state.closed;

  if (data.image?.dataUrl) {
    state.imageDataUrl = data.image.dataUrl;
    state.imageName = data.image.name || 'embedded-image';
    const fileName = document.getElementById('file-name');
    loadImage(state.imageDataUrl, (img) => {
      state.image = img;
      if (fileName) fileName.textContent = state.imageName;
      updateTransform();
    });
  }
}

function clearCanvas() {
  state.points = [];
  state.selected = null;
  state.closed = false;
  state.image = null;
  state.imageDataUrl = null;
  state.imageName = null;
  updateTransform();
  
  const closedToggle = document.getElementById('toggle-closed');
  if (closedToggle) closedToggle.checked = false;
  const fileName = document.getElementById('file-name');
  if (fileName) fileName.textContent = 'No image loaded';
  updatePointModeUI();
}

function updatePointModeUI() {
  const container = document.getElementById('point-mode-container');
  const newPointContainer = document.getElementById('new-point-mode-container');

  // Toggle visibility of the "Next Point Mode" selector
  // Show it when NOT selecting a specific point, OR maybe always show it? 
  // Let's hide it when a point is selected to avoid confusion about which "mode" is being changed.
  if (state.selected && state.selected.type === 'point') {
      if (newPointContainer) newPointContainer.style.display = 'none';
  } else {
      if (newPointContainer) newPointContainer.style.display = 'block';
  }
  
  if (!container) return;
  
  if (!state.selected || state.selected.type !== 'point') { 
    if (state.selected) {
        // ok
    } else {
        container.style.display = 'none';
        return;
    }
  }
  
  container.style.display = 'block';
  
  const pt = state.points[state.selected.index];
  const mode = pt.mode || 'broken';
  
  const btnBroken = document.getElementById('mode-broken');
  const btnSmooth = document.getElementById('mode-smooth');
  
  if (btnBroken) {
      btnBroken.classList.toggle('active', mode === 'broken');
  }
  if (btnSmooth) {
      btnSmooth.classList.toggle('active', mode === 'smooth');
  }
}

function setDefaultPointMode(mode) {
    state.defaultPointMode = mode;
    const btnBroken = document.getElementById('default-mode-broken');
    const btnSmooth = document.getElementById('default-mode-smooth');
    if (btnBroken) btnBroken.classList.toggle('active', mode === 'broken');
    if (btnSmooth) btnSmooth.classList.toggle('active', mode === 'smooth');
}

function setPointMode(mode) {
  if (!state.selected) return;
  const pt = state.points[state.selected.index];
  
  if (pt.mode === mode) return; // No change
  
  pt.mode = mode;
  
  if (mode === 'smooth') {
    // Snap handles to be smooth
    // Align outHandle to be opposite of inHandle, preserving outHandle length
    const dx = pt.position.x - pt.inHandle.x;
    const dy = pt.position.y - pt.inHandle.y;
    const distIn = Math.sqrt(dx*dx + dy*dy);
    
    // Vector In -> Pos
    
    const odx = pt.outHandle.x - pt.position.x;
    const ody = pt.outHandle.y - pt.position.y;
    const distOut = Math.sqrt(odx*odx + ody*ody);
    
    if (distIn > 0.001) {
        // Set Out = Pos + (In->Pos / len) * outLen
        pt.outHandle.x = pt.position.x + (dx / distIn) * distOut;
        pt.outHandle.y = pt.position.y + (dy / distIn) * distOut;
    }
  }
  
  updatePointModeUI();
}
