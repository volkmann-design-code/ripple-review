import { Backend } from "./backend";
import { failureOf } from "./errors";
import { browserStores } from "./idb";
import type { Reply, Request } from "./protocol";

/*
 * The engine in a Web Worker: loading a change and analysing it (the
 * TypeScript compiler parsing a thousand files) doesn't block the page.
 */

const backend = new Backend({ stores: browserStores() });

const send = (reply: Reply) => self.postMessage(reply);

self.addEventListener("message", (e: MessageEvent<Request>) => {
  const { id, method, args } = e.data;
  const call = backend[method] as (...a: unknown[]) => Promise<unknown>;
  // A method that throws before returning a promise still gets an answer.
  Promise.resolve()
    .then(() =>
      call.call(backend, ...args, (stage: string) => send({ id, stage })),
    )
    .then(
      (result) => send({ id, result }),
      (err: unknown) => {
        const failure = failureOf(err);
        if (failure.status >= 500) {
          console.error(err);
        }
        send({ id, failure });
      },
    );
});
