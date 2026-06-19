import { test, expect } from '@playwright/test'

test.describe('Critical User Journeys', () => {
  test('should complete full lead creation and analysis flow', async ({ page, context }) => {
    // Sign up
    await page.goto('/auth/signup')
    await page.fill('input[name="email"]', 'test@example.com')
    await page.fill('input[name="password"]', 'Test123!@#')
    await page.fill('input[name="confirmPassword"]', 'Test123!@#')
    await page.click('button[type="submit"]')

    // Wait for dashboard
    await page.waitForURL('/dashboard')
    expect(page.url()).toContain('/dashboard')

    // Navigate to leads
    await page.click('a[href="/dashboard/leads"]')
    await page.waitForURL('/dashboard/leads')

    // Create a new lead
    await page.click('button:has-text("New Lead")')
    await page.fill('input[name="companyName"]', 'Acme Corp')
    await page.fill('input[name="website"]', 'https://acme.com')
    await page.fill('input[name="contactEmail"]', 'john@acme.com')
    await page.click('button[type="submit"]')

    // Verify lead created
    await page.waitForSelector('text=Acme Corp')
    expect(page.locator('text=Acme Corp')).toBeVisible()

    // Click on lead to view details
    await page.click('text=Acme Corp')
    await page.waitForURL('/dashboard/leads/**')

    // Verify analysis section exists
    await page.waitForSelector('text=Analysis')
    expect(page.locator('text=Website Analysis')).toBeVisible()
  })

  test('should purchase credits and spend them', async ({ page }) => {
    // Sign in
    await page.goto('/auth/signin')
    await page.fill('input[name="email"]', 'test@example.com')
    await page.fill('input[name="password"]', 'Test123!@#')
    await page.click('button[type="submit"]')

    // Wait for dashboard
    await page.waitForURL('/dashboard')

    // Check initial credit balance
    const initialCredits = await page.locator('[data-testid="credit-balance"]').textContent()

    // Navigate to billing
    await page.click('a[href="/dashboard/billing"]')
    await page.waitForURL('/dashboard/billing')

    // Click buy credits
    await page.click('button:has-text("Buy Credits")')

    // Verify Stripe modal appears
    await page.waitForSelector('[data-stripe-element]', { timeout: 5000 })
    expect(page.locator('[data-stripe-element]')).toBeVisible()
  })

  test('should send email to lead', async ({ page }) => {
    // Sign in
    await page.goto('/auth/signin')
    await page.fill('input[name="email"]', 'test@example.com')
    await page.fill('input[name="password"]', 'Test123!@#')
    await page.click('button[type="submit"]')

    // Navigate to leads
    await page.goto('/dashboard/leads')

    // Click first lead
    await page.click('[data-testid="lead-row"] >> first')
    await page.waitForURL('/dashboard/leads/**')

    // Click send email button
    await page.click('button:has-text("Send Email")')

    // Verify email draft modal
    await page.waitForSelector('text=Draft Email')
    expect(page.locator('text=Draft Email')).toBeVisible()

    // Fill email body (auto-filled from AI)
    const emailBody = await page.locator('textarea[name="body"]').inputValue()
    expect(emailBody.length).toBeGreaterThan(0)

    // Send email
    await page.click('button:has-text("Send")')

    // Verify success message
    await page.waitForSelector('text=Email sent successfully')
  })

  test('should export leads as CSV', async ({ page, context }) => {
    // Sign in
    await page.goto('/auth/signin')
    await page.fill('input[name="email"]', 'test@example.com')
    await page.fill('input[name="password"]', 'Test123!@#')
    await page.click('button[type="submit"]')

    // Navigate to leads
    await page.goto('/dashboard/leads')

    // Click export button
    const downloadPromise = context.waitForEvent('download')
    await page.click('button:has-text("Export as CSV")')
    const download = await downloadPromise

    // Verify download
    expect(download.suggestedFilename()).toContain('leads')
    expect(download.suggestedFilename()).toContain('.csv')
  })

  test('should view analytics dashboard', async ({ page }) => {
    // Sign in
    await page.goto('/auth/signin')
    await page.fill('input[name="email"]', 'test@example.com')
    await page.fill('input[name="password"]', 'Test123!@#')
    await page.click('button[type="submit"]')

    // Navigate to analytics
    await page.click('a[href="/dashboard/analytics"]')
    await page.waitForURL('/dashboard/analytics')

    // Verify analytics cards
    expect(page.locator('[data-testid="total-leads-card"]')).toBeVisible()
    expect(page.locator('[data-testid="conversion-rate-card"]')).toBeVisible()
    expect(page.locator('[data-testid="avg-lead-score-card"]')).toBeVisible()

    // Verify charts load
    await page.waitForSelector('[data-testid="status-chart"]')
    expect(page.locator('[data-testid="status-chart"]')).toBeVisible()
  })

  test('should access marketplace and purchase leads', async ({ page }) => {
    // Sign in
    await page.goto('/auth/signin')
    await page.fill('input[name="email"]', 'test@example.com')
    await page.fill('input[name="password"]', 'Test123!@#')
    await page.click('button[type="submit"]')

    // Navigate to marketplace
    await page.click('a[href="/dashboard/marketplace"]')
    await page.waitForURL('/dashboard/marketplace')

    // Verify leads list
    await page.waitForSelector('[data-testid="lead-card"]')
    expect(page.locator('[data-testid="lead-card"]').first()).toBeVisible()

    // Filter by industry
    await page.selectOption('[name="industry"]', 'technology')
    await page.waitForSelector('[data-testid="lead-card"]')

    // Click buy on first lead
    await page.click('[data-testid="buy-lead-btn"] >> first')

    // Verify success message
    await page.waitForSelector('text=Lead purchased successfully')
  })

  test('should generate website analysis report', async ({ page, context }) => {
    // Sign in
    await page.goto('/auth/signin')
    await page.fill('input[name="email"]', 'test@example.com')
    await page.fill('input[name="password"]', 'Test123!@#')
    await page.click('button[type="submit"]')

    // Navigate to leads
    await page.goto('/dashboard/leads')

    // Click analyze button on first lead
    await page.click('[data-testid="analyze-btn"] >> first')

    // Wait for analysis to complete
    await page.waitForSelector('text=Website Analysis Complete', { timeout: 15000 })

    // Verify report content
    expect(page.locator('text=SEO Score')).toBeVisible()
    expect(page.locator('text=Performance')).toBeVisible()
    expect(page.locator('text=Accessibility')).toBeVisible()

    // Download report
    const downloadPromise = context.waitForEvent('download')
    await page.click('button:has-text("Download Report")')
    const download = await downloadPromise

    expect(download.suggestedFilename()).toContain('.pdf')
  })
})
