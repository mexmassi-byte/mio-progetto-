// Coordinates page entrance animations with the cinematic curtain:
// while the curtain is closed, entrance timelines wait; they start
// the moment it begins to open.
let closed = false;
let queue: Array<() => void> = [];

export function setCurtainClosed(value: boolean) {
  closed = value;
  if (!value) {
    const run = queue;
    queue = [];
    run.forEach((fn) => fn());
  }
}

export function whenRevealed(fn: () => void) {
  if (closed) queue.push(fn);
  else fn();
}
