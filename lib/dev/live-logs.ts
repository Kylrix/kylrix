/**
 * Localhost Live Log Streamer for Next.js Server & Autonomous Agents.
 * Active strictly in development mode to provide real-time runtime diagnostics.
 */

export interface DevLogEntry {
  id: string;
  timestamp: string;
  level: 'error' | 'warn' | 'info' | 'log';
  message: string;
  stack?: string;
  source: 'server' | 'unhandledRejection' | 'uncaughtException' | 'client';
}

class DevLogStreamer {
  private static instance: DevLogStreamer;
  private logs: DevLogEntry[] = [];
  private readonly maxLogs = 500;
  private listeners: Set<(entry: DevLogEntry) => void> = new Set();
  private hooked = false;

  private constructor() {
    this.initHooks();
  }

  static getInstance(): DevLogStreamer {
    if (!DevLogStreamer.instance) {
      DevLogStreamer.instance = new DevLogStreamer();
    }
    return DevLogStreamer.instance;
  }

  private initHooks() {
    if (this.hooked) return;
    if (typeof window !== 'undefined') return; // Server-side only
    if (process.env.NODE_ENV === 'production') return; // Guard against production

    this.hooked = true;

    const originalError = console.error;
    const originalWarn = console.warn;

    console.error = (...args: any[]) => {
      originalError.apply(console, args);
      this.record('error', args, 'server');
    };

    console.warn = (...args: any[]) => {
      originalWarn.apply(console, args);
      this.record('warn', args, 'server');
    };

    if (typeof process !== 'undefined') {
      process.on('unhandledRejection', (reason: any) => {
        const message = reason instanceof Error ? reason.message : String(reason);
        const stack = reason instanceof Error ? reason.stack : undefined;
        this.addEntry({
          id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          timestamp: new Date().toISOString(),
          level: 'error',
          message: `UnhandledRejection: ${message}`,
          stack,
          source: 'unhandledRejection',
        });
      });

      process.on('uncaughtException', (err: Error) => {
        this.addEntry({
          id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          timestamp: new Date().toISOString(),
          level: 'error',
          message: `UncaughtException: ${err.message}`,
          stack: err.stack,
          source: 'uncaughtException',
        });
      });
    }
  }

  private record(level: DevLogEntry['level'], args: any[], source: DevLogEntry['source']) {
    try {
      const parts = args.map((a) => {
        if (a instanceof Error) return `${a.message}\n${a.stack || ''}`;
        if (typeof a === 'object') {
          try {
            return JSON.stringify(a, null, 2);
          } catch {
            return String(a);
          }
        }
        return String(a);
      });

      const message = parts.join(' ');
      if (!message.trim()) return;

      const firstErr = args.find((a) => a instanceof Error);

      this.addEntry({
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        timestamp: new Date().toISOString(),
        level,
        message,
        stack: firstErr?.stack,
        source,
      });
    } catch {}
  }

  addEntry(entry: DevLogEntry) {
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
    this.listeners.forEach((listener) => {
      try {
        listener(entry);
      } catch {}
    });
  }

  getRecentLogs(limit = 100, level?: string): DevLogEntry[] {
    let list = this.logs;
    if (level) {
      list = list.filter((l) => l.level === level);
    }
    return list.slice(-limit);
  }

  clear() {
    this.logs = [];
  }

  subscribe(listener: (entry: DevLogEntry) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const devLogStreamer = DevLogStreamer.getInstance();
