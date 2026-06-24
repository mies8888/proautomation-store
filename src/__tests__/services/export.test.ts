/**
 * Tests for export service
 */

import { convertToCSV, formatLeadForExport, filterLeads, generateHTMLReport } from '@/services/export'
import { createTestLead } from '../utils/test-utils'

describe('Export Service', () => {
  describe('convertToCSV', () => {
    it('should convert array of objects to CSV format', () => {
      const data = [
        { name: 'John', age: 30 },
        { name: 'Jane', age: 25 },
      ]
      const csv = convertToCSV(data)
      
      expect(csv).toContain('"name","age"')
      expect(csv).toContain('"John","30"')
      expect(csv).toContain('"Jane","25"')
    })

    it('should escape quotes in CSV values', () => {
      const data = [{ name: 'John "Jack" Doe' }]
      const csv = convertToCSV(data)
      
      expect(csv).toContain('"John ""Jack"" Doe"')
    })

    it('should handle empty arrays', () => {
      const csv = convertToCSV([])
      expect(csv).toBe('')
    })
  })

  describe('formatLeadForExport', () => {
    it('should format lead data correctly', () => {
      const lead = createTestLead({
        companyName: 'Acme Corp',
        industry: 'Technology',
        leadScore: 85,
      })
      
      const formatted = formatLeadForExport(lead)
      
      expect(formatted['Company Name']).toBe('Acme Corp')
      expect(formatted['Industry']).toBe('Technology')
      expect(formatted['Lead Score']).toBe(85)
    })

    it('should handle missing fields with empty strings', () => {
      const lead = createTestLead({ industry: null })
      const formatted = formatLeadForExport(lead)
      
      expect(formatted['Industry']).toBe('')
    })
  })

  describe('filterLeads', () => {
    it('should filter by minimum score', () => {
      const leads = [
        createTestLead({ leadScore: 50 }),
        createTestLead({ leadScore: 75 }),
        createTestLead({ leadScore: 90 }),
      ]
      
      const filtered = filterLeads(leads, { minScore: 75 })
      
      expect(filtered).toHaveLength(2)
      expect(filtered.every(l => l.leadScore >= 75)).toBe(true)
    })

    it('should filter by status', () => {
      const leads = [
        createTestLead({ status: 'NEW' }),
        createTestLead({ status: 'CLOSED' }),
      ]
      
      const filtered = filterLeads(leads, { status: 'NEW' })
      
      expect(filtered).toHaveLength(1)
      expect(filtered[0].status).toBe('NEW')
    })

    it('should filter by industries', () => {
      const leads = [
        createTestLead({ industry: 'Technology' }),
        createTestLead({ industry: 'Finance' }),
        createTestLead({ industry: 'Healthcare' }),
      ]
      
      const filtered = filterLeads(leads, { industries: ['Technology', 'Finance'] })
      
      expect(filtered).toHaveLength(2)
    })
  })

  describe('generateHTMLReport', () => {
    it('should generate valid HTML with metrics', () => {
      const html = generateHTMLReport('Test Report', {
        totalLeads: 100,
        averageScore: 75,
        highScoreCount: 30,
        conversionRate: 15,
        topIndustries: [{ name: 'Tech', count: 40 }],
      }, [])
      
      expect(html).toContain('<!DOCTYPE html>')
      expect(html).toContain('Test Report')
      expect(html).toContain('100')
      expect(html).toContain('Tech')
    })

    it('should include lead summary in report', () => {
      const leads = [
        { companyName: 'Acme', score: 80, status: 'CLOSED', industry: 'Tech' },
      ]
      
      const html = generateHTMLReport('Test Report', {
        totalLeads: 1,
        averageScore: 80,
        highScoreCount: 1,
        conversionRate: 100,
        topIndustries: [],
      }, leads)
      
      expect(html).toContain('Acme')
      expect(html).toContain('80')
      expect(html).toContain('CLOSED')
    })
  })
})
