import type { FlowLine, GrayscaleImage, PenInkOptions } from '@flow-lines/core';
import type { RenderRequest, RenderResponse } from './render-worker';

/** Raw lines from one image-ink render (the compositor finishes them). */
export interface RenderedLines {
  lines: FlowLine[];
  width: number;
  height: number;
}

type Job = {
  instanceId: string;
  image: GrayscaleImage;
  options: PenInkOptions;
  resolve: (result: RenderedLines) => void;
  reject: (err: Error) => void;
};

/**
 * Latest-wins render queue over a single shared module worker, made
 * multi-instance aware: with N image-ink layers, one render runs in flight at a
 * time (the one worker, serial), and at most one job is pending *per instance*.
 * Dragging instance A's slider drops A's stale pending frame but never B's —
 * each layer still computes at most one stale frame of its own. Superseded
 * pendings reject with 'superseded' so the caller can ignore them. The single
 * shared worker is the CLAUDE.md memory model (one resident render worker).
 */
class RenderClient {
  private worker: Worker | null = null;
  private nextId = 1;
  private inFlight: { id: number; job: Job } | null = null;
  /** At most one pending job per instanceId. */
  private pending = new Map<string, Job>();

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
    instanceId: string,
    image: GrayscaleImage,
    options: PenInkOptions
  ): Promise<RenderedLines> {
    return new Promise<RenderedLines>((resolve, reject) => {
      const job: Job = { instanceId, image, options, resolve, reject };

      if (this.inFlight) {
        // Supersede only this instance's own pending frame; other instances'
        // queued work survives.
        const prior = this.pending.get(instanceId);
        if (prior) prior.reject(new Error('superseded'));
        this.pending.set(instanceId, job);
        return;
      }

      this.dispatch(job);
    });
  }

  private dispatch(job: Job): void {
    const id = this.nextId++;
    this.inFlight = { id, job };
    const request: RenderRequest = { id, image: job.image, options: job.options };
    this.getWorker().postMessage(request);
  }

  private onResponse(response: RenderResponse): void {
    if (!this.inFlight || response.id !== this.inFlight.id) return;

    const { job } = this.inFlight;
    this.inFlight = null;

    if (response.error || response.lines === undefined) {
      job.reject(new Error(response.error ?? 'Render failed'));
    } else {
      job.resolve({
        lines: response.lines,
        width: response.width ?? 0,
        height: response.height ?? 0,
      });
    }

    // Dispatch the next pending job (any instance, oldest insertion first —
    // Map preserves insertion order).
    const nextEntry = this.pending.entries().next();
    if (!nextEntry.done) {
      const [nextInstanceId, nextJob] = nextEntry.value;
      this.pending.delete(nextInstanceId);
      this.dispatch(nextJob);
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
