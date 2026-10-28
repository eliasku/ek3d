import { assert, test } from "vitest";
import { WorkerPool } from "../src/addons/utils/WorkerPool";
import { Worker as NodeWorker } from "node:worker_threads";

type PingMessage = { id?: number; type: string; value: number };

const workerSource = `
  const { parentPort } = require('node:worker_threads');
  parentPort.on('message', (msg) => {
    if (msg.type === 'pong') {
      setImmediate(() => parentPort.postMessage({ id: msg.id, kind: 'answer', value: msg.value * 2 }));
    }
  });
`;

function createNodeWorker(): unknown {
  // worker_threads Worker lacks addEventListener; adapt to the EventTarget surface the pool expects.
  const inner = new NodeWorker(workerSource, { eval: true });
  inner.postMessage = inner.postMessage.bind(inner);
  const listenerMap = new Map<string, Set<(event: unknown) => void>>();
  (
    inner as unknown as Worker & { addEventListener: (type: string, listener: (event: unknown) => void) => void }
  ).addEventListener = (type: string, listener: (event: unknown) => void) => {
    let listeners = listenerMap.get(type);
    if (listeners === undefined) {
      listeners = new Set();
      listenerMap.set(type, listeners);
    }
    listeners.add(listener);
  };
  inner.on("message", (value) => {
    const event = { data: value };
    for (const listener of listenerMap.get("message") ?? []) listener(event);
  });
  return inner;
}

test("worker pool routes messages, queues overflow and terminates on dispose", async () => {
  const pool = new WorkerPool(2);
  pool.setWorkerCreator(() => createNodeWorker() as Worker);

  // post three at once: a, b → workers; c → queue until a worker frees up
  const pending = [
    pool.postMessage({ type: "pong", value: 21 } as PingMessage),
    pool.postMessage({ type: "pong", value: 50 } as PingMessage),
    pool.postMessage({ type: "pong", value: 8 } as PingMessage),
  ];
  assert.equal(pool.queue.length, 1);
  const [a, b, queued] = await Promise.all(pending);
  assert.deepEqual(a.data, { id: undefined, kind: "answer", value: 42 });
  assert.deepEqual(b.data, { id: undefined, kind: "answer", value: 100 });
  assert.deepEqual(queued.data, { id: undefined, kind: "answer", value: 16 });
  assert.equal(pool.queue.length, 0);

  pool.dispose();
  assert.equal(pool.workers.length, 0);
  assert.equal(pool.workerStatus, 0);
});
