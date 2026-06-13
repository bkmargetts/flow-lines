/// <reference lib="webworker" />
import { estimateDepth } from './depth';
import type { GrayscaleImage } from '@flow-lines/core';

export interface DepthRequest {
  /** Correlates a response with its request — the worker is reused across
   * photos now, so several jobs can be in flight on the one worker. */
  id: number;
  input: string;
}

export interface DepthResponse {
  id: number;
  depth?: GrayscaleImage;
  error?: string;
}

self.onmessage = async (event: MessageEvent<DepthRequest>) => {
  const { id, input } = event.data;
  try {
    const depth = await estimateDepth(input);
    const response: DepthResponse = { id, depth };
    self.postMessage(response);
  } catch (err) {
    const response: DepthResponse = {
      id,
      error: err instanceof Error ? err.message : String(err),
    };
    self.postMessage(response);
  }
};
