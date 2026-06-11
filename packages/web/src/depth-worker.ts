/// <reference lib="webworker" />
import { estimateDepth } from './depth';
import type { GrayscaleImage } from '@flow-lines/core';

export interface DepthRequest {
  input: string;
}

export interface DepthResponse {
  depth?: GrayscaleImage;
  error?: string;
}

self.onmessage = async (event: MessageEvent<DepthRequest>) => {
  try {
    const depth = await estimateDepth(event.data.input);
    const response: DepthResponse = { depth };
    self.postMessage(response);
  } catch (err) {
    const response: DepthResponse = {
      error: err instanceof Error ? err.message : String(err),
    };
    self.postMessage(response);
  }
};
