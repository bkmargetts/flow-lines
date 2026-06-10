import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision';
import type { PortraitOptions, Point } from '@flow-lines/core';

// Served from our own origin (see scripts/copy-mediapipe-wasm.mjs)
const WASM_BASE = `${import.meta.env.BASE_URL}mediapipe-wasm`;
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

/**
 * Nose polylines from the canonical MediaPipe face mesh (the landmarker
 * exports connection sets for eyes/brows/lips/oval but not the nose)
 */
const NOSE_BRIDGE = [168, 6, 197, 195, 5, 4];
const NOSE_BASE = [129, 98, 97, 2, 326, 327, 358];

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

  const featureConnectionSets = [
    FaceLandmarker.FACE_LANDMARKS_LEFT_EYE,
    FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE,
    FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW,
    FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW,
    FaceLandmarker.FACE_LANDMARKS_LIPS,
  ];

  for (const landmarks of result.faceLandmarks) {
    const toPoint = (index: number): Point => ({
      x: landmarks[index].x,
      y: landmarks[index].y,
    });

    const ovalPaths = chainConnections(FaceLandmarker.FACE_LANDMARKS_FACE_OVAL);
    for (const path of ovalPaths) {
      faceOvals.push(path.map(toPoint));
    }

    for (const connections of featureConnectionSets) {
      for (const path of chainConnections(connections)) {
        const points = path.map(toPoint);
        featureStrokes.push(points);
        if (points.length >= 3) {
          featureRegions.push(points);
        }
      }
    }

    featureStrokes.push(NOSE_BRIDGE.map(toPoint));
    featureStrokes.push(NOSE_BASE.map(toPoint));
  }

  return {
    faceCount: result.faceLandmarks.length,
    portrait: { faceOvals, featureRegions, featureStrokes },
  };
}
