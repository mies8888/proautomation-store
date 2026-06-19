/**
 * Tests for analytics API endpoint
 */

import { GET } from '@/app/api/analytics/summary/route'
import { MockNextRequest, createTestUser, createTestLead, createTestEmail } from '../utils/test-utils'

// Mock auth and prisma
jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}))

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    lead: {
      findMany: jest.fn(),
    },
    creditTransaction: {
      findMany: jest.fn(),
    },
    activityLog: {
      findMany: jest.fn(),
    },
  },
}))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'

describe('GET /api/analytics/summary', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return 401 when not authenticated', async () => {
    ;(auth as jest.Mock).mockResolvedValue(null)

    const request = new MockNextRequest('http://localhost:3000/api/analytics/summary', 'GET')
    const response = await GET(request as any)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('Unauthorized')
  })

  it('should return analytics data when authenticated', async () => {
    const mockUser = createTestUser()
    ;(auth as jest.Mock).mockResolvedValue({
      user: { id: mockUser.id },
    })

    const mockLead = createTestLead({ ownerUserId: mockUser.id })
    ;(prisma.lead.findMany as jest.Mock).mockResolvedValue([mockLead])
    ;(prisma.creditTransaction.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.activityLog.findMany as jest.Mock).mockResolvedValue([])

    const request = new MockNextRequest('http://localhost:3000/api/analytics/summary', 'GET')
    const response = await GET(request as any)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveProperty('totalLeads')
    expect(data).toHaveProperty('averageLeadScore')
    expect(data).toHaveProperty('conversionRate')
    expect(data.totalLeads).toBe(1)
  })

  it('should calculate metrics correctly', async () => {
    const mockUser = createTestUser()
    ;(auth as jest.Mock).mockResolvedValue({
      user: { id: mockUser.id },
    })

    const leads = [
      createTestLead({ ownerUserId: mockUser.id, leadScore: 100, status: 'CLOSED' }),
      createTestLead({ ownerUserId: mockUser.id, leadScore: 50, status: 'NEW' }),
    ]
    ;(prisma.lead.findMany as jest.Mock).mockResolvedValue(leads)
    ;(prisma.creditTransaction.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.activityLog.findMany as jest.Mock).mockResolvedValue([])

    const request = new MockNextRequest('http://localhost:3000/api/analytics/summary', 'GET')
    const response = await GET(request as any)
    const data = await response.json()

    expect(data.totalLeads).toBe(2)
    expect(data.closedLeads).toBe(1)
    expect(data.openOpportunities).toBe(1)
    expect(data.averageLeadScore).toBe(75) // (100 + 50) / 2
    expect(data.conversionRate).toBe(50) // 1 closed out of 2
  })

  it('should handle empty data', async () => {
    const mockUser = createTestUser()
    ;(auth as jest.Mock).mockResolvedValue({
      user: { id: mockUser.id },
    })

    ;(prisma.lead.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.creditTransaction.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.activityLog.findMany as jest.Mock).mockResolvedValue([])

    const request = new MockNextRequest('http://localhost:3000/api/analytics/summary', 'GET')
    const response = await GET(request as any)
    const data = await response.json()

    expect(data.totalLeads).toBe(0)
    expect(data.averageLeadScore).toBe(0)
    expect(data.conversionRate).toBe(0)
  })
})
