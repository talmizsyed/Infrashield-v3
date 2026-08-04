import type { ConsoleData } from '../types/console';

export async function getConsoleData(): Promise<ConsoleData> {
  const response = await fetch('/api/console');

  if (!response.ok) {
    throw new Error('Unable to load console data.');
  }

  const payload = (await response.json()) as ConsoleData;
  return payload;
}
