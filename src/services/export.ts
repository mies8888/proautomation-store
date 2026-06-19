/**
 * Export service for CSV and report generation
 */

export interface ExportOptions {
  dateFrom?: Date
  dateTo?: Date
  minScore?: number
  maxScore?: number
  status?: string
  industries?: string[]
}

/**
 * Convert array of objects to CSV format
 */
export function convertToCSV(data: Array<Record<string, any>>): string {
  if (data.length === 0) {
    return ''
  }

  // Get headers from first object
  const headers = Object.keys(data[0])
  
  // Create CSV header row
  const csvHeaders = headers.map(h => `"${h.replace(/"/g, '""')}"`).join(',')

  // Create data rows
  const csvRows = data.map(row => {
    return headers.map(header => {
      const value = row[header]
      if (value === null || value === undefined) {
        return ''
      }
      const stringValue = String(value)
      return `"${stringValue.replace(/"/g, '""')}"`
    }).join(',')
  })

  return [csvHeaders, ...csvRows].join('\n')
}

/**
 * Format lead data for export
 */
export function formatLeadForExport(lead: any): Record<string, any> {
  return {
    'Company Name': lead.companyName || '',
    'Website URL': lead.websiteUrl || '',
    'Industry': lead.industry || '',
    'Country': lead.country || '',
    'City': lead.city || '',
    'Contact Email': lead.contactEmail || '',
    'Phone': lead.phone || '',
    'LinkedIn URL': lead.linkedinUrl || '',
    'Lead Score': lead.leadScore || 0,
    'Fit Score': lead.fitScore || 0,
    'Website Weakness Score': lead.websiteWeaknessScore || 0,
    'Urgency Score': lead.urgencyScore || 0,
    'Revenue Potential Score': lead.revenuePotentialScore || 0,
    'Conversion Probability': lead.conversionProbabilityScore || 0,
    'Status': lead.status || 'NEW',
    'Created': new Date(lead.createdAt).toLocaleDateString(),
    'Updated': new Date(lead.updatedAt).toLocaleDateString(),
  }
}

/**
 * Generate HTML report with lead metrics and analytics
 */
export function generateHTMLReport(
  title: string,
  metrics: {
    totalLeads: number
    averageScore: number
    highScoreCount: number
    conversionRate: number
    topIndustries: Array<{ name: string; count: number }>
  },
  leadSummary: Array<{
    companyName: string
    score: number
    status: string
    industry?: string
  }>
): string {
  const topIndustriesHTML = metrics.topIndustries
    .slice(0, 5)
    .map(
      ind =>
        `<tr><td style="padding: 8px; border-bottom: 1px solid #eee;">${ind.name}</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${ind.count}</td></tr>`
    )
    .join('')

  const leadSummaryHTML = leadSummary
    .slice(0, 20)
    .map(
      lead =>
        `<tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${lead.companyName}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${lead.score}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${lead.status}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${lead.industry || 'N/A'}</td>
        </tr>`
    )
    .join('')

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 40px;
      color: #333;
    }
    h1 { color: #0066cc; border-bottom: 2px solid #0066cc; padding-bottom: 10px; }
    h2 { color: #0066cc; margin-top: 30px; }
    .metrics {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 20px;
      margin: 20px 0;
    }
    .metric-card {
      background: #f5f5f5;
      padding: 20px;
      border-radius: 8px;
      text-align: center;
      border-left: 4px solid #0066cc;
    }
    .metric-value {
      font-size: 28px;
      font-weight: bold;
      color: #0066cc;
    }
    .metric-label {
      font-size: 12px;
      color: #666;
      text-transform: uppercase;
      margin-top: 5px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
      background: white;
    }
    th {
      background: #f5f5f5;
      padding: 10px;
      text-align: left;
      font-weight: bold;
      border-bottom: 2px solid #0066cc;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
      font-size: 12px;
      color: #666;
    }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <p>Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>

  <h2>Key Metrics</h2>
  <div class="metrics">
    <div class="metric-card">
      <div class="metric-value">${metrics.totalLeads}</div>
      <div class="metric-label">Total Leads</div>
    </div>
    <div class="metric-card">
      <div class="metric-value">${metrics.averageScore}</div>
      <div class="metric-label">Avg Score</div>
    </div>
    <div class="metric-card">
      <div class="metric-value">${metrics.highScoreCount}</div>
      <div class="metric-label">High Score (80+)</div>
    </div>
    <div class="metric-card">
      <div class="metric-value">${metrics.conversionRate}%</div>
      <div class="metric-label">Conversion Rate</div>
    </div>
  </div>

  <h2>Top Industries</h2>
  <table>
    <thead>
      <tr>
        <th>Industry</th>
        <th>Lead Count</th>
      </tr>
    </thead>
    <tbody>
      ${topIndustriesHTML || '<tr><td colspan="2" style="padding: 8px; text-align: center; color: #999;">No data</td></tr>'}
    </tbody>
  </table>

  <h2>Lead Summary (Top 20)</h2>
  <table>
    <thead>
      <tr>
        <th>Company</th>
        <th>Score</th>
        <th>Status</th>
        <th>Industry</th>
      </tr>
    </thead>
    <tbody>
      ${leadSummaryHTML || '<tr><td colspan="4" style="padding: 8px; text-align: center; color: #999;">No leads</td></tr>'}
    </tbody>
  </table>

  <div class="footer">
    <p><strong>ProAutomation.store</strong> - Lead Management & Analytics Platform</p>
    <p>This report contains confidential information. Do not share with unauthorized parties.</p>
  </div>
</body>
</html>
  `
}

/**
 * Filter leads based on export options
 */
export function filterLeads(
  leads: any[],
  options: ExportOptions
): any[] {
  return leads.filter(lead => {
    // Date filter
    if (options.dateFrom && new Date(lead.createdAt) < options.dateFrom) {
      return false
    }
    if (options.dateTo && new Date(lead.createdAt) > options.dateTo) {
      return false
    }

    // Score filter
    if (options.minScore !== undefined && lead.leadScore < options.minScore) {
      return false
    }
    if (options.maxScore !== undefined && lead.leadScore > options.maxScore) {
      return false
    }

    // Status filter
    if (options.status && lead.status !== options.status) {
      return false
    }

    // Industry filter
    if (options.industries && options.industries.length > 0) {
      if (!options.industries.includes(lead.industry)) {
        return false
      }
    }

    return true
  })
}
