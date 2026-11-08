import type { ProgressEvent, StreamEvent } from '../types';
import { notifySessionExpired } from './utils';

/**
 * POSTs to an SSE endpoint and resolves with the `result` event's data.
 * Progress events are forwarded to `onProgress` as they arrive.
 */
export async function streamRequest<T>(
  url: string,
  body: unknown,
  onProgress: (event: ProgressEvent) => void,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  if (response.status === 401) notifySessionExpired();
  if (!response.ok || !response.body) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Server error (${response.status}).`);
  }

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    let sep: number;
    while ((sep = buffer.indexOf('\n\n')) !== -1) {
      const chunk = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      const line = chunk.split('\n').find((l) => l.startsWith('data: '));
      if (!line) continue;
      const event = JSON.parse(line.slice(6)) as StreamEvent<T>;
      if (event.type === 'result') return event.data;
      if (event.type === 'error') throw new Error(event.message);
      onProgress(event);
    }
  }
  throw new Error('The connection to the server was lost before the result arrived.');
}
