const JsdomEnvironment = require('jest-environment-jsdom').TestEnvironment

class CustomJestEnvironment extends JsdomEnvironment {
  constructor(config, context) {
    super(config, context)
    this.ensureWebGlobals()
  }

  async setup() {
    await super.setup()
    this.ensureWebGlobals()
  }

  ensureWebGlobals() {
    const target = this.global

    if (typeof target.Request === 'undefined') {
      if (typeof globalThis.Request !== 'undefined') {
        target.Request = globalThis.Request
      } else if (typeof global.Request !== 'undefined') {
        target.Request = global.Request
      }
    }

    if (typeof target.Response === 'undefined') {
      if (typeof globalThis.Response !== 'undefined') {
        target.Response = globalThis.Response
      } else if (typeof global.Response !== 'undefined') {
        target.Response = global.Response
      }
    }

    if (typeof target.Headers === 'undefined') {
      if (typeof globalThis.Headers !== 'undefined') {
        target.Headers = globalThis.Headers
      } else if (typeof global.Headers !== 'undefined') {
        target.Headers = global.Headers
      }
    }

    if (typeof target.fetch === 'undefined') {
      if (typeof globalThis.fetch !== 'undefined') {
        target.fetch = globalThis.fetch
      } else if (typeof global.fetch !== 'undefined') {
        target.fetch = global.fetch
      }
    }

    if (
      typeof target.Request === 'undefined' ||
      typeof target.Response === 'undefined' ||
      typeof target.Headers === 'undefined' ||
      typeof target.fetch === 'undefined'
    ) {
      try {
        const undici = require('undici')
        if (typeof target.Request === 'undefined' && undici.Request) {
          target.Request = undici.Request
        }
        if (typeof target.Response === 'undefined' && undici.Response) {
          target.Response = undici.Response
        }
        if (typeof target.Headers === 'undefined' && undici.Headers) {
          target.Headers = undici.Headers
        }
        if (typeof target.fetch === 'undefined' && undici.fetch) {
          target.fetch = undici.fetch
        }
      } catch {
        // ignore; best effort only
      }
    }
  }
}

module.exports = CustomJestEnvironment
