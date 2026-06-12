/// <reference lib="webworker" />
import { estimateLabels } from './labels';
import type { LabelImage } from '@flow-lines/core';

export interface LabelsRequest {
  input: string;
  /** Post-processing raster size as [height, width] */
  targetSize?: [number, number];
}

export interface LabelsResponse {
  labels?: LabelImage;
  error?: string;
}

self.onmessage = async (event: MessageEvent<LabelsRequest>) => {
  try {
    const labels = await estimateLabels(event.data.input, event.data.targetSize);
    const response: LabelsResponse = { labels };
    self.postMessage(response);
  } catch (err) {
    const response: LabelsResponse = {
      error: err instanceof Error ? err.message : String(err),
    };
    self.postMessage(response);
  }
};
