import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision';
import type { PortraitOptions, Point } from '@flow-lines/core';

// Served from our own origin (see scripts/copy-mediapipe-wasm.mjs)
const WASM_BASE = `${import.meta.env.BASE_URL}mediapipe-wasm`;
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

/**
 * Nose base from the canonical MediaPipe face mesh (the landmarker exports
 * connection sets for eyes/brows/lips/oval but not the nose)
 */
const NOSE_BASE = [129, 98, 97, 2, 326, 327, 358];

/** Iris rings (center + 4 ring points), available in the 478-point model */
const LEFT_IRIS = [468, 469, 470, 471, 472];
const RIGHT_IRIS = [473, 474, 475, 476, 477];

/** Faces smaller than this (normalized) get tone-only treatment — landmark
 * strokes on tiny faces read as scribble */
const MIN_FACE_SIZE = 0.07;

let landmarkerPromise: Promise<FaceLandmarker> | null = null;

function getLandmarker(): Promise<FaceLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const vision = await FilesetResolver.forVisionTasks(WASM_BASE);
      return FaceLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL },
        runningMode: 'IMAGE',
        numFaces: 5,
      });
    })().catch((err) => {
      landmarkerPromise = null;
      throw err;
    });
  }
  return landmarkerPromise;
}

interface Connection {
  start: number;
  end: number;
}

/**
 * Chain an unordered list of landmark connections into ordered paths
 * (the landmarker publishes feature outlines as edge sets, not paths).
 * Returns one path per connected chain or loop.
 */
function chainConnections(connections: Connection[]): number[][] {
  const next = new Map<number, number>();
  for (const c of connections) {
    next.set(c.start, c.end);
  }

  const targets = new Set(next.values());
  const paths: number[][] = [];
  const visited = new Set<number>();

  // Open chains first (nodes nothing points to), then remaining loops
  const startNodes = [...next.keys()].filter((n) => !targets.has(n));
  const allStarts = [...startNodes, ...next.keys()];

  for (const start of allStarts) {
    if (visited.has(start)) continue;

    const path = [start];
    visited.add(start);
    let current = start;

    while (next.has(current)) {
      const n = next.get(current)!;
      path.push(n);
      if (visited.has(n)) break; // loop closed
      visited.add(n);
      current = n;
    }

    if (path.length > 2) {
      paths.push(path);
    }
  }

  return paths;
}

export interface DetectedPortrait {
  faceCount: number;
  portrait: Pick<PortraitOptions, 'faceOvals' | 'featureRegions' | 'featureStrokes'>;
}

/**
 * Split a closed loop into upper and lower halves at its left/right
 * extreme points (e.g. eye corners). Returns the half with the smaller
 * mean y first (the upper one, in image coordinates).
 */
function splitLoop(loop: Point[]): { upper: Point[]; lower: Point[] } {
  let minIdx = 0;
  let maxIdx = 0;
  for (let i = 1; i < loop.length; i++) {
    if (loop[i].x < loop[minIdx].x) minIdx = i;
    if (loop[i].x > loop[maxIdx].x) maxIdx = i;
  }

  const walk = (from: number, to: number): Point[] => {
    const path: Point[] = [];
    for (let i = from; ; i = (i + 1) % loop.length) {
      path.push(loop[i]);
      if (i === to) break;
    }
    return path;
  };

  const a = walk(minIdx, maxIdx);
  const b = walk(maxIdx, minIdx);
  const meanY = (pts: Point[]) => pts.reduce((s, p) => s + p.y, 0) / pts.length;

  return meanY(a) <= meanY(b) ? { upper: a, lower: b } : { upper: b, lower: a };
}

/** Shoelace area of a normalized polygon */
function loopArea(loop: Point[]): number {
  let area = 0;
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i];
    const b = loop[(i + 1) % loop.length];
    area += a.x * b.y - b.x * a.y;
  }
  return Math.abs(area / 2);
}

/** Closed ellipse polyline from an iris ring (center + 4 ring points) */
function irisEllipse(landmarks: { x: number; y: number }[], ring: number[], scale: number): Point[] {
  const c = landmarks[ring[0]];
  let rx = 0;
  let ry = 0;
  for (let i = 1; i < ring.length; i++) {
    rx += Math.abs(landmarks[ring[i]].x - c.x);
    ry += Math.abs(landmarks[ring[i]].y - c.y);
  }
  rx = (rx / (ring.length - 1)) * scale;
  ry = (ry / (ring.length - 1)) * scale;

  const points: Point[] = [];
  const segments = 10;
  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    points.push({ x: c.x + rx * Math.cos(t), y: c.y + ry * Math.sin(t) });
  }
  return points;
}

