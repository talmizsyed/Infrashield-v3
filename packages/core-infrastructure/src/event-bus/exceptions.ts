export class EventBusError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'EventBusError';
  }
}
