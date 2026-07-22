'use client';

/**
 * SpineEngine — Application-wide independent Heartbeat & Pulse Oscillator.
 * Controls over-clocking (sub-100ms) vs under-clocking (3000ms idle) based on live user activity & focused resources.
 * Decouples timer polling from SyncEngine, NeuralEngine, and UI workflows.
 */

export interface SpineTickData {
  tickCount: number;
  intervalMs: number;
  intensity: number;
  isOnline: boolean;
  activeRoute: string;
  focusedResourceId: string | null;
  timestamp: number;
}

type SpineSubscriber = (tick: SpineTickData) => void;

class SpineEngineService {
  private tickCount = 0;
  private currentIntervalMs = 1000;
  private minIntervalMs = 50; // Over-clock ceiling (50ms)
  private maxIntervalMs = 5000; // Under-clock floor (5000ms)
  private activityIntensity = 1.0;
  private lastActivityAt = Date.now();
  private focusedResourceId: string | null = null;
  private focusedResourceIntervalMs: number | null = null;
  private activeRoute = '/';
  private subscribers = new Map<string, Set<SpineSubscriber>>();
  private timer: any = null;
  private isRunning = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initEventListeners();
    }
  }

  private initEventListeners() {
    const bumpActivity = () => {
      this.lastActivityAt = Date.now();
      this.activityIntensity = Math.min(10.0, this.activityIntensity + 1.5);
      this.reevaluateInterval();
    };

    window.addEventListener('keydown', bumpActivity, { passive: true });
    window.addEventListener('input', bumpActivity, { passive: true });
    window.addEventListener('mousemove', bumpActivity, { passive: true });
    window.addEventListener('click', bumpActivity, { passive: true });
    window.addEventListener('touchmove', bumpActivity, { passive: true });
    window.addEventListener('scroll', bumpActivity, { passive: true });

    document.addEventListener('visibilitychange', () => {
      this.reevaluateInterval();
    });

    window.addEventListener('online', () => this.pulseImmediately());
    window.addEventListener('offline', () => this.reevaluateInterval());
  }

  public setRoute(route: string) {
    this.activeRoute = route;
  }

  public setFocusedResource(resourceId: string | null, targetIntervalMs?: number) {
    this.focusedResourceId = resourceId;
    this.focusedResourceIntervalMs = targetIntervalMs || null;
    this.reevaluateInterval();
  }

  public subscribe(channel: string, callback: SpineSubscriber): () => void {
    if (!this.subscribers.has(channel)) {
      this.subscribers.set(channel, new Set());
    }
    const set = this.subscribers.get(channel)!;
    set.add(callback);

    if (!this.isRunning) {
      this.start();
    }

    return () => {
      set.delete(callback);
      if (set.size === 0) {
        this.subscribers.delete(channel);
      }
    };
  }

  public pulseImmediately() {
    if (this.timer) clearTimeout(this.timer);
    this.executeTick();
  }

  private reevaluateInterval() {
    const now = Date.now();
    const idleSeconds = (now - this.lastActivityAt) / 1000;

    // Decay intensity when idle
    if (idleSeconds > 2) {
      this.activityIntensity = Math.max(0.2, this.activityIntensity - 0.5);
    }

    if (typeof document !== 'undefined' && document.hidden) {
      this.currentIntervalMs = 10000; // Background tab under-clock
    } else if (this.focusedResourceIntervalMs) {
      this.currentIntervalMs = Math.max(this.minIntervalMs, this.focusedResourceIntervalMs);
    } else if (this.activityIntensity >= 5.0) {
      this.currentIntervalMs = 100; // Over-clock pulse for active editing
    } else if (this.activityIntensity >= 2.0) {
      this.currentIntervalMs = 300; // Active user pulse
    } else if (idleSeconds < 10) {
      this.currentIntervalMs = 1000; // Standard pulse
    } else {
      this.currentIntervalMs = this.maxIntervalMs; // Under-clock idle pulse
    }
  }

  private start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.scheduleNextTick();
  }

  private scheduleNextTick() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.executeTick();
    }, this.currentIntervalMs);
  }

  private executeTick() {
    this.tickCount++;
    this.reevaluateInterval();

    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    const tickData: SpineTickData = {
      tickCount: this.tickCount,
      intervalMs: this.currentIntervalMs,
      intensity: this.activityIntensity,
      isOnline,
      activeRoute: this.activeRoute,
      focusedResourceId: this.focusedResourceId,
      timestamp: Date.now(),
    };

    // Dispatch to subscribers per channel
    this.subscribers.forEach((subscribers) => {
      subscribers.forEach((callback) => {
        try {
          callback(tickData);
        } catch (err) {
          console.warn('[SpineEngine] Subscriber error:', err);
        }
      });
    });

    if (this.subscribers.size > 0) {
      this.scheduleNextTick();
    } else {
      this.isRunning = false;
    }
  }

  public getStatus() {
    return {
      tickCount: this.tickCount,
      intervalMs: this.currentIntervalMs,
      intensity: this.activityIntensity,
      focusedResourceId: this.focusedResourceId,
      subscribersCount: Array.from(this.subscribers.values()).reduce((acc, s) => acc + s.size, 0),
    };
  }
}

export const SpineEngine = new SpineEngineService();
