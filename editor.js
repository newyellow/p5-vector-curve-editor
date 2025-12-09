const state = {
  points: [],
  selected: null,
  imageDataUrl: null,
  imageName: null,
  image: null,
  mode: 'add',
  canvasSize: { width: 960, height: 720 },
  closed: false,
};

function setup() {
  const canvas = createCanvas(state.canvasSize.width, state.canvasSize.height);
  canvas.parent('canvas-container');
  pixelDensity(1);
  strokeCap(ROUND);
  noFill();
  setupUi();
}

function draw() {
  background('#0b1220');
  if (state.image) {
    image(state.image, 0, 0, width, height);
  }

  drawCurve();
  drawPoints();
  drawOverlay();
}

function drawCurve() {
  if (state.points.length < 2) return;
  stroke('#22d3ee');
  strokeWeight(2);

  const segments = getSegments();
  segments.forEach((seg) => {
    bezier(
      seg.p0.x,
      seg.p0.y,
      seg.p1.x,
      seg.p1.y,
      seg.p2.x,
      seg.p2.y,
      seg.p3.x,
      seg.p3.y
    );
  });
}

function drawPoints() {
  strokeWeight(1);
  for (let i = 0; i < state.points.length; i++) {
    const pt = state.points[i];
    const isSelected = state.selected && state.selected.index === i;

    // Handle lines
    stroke('#94a3b8');
    line(pt.position.x, pt.position.y, pt.inHandle.x, pt.inHandle.y);
    line(pt.position.x, pt.position.y, pt.outHandle.x, pt.outHandle.y);

    // Handles
    fill('#1e293b');
    stroke('#22d3ee');
    circle(pt.inHandle.x, pt.inHandle.y, 10);
    circle(pt.outHandle.x, pt.outHandle.y, 10);

    // Anchor
    fill(isSelected ? '#22d3ee' : '#f8fafc');
    stroke('#0f172a');
    circle(pt.position.x, pt.position.y, 14);
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

  if (state.mode === 'add') {
    addPoint(mouseX, mouseY);
  } else if (state.mode === 'remove') {
    const hit = hitTest(mouseX, mouseY);
    if (hit && hit.type === 'point') {
      state.points.splice(hit.index, 1);
      state.selected = null;
    }
  } else if (state.mode === 'adjust') {
    state.selected = hitTest(mouseX, mouseY);
  }
}

function mouseDragged() {
  if (!mouseInCanvas()) return;
  if (!state.selected || state.mode !== 'adjust') return;

  const { index, type } = state.selected;
  const pt = state.points[index];

  if (type === 'point') {
    const offset = { x: mouseX - pt.position.x, y: mouseY - pt.position.y };
    pt.position.x = mouseX;
    pt.position.y = mouseY;
    pt.inHandle.x += offset.x;
    pt.inHandle.y += offset.y;
    pt.outHandle.x += offset.x;
    pt.outHandle.y += offset.y;
  } else if (type === 'inHandle') {
    pt.inHandle.x = mouseX;
    pt.inHandle.y = mouseY;
    if (keyIsDown(SHIFT)) {
      pt.outHandle.x = pt.position.x + (pt.position.x - pt.inHandle.x);
      pt.outHandle.y = pt.position.y + (pt.position.y - pt.inHandle.y);
    }
  } else if (type === 'outHandle') {
    pt.outHandle.x = mouseX;
    pt.outHandle.y = mouseY;
    if (keyIsDown(SHIFT)) {
      pt.inHandle.x = pt.position.x + (pt.position.x - pt.outHandle.x);
      pt.inHandle.y = pt.position.y + (pt.position.y - pt.outHandle.y);
    }
  }
}

function mouseReleased() {
  state.selected = null;
}

function mouseInCanvas() {
  return mouseX >= 0 && mouseX <= width && mouseY >= 0 && mouseY <= height;
}

function addPoint(x, y) {
  const offset = 40;
  state.points.push({
    position: { x, y },
    inHandle: { x: x - offset, y },
    outHandle: { x: x + offset, y },
  });
}

function hitTest(x, y) {
  const radius = 10;
  for (let i = 0; i < state.points.length; i++) {
    const pt = state.points[i];
    if (dist(x, y, pt.position.x, pt.position.y) <= radius) {
      return { type: 'point', index: i };
    }
    if (dist(x, y, pt.inHandle.x, pt.inHandle.y) <= radius) {
      return { type: 'inHandle', index: i };
    }
    if (dist(x, y, pt.outHandle.x, pt.outHandle.y) <= radius) {
      return { type: 'outHandle', index: i };
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
}

function switchMode(mode) {
  state.mode = mode;
  ['add-point', 'remove-point', 'adjust-point'].forEach((id) => {
    const button = document.getElementById(id);
    if (button) button.classList.toggle('active', id.startsWith(mode));
  });
}

function saveCurveData() {
  const payload = {
    version: 1,
    canvas: { width, height },
    closed: state.closed,
    image: state.imageDataUrl
      ? { dataUrl: state.imageDataUrl, name: state.imageName }
      : null,
    points: state.points.map((pt) => ({
      position: { ...pt.position },
      inHandle: { ...pt.inHandle },
      outHandle: { ...pt.outHandle },
    })),
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'curve-data.json';
  link.click();
  URL.revokeObjectURL(url);
}

// Utility exposed for external use when p5 is available.
function serializeCurve() {
  return {
    version: 1,
    canvas: { width, height },
    closed: state.closed,
    image: state.imageDataUrl ? { dataUrl: state.imageDataUrl, name: state.imageName } : null,
    points: state.points.map((pt) => ({
      position: { ...pt.position },
      inHandle: { ...pt.inHandle },
      outHandle: { ...pt.outHandle },
    })),
  };
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
    });
  } else {
    state.image = null;
    state.imageDataUrl = null;
    state.imageName = null;
    const fileName = document.getElementById('file-name');
    if (fileName) fileName.textContent = 'No image loaded';
  }
}

function clearCanvas() {
  state.points = [];
  state.selected = null;
  state.closed = false;
  state.image = null;
  state.imageDataUrl = null;
  state.imageName = null;
  const closedToggle = document.getElementById('toggle-closed');
  if (closedToggle) closedToggle.checked = false;
  const fileName = document.getElementById('file-name');
  if (fileName) fileName.textContent = 'No image loaded';
}
