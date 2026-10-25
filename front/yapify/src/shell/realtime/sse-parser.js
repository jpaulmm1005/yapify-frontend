/**
 * Incremental parser for the `text/event-stream` format.
 *
 * The realtime stream is read with `fetch` (so the JWT travels in a header,
 * never in the URL), which hands the body over in arbitrary chunks: a line,
 * or even a CRLF pair, can be split between two of them. The parser keeps
 * the unfinished tail and only dispatches complete events.
 *
 * Only `event:` and `data:` matter here; `id:`, `retry:` and `:` comments are
 * ignored. An event without `data:` lines is dropped, as the spec says.
 *
 * @param {(e: { event: String, data: String }) => void} onEvent - Called once per complete event.
 * @returns {{ push: (chunk: String) => void }}
 */
export function createSseParser(onEvent) {
  let buffer = '';
  let eventName = '';
  let dataLines = [];

  const dispatch = () => {
    if (dataLines.length > 0) onEvent({ event: eventName || 'message', data: dataLines.join('\n') });
    eventName = '';
    dataLines = [];
  };

  const processLine = (line) => {
    if (line === '') {
      dispatch();
      return;
    }
    if (line.startsWith(':')) return;
    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    const raw = colon === -1 ? '' : line.slice(colon + 1);
    const value = raw.startsWith(' ') ? raw.slice(1) : raw;
    if (field === 'event') eventName = value;
    else if (field === 'data') dataLines.push(value);
  };

  return {
    push(chunk) {
      buffer += chunk;
      for (;;) {
        const index = buffer.search(/\r\n|\r|\n/);
        if (index === -1) return;
        if (buffer[index] === '\r' && index === buffer.length - 1) return;
        const width = buffer.startsWith('\r\n', index) ? 2 : 1;
        const line = buffer.slice(0, index);
        buffer = buffer.slice(index + width);
        processLine(line);
      }
    },
  };
}
