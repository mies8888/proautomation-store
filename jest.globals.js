// Polyfill web globals for Next/Route handlers before test modules load.
if (typeof globalThis.Request === 'undefined' && typeof Request !== 'undefined') {
  globalThis.Request = Request
}
if (typeof globalThis.Response === 'undefined' && typeof Response !== 'undefined') {
  globalThis.Response = Response
}
if (typeof globalThis.Headers === 'undefined' && typeof Headers !== 'undefined') {
  globalThis.Headers = Headers
}
if (typeof globalThis.fetch === 'undefined' && typeof fetch !== 'undefined') {
  globalThis.fetch = fetch
}

// If jsdom did not provide the Request/Response globals, use the Node.js runtime global objects.
if (typeof globalThis.Request === 'undefined') {
  if (typeof Request !== 'undefined') {
    globalThis.Request = Request
  }
}
if (typeof globalThis.Response === 'undefined') {
  if (typeof Response !== 'undefined') {
    globalThis.Response = Response
  }
}
if (typeof globalThis.Headers === 'undefined') {
  if (typeof Headers !== 'undefined') {
    globalThis.Headers = Headers
  }
}
if (typeof globalThis.fetch === 'undefined') {
  if (typeof fetch !== 'undefined') {
    globalThis.fetch = fetch
  }
}

if (typeof globalThis.Request === 'undefined' || typeof globalThis.Response === 'undefined' || typeof globalThis.Headers === 'undefined' || typeof globalThis.fetch === 'undefined') {
  try {
    const { Request, Response, Headers, fetch } = require('undici')
    if (typeof globalThis.Request === 'undefined' && Request) {
      globalThis.Request = Request
    }
    if (typeof globalThis.Response === 'undefined' && Response) {
      globalThis.Response = Response
    }
    if (typeof globalThis.Headers === 'undefined' && Headers) {
      globalThis.Headers = Headers
    }
    if (typeof globalThis.fetch === 'undefined' && fetch) {
      globalThis.fetch = fetch
    }
  } catch (error) {
    // undici not available; rely on jsdom/node globals if present
  }
}
