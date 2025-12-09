export function loadCurveData(data) {
  return new CurveEvaluator(data);
}

class CurveEvaluator {
  constructor(data) {
    this.data = data;
    this.points = data.points || [];
    this.closed = Boolean(data.closed);
  }

  evaluateCurve(t) {
    if (this.points.length < 2) return { x: 0, y: 0 };
    const segments = this._getSegments();
    const clamped = Math.min(Math.max(t, 0), 1);
    const segIndex = Math.min(Math.floor(clamped * segments.length), segments.length - 1);
    const localT = (clamped * segments.length) - segIndex;
    const seg = segments[segIndex];
    return cubicBezier(seg, localT);
  }

  _getSegments() {
    const result = [];
    const count = this.points.length;
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