/**
 * Detect faces and convert their landmarks into portrait geometry for the
 * renderer: face ovals (skin), feature regions (kept detailed), and
 * feature polylines (drawn as clean strokes). Coordinates are normalized,
 * matching what the renderer expects. Returns null when no face is found.
 */
export async function detectPortrait(
  source: HTMLCanvasElement
): Promise<DetectedPortrait | null> {
  const landmarker = await getLandmarker();
  const result = landmarker.detect(source);

  if (!result.faceLandmarks || result.faceLandmarks.length === 0) {
    return null;
  }

  const faceOvals: Point[][] = [];
  const featureRegions: Point[][] = [];
  const featureStrokes: Point[][] = [];

  for (const landmarks of result.faceLandmarks) {
    const toPoint = (index: number): Point => ({
      x: landmarks[index].x,
      y: landmarks[index].y,
    });

    let faceSize = 0;
    const ovalPaths = chainConnections(FaceLandmarker.FACE_LANDMARKS_FACE_OVAL);
    for (const path of ovalPaths) {
      const oval = path.map(toPoint);
      faceOvals.push(oval);
      const xs = oval.map((p) => p.x);
      const ys = oval.map((p) => p.y);
      faceSize = Math.max(
        faceSize,
        Math.max(...xs) - Math.min(...xs),
        Math.max(...ys) - Math.min(...ys)
      );
    }

    // Tiny faces: keep the skin/feature maps but skip explicit strokes —
    // at that scale hatching draws features better than landmarks do
    const drawStrokes = faceSize >= MIN_FACE_SIZE;

    // Eyes: the drawn line is the upper lid; the full almond outline
    // reads as cartoon. The iris/pupil dot is what makes eyes alive.
    for (const connections of [
      FaceLandmarker.FACE_LANDMARKS_LEFT_EYE,
      FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE,
    ]) {
      for (const path of chainConnections(connections)) {
        const loop = path.map(toPoint);
        if (loop.length >= 3) featureRegions.push(loop);
        if (drawStrokes && loop.length >= 6) {
          featureStrokes.push(splitLoop(loop).upper);
        }
      }
    }

    if (drawStrokes && landmarks.length > RIGHT_IRIS[RIGHT_IRIS.length - 1]) {
      for (const ring of [LEFT_IRIS, RIGHT_IRIS]) {
        featureStrokes.push(irisEllipse(landmarks, ring, 0.85));
        featureStrokes.push(irisEllipse(landmarks, ring, 0.4));
      }
    }

    // Brows: one line each (the lower edge, sitting just above the lid) —
    // both edges drawn together look like doubled marker strokes
    for (const connections of [
      FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW,
      FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW,
    ]) {
      const chains = chainConnections(connections).map((path) => path.map(toPoint));
      for (const chain of chains) {
        if (chain.length >= 3) featureRegions.push(chain);
      }
      if (drawStrokes && chains.length > 0) {
        const meanY = (pts: Point[]) => pts.reduce((s, p) => s + p.y, 0) / pts.length;
        chains.sort((a, b) => meanY(b) - meanY(a));
        featureStrokes.push(chains[0]);
      }
    }

    // Lips: draw only the inner contour — the dark line between the lips
    // (a lens when the mouth is open, a single line when closed). The
    // outer outline is what produces the lipstick-cartoon look.
    const lipLoops = chainConnections(FaceLandmarker.FACE_LANDMARKS_LIPS).map((path) =>
      path.map(toPoint)
    );
    for (const loop of lipLoops) {
      if (loop.length >= 3) featureRegions.push(loop);
    }
    if (drawStrokes && lipLoops.length > 0) {
      lipLoops.sort((a, b) => loopArea(a) - loopArea(b));
      const inner = lipLoops[0];
      featureStrokes.push([...inner, inner[0]]);
    }

    // Nose: just the base accent, no bridge line
    if (drawStrokes) {
      featureStrokes.push(NOSE_BASE.map(toPoint));
    }
  }

  return {
    faceCount: result.faceLandmarks.length,
    portrait: { faceOvals, featureRegions, featureStrokes },
  };
}
