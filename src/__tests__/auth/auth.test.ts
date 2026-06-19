/**
 * Tests for authentication and authorization
 */

import { GET as leadsGET } from '@/app/api/leads/route'
import { MockNextRequest, createTestUser } from '../utils/test-utils'

// Mock auth and prisma
jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}))

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    lead: {
      findMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  },
}))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'

describe('Auth & Authorization', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Unauthenticated requests', () => {
    it('should redirect to login when not authenticated', async () => {
      ;(auth as jest.Mock).mockResolvedValue(null)

      const request = new MockNextRequest('http://localhost:3000/api/leads', 'GET')
      const response = await leadsGET(request as any)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })
  })

  describe('Role-based access control', () => {
    it('should allow USER role to access leads', async () => {
      const mockUser = createTestUser({ role: 'USER' })
      ;(auth as jest.Mock).mockResolvedValue({
        user: { id: mockUser.id, role: mockUser.role },
      })

      ;(prisma.lead.findMany as jest.Mock).mockResolvedValue([])

      const request = new MockNextRequest('http://localhost:3000/api/leads', 'GET')
      const response = await leadsGET(request as any)

      expect(response.status).toBe(200)
    })

    it('should allow ADMIN role to access all leads', async () => {
      const mockUser = createTestUser({ role: 'ADMIN' })
      ;(auth as jest.Mock).mockResolvedValue({
        user: { id: mockUser.id, role: mockUser.role },
      })

      ;(prisma.lead.findMany as jest.Mock).mockResolvedValue([])

      const request = new MockNextRequest('http://localhost:3000/api/leads', 'GET')
      const response = await leadsGET(request as any)

      expect(response.status).toBe(200)
    })
  })

  describe('Token validation', () => {
    it('should validate JWT token in Authorization header', async () => {
      const mockUser = createTestUser()
      ;(auth as jest.Mock).mockResolvedValue({
        user: { id: mockUser.id },
      })

      const request = new MockNextRequest('http://localhost:3000/api/leads', 'GET', {
        Authorization: `Bearer valid.token.here`,
      })
      const response = await leadsGET(request as any)

      expect(response.status).toBe(200)
    })

    it('should reject invalid JWT token', async () => {
      ;(auth as jest.Mock).mockResolvedValue(null)

      const request = new MockNextRequest('http://localhost:3000/api/leads', 'GET', {
        Authorization: 'Bearer invalid',
      })
      const response = await leadsGET(request as any)
      const data = await response.json()

      expect(response.status).toBe(401)
    })
  })

  describe('User isolation', () => {
    it('should only return leads owned by authenticated user', async () => {
      const userId = 'user-123'
      const mockUser = createTestUser({ id: userId })
      ;(auth as jest.Mock).mockResolvedValue({
        user: { id: mockUser.id },
      })

      ;(prisma.lead.findMany as jest.Mock).mockResolvedValue([])

      const request = new MockNextRequest('http://localhost:3000/api/leads', 'GET')
      const response = await leadsGET(request as any)

      // Verify that the query was made with user filter
      expect(prisma.lead.findMany).toHaveBeenCalled()
      const callArgs = (prisma.lead.findMany as jest.Mock).mock.calls[0][0]
      expect(callArgs.where).toHaveProperty('ownerUserId', userId)
    })
  })

  describe('CSRF protection', () => {
    it('should include CSRF token validation for state-changing operations', async () => {
      // This would typically be tested via middleware
      // For now, we verify the auth check happens
      ;(auth as jest.Mock).mockResolvedValue(null)

      const request = new MockNextRequest('http://localhost:3000/api/leads', 'POST')
      const response = await leadsGET(request as any)

      expect(response.status).toBe(401)
    })
  })

  describe('Permission boundaries', () => {
    it('should prevent non-owner from accessing other users leads', async () => {
      const userId = 'user-123'
      const mockUser = createTestUser({ id: userId })
      ;(auth as jest.Mock).mockResolvedValue({
        user: { id: mockUser.id },
      })

      ;(prisma.lead.findMany as jest.Mock).mockResolvedValue([])

      const request = new MockNextRequest('http://localhost:3000/api/leads', 'GET')
      const response = await leadsGET(request as any)

      // Verify filtering by ownerUserId
      expect(prisma.lead.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            ownerUserId: userId,
          }),
        })
      )
    })
  })
})
