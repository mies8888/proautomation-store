/**
 * Test setup helpers for common test scenarios
 */

/**
 * Create a mock HTTP request with specified parameters
 */
export function createMockHttpRequest(
  method = 'GET',
  url = '/api/test',
  options: Record<string, any> = {}
) {
  return {
    method,
    url: new URL(url, 'http://localhost:3000'),
    headers: new Map([
      ['content-type', 'application/json'],
      ...Object.entries(options.headers || {}),
    ]),
    body: options.body,
    json: jest.fn().mockResolvedValue(options.body || {}),
    text: jest.fn().mockResolvedValue(JSON.stringify(options.body || {})),
  }
}

/**
 * Assert that an API endpoint returns the expected status code
 */
export function assertStatus(response: any, expectedStatus: number) {
  expect(response.status).toBe(expectedStatus)
}

/**
 * Assert that an API endpoint returns JSON with specific structure
 */
export function assertJsonStructure(response: any, expectedKeys: string[]) {
  const data = response.json()
  expectedKeys.forEach(key => {
    expect(data).toHaveProperty(key)
  })
}

/**
 * Reset all mocks between tests
 */
export function resetAllMocks() {
  jest.clearAllMocks()
}

