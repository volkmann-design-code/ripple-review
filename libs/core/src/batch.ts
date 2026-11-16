/**
 * Collects the keys asked for in the same turn of the event loop and loads
 * them with one call: a snapshot on a forge API (one request for many files)
 * or on git (one `cat-file --batch`) reads what the analysis asks for
 * together in one go. Results are cached per key.
 */
export function batched<V>(
  load: (keys: string[]) => Promise<Map<string, V>>,
): (key: string) => Promise<V | undefined> {
  const cache = new Map<string, Promise<V | undefined>>();
  let pending: {
    key: string;
    resolve: (v: V | undefined) => void;
    reject: (e: unknown) => void;
  }[] = [];

  const flush = () => {
    const batch = pending;
    pending = [];
    load(batch.map((p) => p.key)).then(
      (values) => {
        for (const p of batch) {
          p.resolve(values.get(p.key));
        }
      },
      (err) => {
        for (const p of batch) {
          cache.delete(p.key);
          p.reject(err);
        }
      },
    );
  };

  return (key) => {
    const hit = cache.get(key);
    if (hit) {
      return hit;
    }
    const promise = new Promise<V | undefined>((resolve, reject) => {
      if (pending.length === 0) {
        setTimeout(flush, 0);
      }
      pending.push({ key, resolve, reject });
    });
    cache.set(key, promise);
    return promise;
  };
}
