/** Current API writes JSON strings; leave other body types to fetch. */
export function requestHeaders(options: RequestInit): Headers {
  const headers = new Headers(options.headers);
  if (typeof options.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return headers;
}
