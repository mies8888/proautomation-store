/**
 * Test utilities for mocking and creating test data
 */

// Mock Prisma client
export const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  lead: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  outreachEmail: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  activityLog: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
  creditTransaction: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
  },
}

// Mock NextAuth session
export const mockSession = {
  user: {
    id: 'test-user-id',
    email: 'test@example.com',
    name: 'Test User',
    image: null,
  },
  expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
}

// Factory for creating test user
export function createTestUser(overrides = {}) {
  return {
    id: 'test-user-id',
    name: 'Test User',
    email: 'test@example.com',
    emailVerified: null,
    image: null,
    passwordHash: null,
    role: 'USER',
    isWhitelisted: true,
    whitelistStatus: 'APPROVED',
    subscriptionPlanId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: new Date(),
    credits: 100,
    ...overrides,
  }
}

// Factory for creating test lead
export function createTestLead(overrides = {}) {
  return {
    id: 'test-lead-id',
    ownerUserId: 'test-user-id',
    companyName: 'Test Company',
    websiteUrl: 'https://testcompany.com',
    industry: 'Technology',
    country: 'US',
    city: 'San Francisco',
    contactEmail: 'contact@testcompany.com',
    phone: '+1-555-0100',
    linkedinUrl: 'https://linkedin.com/company/test',
    googleBusinessUrl: null,
    sourceUrl: null,
    sourceType: 'manual',
    discoveryMethod: 'search',
    searchTier: 'tier1',
    leadPurpose: 'B2B Sales',
    businessTypeId: null,
    leadScore: 75,
    fitScore: 80,
    websiteWeaknessScore: 60,
    contactabilityScore: 85,
    urgencyScore: 70,
    revenuePotentialScore: 75,
    conversionProbabilityScore: 65,
    dataQualityScore: 80,
    confidenceScore: 85,
    status: 'NEW',
    duplicateOfLeadId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastVerifiedAt: new Date(),
    ...overrides,
  }
}

// Factory for creating test email
export function createTestEmail(overrides = {}) {
  return {
    id: 'test-email-id',
    leadId: 'test-lead-id',
    userId: 'test-user-id',
    to: 'contact@testcompany.com',
    subject: 'Test Subject',
    body: 'Test body content',
    htmlContent: '<html><body>Test content</body></html>',
    replyTo: 'reply@example.com',
    status: 'DRAFT',
    sentAt: null,
    externalMessageId: null,
    externalThreadId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

// Factory for creating test activity log
export function createTestActivityLog(overrides = {}) {
  return {
    id: 'test-activity-id',
    userId: 'test-user-id',
    leadId: 'test-lead-id',
    action: 'email_sent',
    metadata: {},
    ipAddress: '192.168.1.1',
    userAgent: 'Test Agent',
    createdAt: new Date(),
    ...overrides,
  }
}

// Mock request/response for API tests
export function createMockRequest(overrides = {}) {
  return {
    method: 'GET',
    url: 'http://localhost:3000/api/test',
    headers: new Map([
      ['content-type', 'application/json'],
      ['authorization', 'Bearer test-token'],
    ]),
    json: jest.fn().mockResolvedValue({}),
    text: jest.fn().mockResolvedValue(''),
    arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(0)),
    ...overrides,
  }
}

export function createMockResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    headers: new Map(),
  }
}

// Mock NextRequest and NextResponse
export class MockNextRequest {
  method: string
  url: string
  headers: Map<string, string>
  body?: any

  constructor(url = 'http://localhost:3000/api/test', method = 'GET', body?: any) {
    this.method = method
    this.url = url
    this.headers = new Map([
      ['content-type', 'application/json'],
      ['user-agent', 'Test Agent'],
    ])
    this.body = body
  }

  async json() {
    return this.body || {}
  }

  async text() {
    return JSON.stringify(this.body || {})
  }

  async arrayBuffer() {
    return new ArrayBuffer(0)
  }
}

// Test utilities
export const testUtils = {
  mockPrisma,
  mockSession,
  createTestUser,
  createTestLead,
  createTestEmail,
  createTestActivityLog,
  createMockRequest,
  createMockResponse,
  MockNextRequest,
}

export default testUtils
