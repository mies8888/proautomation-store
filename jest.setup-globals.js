// Polyfill web platform globals required by Next.js server route imports in Jest
if (typeof globalThis.Request === 'undefined') {
  if (typeof globalThis.window !== 'undefined' && typeof window.Request !== 'undefined') {
    globalThis.Request = window.Request
  }
}
if (typeof globalThis.Response === 'undefined') {
  if (typeof globalThis.window !== 'undefined' && typeof window.Response !== 'undefined') {
    globalThis.Response = window.Response
  }
}
if (typeof globalThis.Headers === 'undefined') {
  if (typeof globalThis.window !== 'undefined' && typeof window.Headers !== 'undefined') {
    globalThis.Headers = window.Headers
  }
}
