export function loadCurveData(data) {
  return new CurveEvaluator(data);
}

class CurveEvaluator {
  constructor(data) {
    this.data = data;
    this.points = data.points || [];
    this.closed = Boolean(data.closed);
    
    // Cache segments and length data
    this.segments = this._getSegments();
    
    // If metadata exists in JSON, use it (or part of it), but we might need to build LUTs anyway
    // For simplicity and robustness, we recalculate the LUTs here.
    // This ensures we have the arc-length parameterization data ready.
    this.totalLength = 0;
    this.lut = []; // Lookup table for each segment
    
    this._calculateLengthData();
  }

  _calculateLengthData() {
    this.totalLength = 0;
    this.lut = [];
    
    this.segments.forEach(seg => {
      // Build a LUT for this segment
      // We'll store [t, distance] pairs
      const steps = 20; // Precision for length calculation
      const segmentLut = [];
      let segLen = 0;
      let prevX = seg.p0.x;
      let prevY = seg.p0.y;
      
      segmentLut.push({ t: 0, dist: 0 });
      
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const pt = cubicBezier(seg, t);
        const dx = pt.x - prevX;
        const dy = pt.y - prevY;
        const dist = Math.sqrt(dx*dx + dy*dy);
        segLen += dist;
        segmentLut.push({ t, dist: segLen });
        prevX = pt.x;
        prevY = pt.y;
      }
      
      this.lut.push({
        length: segLen,
        table: segmentLut
      });
      this.totalLength += segLen;
    });
  }

  evaluateCurve(t) {
    if (this.points.length < 2) return { x: 0, y: 0 };
    if (this.totalLength === 0) return this.points[0].position; // Should not happen if points > 1

    const clampedT = Math.min(Math.max(t, 0), 1);
    const targetDistance = clampedT * this.totalLength;
    
    // 1. Find which segment contains the targetDistance
    let accumulatedLength = 0;
    let segmentIndex = 0;
    
    for (let i = 0; i < this.lut.length; i++) {
      if (targetDistance <= accumulatedLength + this.lut[i].length) {
        segmentIndex = i;
        break;
      }
      accumulatedLength += this.lut[i].length;
      
      // Handle the very end of the curve (t=1)
      if (i === this.lut.length - 1) {
        segmentIndex = i;
      }
    }
    
    // 2. Find local t within that segment for the remaining distance
    const localDistance = targetDistance - accumulatedLength;
    const segmentData = this.lut[segmentIndex];
    const seg = this.segments[segmentIndex];
    
    // Use the LUT to find the approximate t
    // We want to find t where distance is localDistance
    // The LUT contains cumulative distance for that segment
    let lower = 0;
    let upper = segmentData.table.length - 1;
    let index = 0;
    
    // Linear search is fine for small LUT size (20), but let's just loop
    for (let i = 0; i < segmentData.table.length - 1; i++) {
      if (localDistance >= segmentData.table[i].dist && localDistance <= segmentData.table[i+1].dist) {
        index = i;
        break;
      }
    }
    
    // Interpolate t
    const entryA = segmentData.table[index];
    const entryB = segmentData.table[index+1];
    
    const distRange = entryB.dist - entryA.dist;
    const fraction = distRange === 0 ? 0 : (localDistance - entryA.dist) / distRange;
    
    const tA = entryA.t;
    const tB = entryB.t;
    const finalT = tA + (tB - tA) * fraction;
    
    return cubicBezier(seg, finalT);
  }

  _getSegments() {
    const result = [];
    const count = this.points.length;
    if (count < 2) return result;
    
    const limit = this.closed ? count : count - 1;
    for (let i = 0; i < limit; i++) {
      const a = this.points[i];
      const b = this.points[(i + 1) % count];
      result.push({
        p0: a.position,
        p1: a.outHandle,
        p2: b.inHandle,
        p3: b.position,
      });
    }
    return result;
  }
}

function cubicBezier(seg, t) {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  const uuu = uu * u;
  const ttt = tt * t;

  const x =
    uuu * seg.p0.x +
    3 * uu * t * seg.p1.x +
    3 * u * tt * seg.p2.x +
    ttt * seg.p3.x;
  const y =
    uuu * seg.p0.y +
    3 * uu * t * seg.p1.y +
    3 * u * tt * seg.p2.y +
    ttt * seg.p3.y;
  return { x, y };
}

if (typeof window !== 'undefined') {
  window.loadCurveData = loadCurveData;
}
