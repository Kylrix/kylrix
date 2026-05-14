type Task = () => Promise<void> | void;

export class TaskDelegator {
  private static idleCallback = typeof window !== 'undefined' ? window.requestIdleCallback : (cb: any) => setTimeout(cb, 1);
  private static cancelIdleCallback = typeof window !== 'undefined' ? window.cancelIdleCallback : (id: any) => clearTimeout(id);

  /** Schedule task for browser idle time. Perfect for secondary UI hydration. */
  static defer(task: Task) {
    return this.idleCallback(() => {
        try {
            task();
        } catch (e) {
            console.error('[TaskDelegator] Deferred task failed:', e);
        }
    });
  }

  /** Run computation off the main thread using a worker pattern if provided, or async defer. */
  static async background<T>(work: () => Promise<T>): Promise<T> {
    // For now, delegate as async task to avoid UI block
    return new Promise((resolve, reject) => {
        setTimeout(async () => {
            try {
                const result = await work();
                resolve(result);
            } catch (e) {
                reject(e);
            }
        }, 0);
    });
  }
}
