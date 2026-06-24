// Learn more: https://github.com/testing-library/jest-dom
require('@testing-library/jest-dom')

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
  }),
  usePathname: () => '/test',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}))

// Mock next-auth/react
jest.mock('next-auth/react', () => ({
  useSession: () => ({
    data: {
      user: { id: 'test-user', email: 'test@example.com' },
    },
    status: 'authenticated',
  }),
  signIn: jest.fn(),
  signOut: jest.fn(),
}))

// Mock next/image
const React = require('react')

if (typeof globalThis.Request === 'undefined' || typeof globalThis.Response === 'undefined' || typeof globalThis.Headers === 'undefined' || typeof globalThis.fetch === 'undefined') {
  try {
    const undici = require('node:undici')
    if (typeof globalThis.Request === 'undefined' && undici.Request) {
      globalThis.Request = undici.Request
    }
    if (typeof globalThis.Response === 'undefined' && undici.Response) {
      globalThis.Response = undici.Response
    }
    if (typeof globalThis.Headers === 'undefined' && undici.Headers) {
      globalThis.Headers = undici.Headers
    }
    if (typeof globalThis.fetch === 'undefined' && undici.fetch) {
      globalThis.fetch = undici.fetch
    }
  } catch (error) {
    // node:undici not available; rely on jsdom/node globals if present
  }
}

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props) => {
    // eslint-disable-next-line jsx-a11y/alt-text
    return React.createElement('img', props)
  },
}))

// Suppress console warnings in tests
const originalError = console.error
beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: useLayoutEffect does nothing on the server')
    ) {
      return
    }
    originalError.call(console, ...args)
  }
})

afterAll(() => {
  console.error = originalError
})
