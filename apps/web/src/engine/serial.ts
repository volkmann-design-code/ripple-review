/** Runs the updates of one key (a change) one after another, in the order asked. */
export class Serial {
  private readonly queues = new Map<string, Promise<unknown>>();

  run<T>(key: string, run: () => Promise<T>): Promise<T> {
    const next = (this.queues.get(key) ?? Promise.resolve()).then(run, run);
    this.queues.set(
      key,
      next.catch(() => {}),
    );
    return next;
  }
}
