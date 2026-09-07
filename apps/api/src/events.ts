export type SseEvent = { type: string } & Record<string, unknown>;

type Listener = (event: SseEvent) => void;

const listeners = new Set<Listener>();

export function subscribeEvents(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function emitEvent(event: SseEvent): void {
  for (const fn of listeners) {
    fn({ ...event });
  }
}