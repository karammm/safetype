export type Handler<T> = (payload: T) => void;

/** Minimal typed event emitter. A throwing listener never breaks moderation or other listeners. */
export class Emitter<Events extends object> {
  private readonly handlers = new Map<keyof Events, Set<Handler<never>>>();

  constructor(private readonly onListenerError?: (error: unknown, event: keyof Events) => void) {}

  on<K extends keyof Events>(event: K, handler: Handler<Events[K]>): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler as Handler<never>);
    return () => {
      set.delete(handler as Handler<never>);
    };
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const handler of [...set]) {
      try {
        (handler as Handler<Events[K]>)(payload);
      } catch (error) {
        if (this.onListenerError) this.onListenerError(error, event);
      }
    }
  }

  clear(): void {
    this.handlers.clear();
  }
}
