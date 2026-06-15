import type { GrayscaleImage, PenInkOptions, SVGOptions, TextureOptions } from '@flow-lines/core';
import type { RenderRequest, RenderResponse } from './render-worker';

export interface RenderedSVG {
  svg: string;
  width: number;
  height: number;
}

export interface RenderTexture {
  options: Omit<TextureOptions, 'avoid'>;
  color: string;
}

type Job = {
  image: GrayscaleImage;
  options: PenInkOptions;
  svgOptions: SVGOptions;
  texture?: RenderTexture;
  resolve: (result: RenderedSVG) => void;
  reject: (err: Error) => void;
};

/**
 * Latest-wins render queue over a module worker: while a render is in
 * flight, newer requests replace any queued one, so dragging a slider
 * computes at most one stale frame. Superseded requests reject with
 * a 'superseded' error the caller can ignore.
 */
class RenderClient {
  private worker: Worker | null = null;
  private nextId = 1;
  private inFlight: { id: number; job: Job } | null = null;
  private pending: Job | null = null;

  private getWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(new URL('./render-worker.ts', import.meta.url), {
        type: 'module',
      });
      this.worker.onmessage = (event: MessageEvent<RenderResponse>) => {
        this.onResponse(event.data);
      };
    }
    return this.worker;
  }

  render(
    image: GrayscaleImage,
    options: PenInkOptions,
    svgOptions: SVGOptions,
    texture?: RenderTexture
  ): Promise<RenderedSVG> {
    return new Promise<RenderedSVG>((resolve, reject) => {
      const job: Job = { image, options, svgOptions, texture, resolve, reject };

      if (this.inFlight) {
        if (this.pending) {
          this.pending.reject(new Error('superseded'));
        }
        this.pending = job;
        return;
      }

      this.dispatch(job);
    });
  }

  private dispatch(job: Job): void {
    const id = this.nextId++;
    this.inFlight = { id, job };

    const request: RenderRequest = {
      id,
      image: job.image,
      options: job.options,
      svgOptions: job.svgOptions,
      texture: job.texture?.options,
      textureColor: job.texture?.color,
    };
    this.getWorker().postMessage(request);
  }

  private onResponse(response: RenderResponse): void {
    if (!this.inFlight || response.id !== this.inFlight.id) return;

    const { job } = this.inFlight;
    this.inFlight = null;

    if (response.error || response.svg === undefined) {
      job.reject(new Error(response.error ?? 'Render failed'));
    } else {
      job.resolve({
        svg: response.svg,
        width: response.width ?? 0,
        height: response.height ?? 0,
      });
    }

    if (this.pending) {
      const next = this.pending;
      this.pending = null;
      this.dispatch(next);
    }
  }
}

let client: RenderClient | null = null;

/** Shared render client (worker is created lazily on first render) */
export function getRenderClient(): RenderClient {
  if (!client) {
    client = new RenderClient();
  }
  return client;
}
