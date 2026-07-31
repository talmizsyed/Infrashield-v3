export function createEventId(): string {
  return `evt-${Math.random().toString(36).slice(2, 10)}`;
}
