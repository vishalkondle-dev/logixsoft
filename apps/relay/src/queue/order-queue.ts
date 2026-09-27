import { generateId } from '@logixsoft/helpers/crypto';
import type { ChannelCode } from '@logixsoft/relay-schema';

export interface IngestJob {
  id: string;
  channelCode: ChannelCode;
  channelOrderId: string;
  eventType: string; // 'ORDER_PLACED' | 'ORDER_CANCELLED' | 'RIDER_UPDATE' | 'STATUS_UPDATE'
  rawPayload: any;
  headers?: Record<string, string>;
  receivedAt: number;
  idempotencyKey: string;
  env?: any;
}

export type QueueWorkerFn = (job: IngestJob) => Promise<any>;

export class OrderIngestionQueue {
  private queue: IngestJob[] = [];
  private idempotencyCache = new Map<string, { job: IngestJob; processedAt?: number }>();
  private workers: QueueWorkerFn[] = [];
  private isProcessing = false;

  /**
   * Registers a worker handler to process queued jobs.
   */
  public registerWorker(worker: QueueWorkerFn) {
    this.workers.push(worker);
  }

  /**
   * Fast-Ack ingress method:
   * Validates idempotency key, records payload, schedules queue processing asynchronously,
   * and returns immediately within <5ms (<300ms SLA).
   */
  public enqueue(
    channelCode: ChannelCode,
    channelOrderId: string,
    eventType: string,
    rawPayload: any,
    headers?: Record<string, string>,
    executionCtx?: { waitUntil: (promise: Promise<any>) => void },
    env?: any
  ): { isDuplicate: boolean; jobId: string; idempotencyKey: string; latencyMs: number } {
    const start = performance.now();
    const idempotencyKey = `${channelCode}:${channelOrderId}:${eventType}`;

    if (this.idempotencyCache.has(idempotencyKey)) {
      const existing = this.idempotencyCache.get(idempotencyKey)!;
      const latencyMs = Number((performance.now() - start).toFixed(2));
      return {
        isDuplicate: true,
        jobId: existing.job.id,
        idempotencyKey,
        latencyMs,
      };
    }

    const job: IngestJob = {
      id: generateId('job'),
      channelCode,
      channelOrderId,
      eventType,
      rawPayload,
      headers,
      receivedAt: Date.now(),
      idempotencyKey,
      env,
    };

    this.idempotencyCache.set(idempotencyKey, { job });
    this.queue.push(job);

    // Sync to Cloudflare KV for global multi-region deduplication if available
    if (env?.CACHE) {
      const kvPromise = env.CACHE.put(`relay:idemp:${idempotencyKey}`, job.id, { expirationTtl: 86400 }).catch((e: any) => {
        console.error('[OrderIngestionQueue] KV write error:', e);
      });
      if (executionCtx && typeof executionCtx.waitUntil === 'function') {
        executionCtx.waitUntil(kvPromise);
      }
    }

    // Process asynchronously without blocking HTTP Fast-Ack
    const processPromise = this.processQueue().catch((err) => {
      console.error('[OrderIngestionQueue] Worker error:', err);
    });

    if (executionCtx && typeof executionCtx.waitUntil === 'function') {
      executionCtx.waitUntil(processPromise);
    } else {
      queueMicrotask(() => {
        processPromise;
      });
    }

    const latencyMs = Number((performance.now() - start).toFixed(2));
    return {
      isDuplicate: false,
      jobId: job.id,
      idempotencyKey,
      latencyMs,
    };
  }

  public async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      while (this.queue.length > 0) {
        const job = this.queue.shift()!;
        for (const worker of this.workers) {
          try {
            await worker(job);
          } catch (err) {
            console.error(`[OrderIngestionQueue] Failed processing job ${job.id}:`, err);
          }
        }
        const cached = this.idempotencyCache.get(job.idempotencyKey);
        if (cached) {
          cached.processedAt = Date.now();
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  public getQueueDepth(): number {
    return this.queue.length;
  }

  public hasKey(idempotencyKey: string): boolean {
    return this.idempotencyCache.has(idempotencyKey);
  }

  public clear() {
    this.queue = [];
    this.idempotencyCache.clear();
  }
}

// Global Order Ingestion Queue singleton
export const orderQueue = new OrderIngestionQueue();
