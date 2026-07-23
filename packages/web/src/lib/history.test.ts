import { describe, it, expect } from 'vitest';
import {
  createHistory,
  commit,
  undo,
  redo,
  canUndo,
  canRedo,
  createRecorder,
  type Scheduler,
} from './history';

/** A hand-cranked scheduler: timers fire only when the test calls tick(). */
function fakeScheduler(): Scheduler & { tick: () => void; pending: number } {
  let fns: (() => void)[] = [];
  return {
    set(fn) {
      fns.push(fn);
      return fn;
    },
    clear(id) {
      fns = fns.filter((f) => f !== id);
    },
    tick() {
      const due = fns;
      fns = [];
      due.forEach((f) => f());
    },
    get pending() {
      return fns.length;
    },
  };
}

describe('history core', () => {
  it('commits push the present into the past and clear the future', () => {
    let h = createHistory('a');
    h = commit(h, 'b');
    h = commit(h, 'c');
    expect(h).toEqual({ past: ['a', 'b'], present: 'c', future: [] });
    h = undo(h);
    expect(h.present).toBe('b');
    expect(h.future).toEqual(['c']);
    h = commit(h, 'd');
    expect(h).toEqual({ past: ['a', 'b'], present: 'd', future: [] });
  });

  it('a reference-equal commit is a no-op', () => {
    const state = { x: 1 };
    let h = createHistory(state);
    const same = commit(h, state);
    expect(same).toBe(h);
    h = commit(h, { x: 2 });
    expect(commit(h, h.present)).toBe(h);
  });

  it('undo/redo round-trip and report availability', () => {
    let h = createHistory(1);
    expect(canUndo(h)).toBe(false);
    expect(canRedo(h)).toBe(false);
    expect(undo(h)).toBe(h);
    expect(redo(h)).toBe(h);

    h = commit(h, 2);
    h = commit(h, 3);
    expect(canUndo(h)).toBe(true);
    h = undo(h);
    h = undo(h);
    expect(h.present).toBe(1);
    expect(canUndo(h)).toBe(false);
    expect(canRedo(h)).toBe(true);
    h = redo(h);
    h = redo(h);
    expect(h.present).toBe(3);
    expect(canRedo(h)).toBe(false);
  });

  it('trims the oldest entries beyond the cap', () => {
    let h = createHistory(0);
    for (let i = 1; i <= 10; i++) h = commit(h, i, 4);
    expect(h.past).toEqual([6, 7, 8, 9]);
    expect(h.present).toBe(10);
  });
});

describe('recorder (burst coalescing)', () => {
  it('collapses a burst of reports into one commit of the settled state', () => {
    const commits: number[] = [];
    const sched = fakeScheduler();
    const rec = createRecorder<number>((s) => commits.push(s), sched);
    for (let i = 1; i <= 30; i++) rec.report(i);
    expect(commits).toEqual([]); // still inside the burst
    sched.tick();
    expect(commits).toEqual([30]); // one entry, final value
    sched.tick();
    expect(commits).toEqual([30]); // quiet — nothing more fires
  });

  it('separate bursts commit separately', () => {
    const commits: string[] = [];
    const sched = fakeScheduler();
    const rec = createRecorder<string>((s) => commits.push(s), sched);
    rec.report('drag-1');
    sched.tick();
    rec.report('drag-2a');
    rec.report('drag-2b');
    sched.tick();
    expect(commits).toEqual(['drag-1', 'drag-2b']);
  });

  it('flush commits a pending burst immediately (undo mid-drag)', () => {
    const commits: number[] = [];
    const sched = fakeScheduler();
    const rec = createRecorder<number>((s) => commits.push(s), sched);
    rec.report(7);
    rec.flush();
    expect(commits).toEqual([7]);
    expect(sched.pending).toBe(0); // timer cleared — no double commit
    sched.tick();
    expect(commits).toEqual([7]);
    rec.flush(); // idle flush is a no-op
    expect(commits).toEqual([7]);
  });

  it('cancel drops a pending burst without committing', () => {
    const commits: number[] = [];
    const sched = fakeScheduler();
    const rec = createRecorder<number>((s) => commits.push(s), sched);
    rec.report(1);
    rec.cancel();
    sched.tick();
    expect(commits).toEqual([]);
  });
});
