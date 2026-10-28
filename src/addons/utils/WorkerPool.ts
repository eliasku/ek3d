/** Message posted to a pooled worker; the transfer list moves buffers out of the calling thread. */
export interface WorkerPoolMessage<TPayload = unknown> {
  type: string;
  config?: WorkerPoolConfig;
  transcoderBinary?: ArrayBuffer;
  buffer?: ArrayBuffer;
  taskConfig?: TPayload;
  id?: number;
}

/** Loader-specific config object carried by init messages (see KTX2Loader). */
export interface WorkerPoolConfig {
  astcSupported: boolean;
  astcHDRSupported: boolean;
  etc1Supported: boolean;
  etc2Supported: boolean;
  dxtSupported: boolean;
  bptcSupported: boolean;
  pvrtcSupported: boolean;
}

/** Queued message plus the resolve of its waiting promise. */
interface WorkerPoolQueueEntry {
  resolve: (value: MessageEvent<unknown>) => void;
  msg: WorkerPoolMessage;
  transfer: Transferable[] | undefined;
}

/**
 * A simple pool for managing Web Workers.
 *
 * ```typescript
 * import { WorkerPool } from 'ek3d/addons/utils/WorkerPool';
 *
 * const pool = new WorkerPool();
 * pool.setWorkerCreator( () => new Worker( 'worker.js' ) );
 * const result = await pool.postMessage( { type: 'task' } );
 * pool.dispose();
 * ```
 *
 * @three_import import { WorkerPool } from 'ek3d/addons/utils/WorkerPool';
 */
export class WorkerPool {
  /** The size of the pool. */
  pool: number;

  /** A message queue. */
  queue: WorkerPoolQueueEntry[];

  /** An array of Workers. */
  workers: (Worker | null)[];

  /** An array with resolve functions for messages. */
  workersResolve: ((value: MessageEvent<unknown>) => void)[];

  /**
   * The current worker status.
   *
   * The status is a bit mask of the pool's size, with all ones representing
   * idle workers and zero representing busy workers.
   */
  workerStatus: number;

  /** A factory function for creating workers. */
  workerCreator: (() => Worker) | null;

  /**
   * Constructs a new Worker pool.
   *
   * @param [pool=4] - The size of the pool.
   */
  constructor(pool: number = 4) {
    this.pool = pool;
    this.queue = [];
    this.workers = [];
    this.workersResolve = [];
    this.workerStatus = 0;
    this.workerCreator = null;
  }

  _initWorker(workerId: number): void {
    if (this.workers[workerId] === undefined) {
      const worker = this.workerCreator!();
      worker.addEventListener("message", this._onMessage.bind(this, workerId));
      this.workers[workerId] = worker;
    }
  }

  _getIdleWorker(): number {
    for (let i = 0; i < this.pool; i++) if (!(this.workerStatus & (1 << i))) return i;
    return -1;
  }

  _onMessage(workerId: number, msg: MessageEvent<unknown>): void {
    const resolve = this.workersResolve[workerId];
    if (resolve) resolve(msg);

    if (this.queue.length) {
      const { resolve, msg, transfer } = this.queue.shift()!;
      this.workersResolve[workerId] = resolve;
      this.workers[workerId]!.postMessage(msg, transfer!);
    } else {
      this.workerStatus ^= 1 << workerId;
    }
  }

  /**
   * Sets a function that is responsible for creating Workers.
   *
   * @param workerCreator - The worker creator function.
   */
  setWorkerCreator(workerCreator: () => Worker): void {
    this.workerCreator = workerCreator;
  }

  /**
   * Sets the Worker limit.
   *
   * @param pool - The size of the pool.
   */
  setWorkerLimit(pool: number): void {
    this.pool = pool;
  }

  /**
   * Post a message to an idle Worker. If no Worker is available,
   * the message is pushed into a message queue for later processing.
   *
   * @param msg - The message.
   * @param transfer - An array with array buffers for data transfer.
   * @return A Promise that resolves when the message has been processed.
   */
  postMessage(msg: WorkerPoolMessage, transfer?: Transferable[]): Promise<MessageEvent<unknown>> {
    return new Promise((resolve) => {
      const workerId = this._getIdleWorker();

      if (workerId !== -1) {
        this._initWorker(workerId);
        this.workerStatus |= 1 << workerId;
        this.workersResolve[workerId] = resolve;
        this.workers[workerId]!.postMessage(msg, transfer!);
      } else {
        this.queue.push({ resolve, msg, transfer });
      }
    });
  }

  /**
   * Terminates all Workers of this pool. Call this method whenever this
   * Worker pool is no longer used in your app.
   */
  dispose(): void {
    this.workers.forEach((worker) => worker?.terminate());
    this.workersResolve.length = 0;
    this.workers.length = 0;
    this.queue.length = 0;
    this.workerStatus = 0;
  }
}
