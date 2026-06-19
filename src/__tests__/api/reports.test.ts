/**
 * Tests for export API endpoint
 */

import { GET } from '@/app/api/reports/export/route'
import { MockNextRequest, createTestUser, createTestLead } from '../utils/test-utils'

// Mock auth and prisma
jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}))

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    lead: {
      findMany: jest.fn(),
    },
  },
}))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'

describe('GET /api/reports/export', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return 401 when not authenticated', async () => {
    ;(auth as jest.Mock).mockResolvedValue(null)

    const url = 'http://localhost:3000/api/reports/export?format=csv'
    const request = new MockNextRequest(url, 'GET')
    const response = await GET(request as any)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('Unauthorized')
  })

  it('should export CSV format', async () => {
    const mockUser = createTestUser()
    ;(auth as jest.Mock).mockResolvedValue({
      user: { id: mockUser.id },
    })

    const mockLead = createTestLead({ ownerUserId: mockUser.id })
    ;(prisma.lead.findMany as jest.Mock).mockResolvedValue([mockLead])

    const url = 'http://localhost:3000/api/reports/export?format=csv'
    const request = new MockNextRequest(url, 'GET')
    const response = await GET(request as any)
    const csv = await response.text()

    expect(response.headers.get('Content-Type')).toContain('text/csv')
    expect(csv).toContain('Company Name')
    expect(csv).toContain('Test Company')
  })

  it('should export HTML format', async () => {
    const mockUser = createTestUser()
    ;(auth as jest.Mock).mockResolvedValue({
      user: { id: mockUser.id },
    })

    const mockLead = createTestLead({ ownerUserId: mockUser.id })
    ;(prisma.lead.findMany as jest.Mock).mockResolvedValue([mockLead])

    const url = 'http://localhost:3000/api/reports/export?format=html'
    const request = new MockNextRequest(url, 'GET')
    const response = await GET(request as any)
    const html = await response.text()

    expect(response.headers.get('Content-Type')).toContain('text/html')
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('Test Company')
  })

  it('should filter by score', async () => {
    const mockUser = createTestUser()
    ;(auth as jest.Mock).mockResolvedValue({
      user: { id: mockUser.id },
    })

    const leads = [
      createTestLead({ ownerUserId: mockUser.id, leadScore: 50 }),
      createTestLead({ ownerUserId: mockUser.id, leadScore: 80 }),
    ]
    ;(prisma.lead.findMany as jest.Mock).mockResolvedValue(leads)

    const url = 'http://localhost:3000/api/reports/export?format=csv&minScore=75'
    const request = new MockNextRequest(url, 'GET')
    const response = await GET(request as any)

    expect(response.status).toBe(200)
  })

  it('should reject invalid format', async () => {
    const mockUser = createTestUser()
    ;(auth as jest.Mock).mockResolvedValue({
      user: { id: mockUser.id },
    })

    ;(prisma.lead.findMany as jest.Mock).mockResolvedValue([])

    const url = 'http://localhost:3000/api/reports/export?format=invalid'
    const request = new MockNextRequest(url, 'GET')
    const response = await GET(request as any)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Invalid format')
  })
})
