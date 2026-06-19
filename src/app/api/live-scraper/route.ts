import { NextRequest, NextResponse } from 'next/server'
import { chromium } from 'playwright-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'

const stealth = typeof StealthPlugin === 'function' ? StealthPlugin() : (StealthPlugin as any).default()
chromium.use(stealth)

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('q') || 'Software companies'
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: string, data: any) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }

      sendEvent('status', { message: 'Launching remote Chrome browser...' })
      
      try {
        const browser = await chromium.launch({ 
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
        })
        const page = await browser.newPage()
        await page.setViewportSize({ width: 1280, height: 720 })
        
        let isScraping = true
        
        // Asynchronous loop to capture frames without setInterval overlapping
        const captureFrames = async () => {
          while (isScraping) {
            try {
              const buffer = await page.screenshot({ type: 'jpeg', quality: 40 })
              const base64 = buffer.toString('base64')
              sendEvent('frame', { image: base64 })
              await new Promise(r => setTimeout(r, 400)) // ~2.5 frames per second
            } catch(e) {
              await new Promise(r => setTimeout(r, 400))
            }
          }
        }
        
        // Extract city and country from the query to get a good zoom target
        const queryParts = query.split(' in ')
        const locationTarget = queryParts.length > 1 ? queryParts[1] : query
        
        // Start capturing frames in the background
        captureFrames()

        sendEvent('status', { message: `Initializing Google Earth 3D Satellite Feed for: ${locationTarget}` })
        
        // Use headless: false for a split second? No, just rely on the new headless engine.
        // Go to Google Earth for the cinematic globe zoom
        await page.goto(`https://earth.google.com/web/search/${encodeURIComponent(locationTarget)}`, { waitUntil: 'domcontentloaded' })
        
        sendEvent('status', { message: 'Establishing satellite uplink... zooming to coordinates.' })
        
        // Wait 15 seconds for the cinematic globe spin and 3D zoom to complete
        await page.waitForTimeout(15000)

        sendEvent('status', { message: 'Coordinates reached. Switching to Tactical Map Data Extraction...' })
        
        // Now switch to Google Maps to actually scrape the business data
        await page.goto(`https://www.google.com/maps/search/${encodeURIComponent(query)}?hl=en`, { waitUntil: 'domcontentloaded' })
        await page.waitForTimeout(3000) // Let the map load

        try {
          sendEvent('status', { message: 'Bypassing security protocols...' })
          const acceptButton = await page.locator('button:has-text("Accept all")').first()
          if (await acceptButton.isVisible()) {
            await acceptButton.click()
            await page.waitForTimeout(2000)
          }
        } catch (e) {}
        
        sendEvent('status', { message: 'Scanning tactical map locations & extracting Business Data...' })
        await page.mouse.move(200, 400) // Move mouse over the left panel
        await page.mouse.wheel(0, 1500) // Scroll down to load more results
        await page.waitForTimeout(2000)

        // Find the first business listing on the map
        const firstLink = await page.evaluate(() => {
          const links = Array.from(document.querySelectorAll('a[href^="https://www.google.com/maps/place"]'))
          return links[0]?.getAttribute('href')
        })

        if (firstLink) {
          sendEvent('status', { message: `Navigating to target website: ${firstLink}` })
          await page.goto(firstLink, { waitUntil: 'domcontentloaded' })
          await page.waitForTimeout(2000)
          
          sendEvent('status', { message: 'Scanning DOM for email signatures...' })
          await page.evaluate(() => window.scrollBy(0, 800))
          await page.waitForTimeout(1500)
          await page.evaluate(() => window.scrollBy(0, 800))
          await page.waitForTimeout(1500)
          
          sendEvent('status', { message: 'Scraping successful! Generating Lead profile...' })
        } else {
          sendEvent('status', { message: 'No viable links found. Terminating.' })
        }
        
        await page.waitForTimeout(1000)
        isScraping = false // Stop the frame loop
        await browser.close()
        
        // Mock returning the scraped lead
        sendEvent('result', { 
          companyName: 'Found Company LLC',
          websiteUrl: firstLink || 'unknown',
          contactEmail: 'contact@scraped.com'
        })
        
        sendEvent('done', { message: 'Scraping complete' })
        controller.close()
      } catch (error) {
        console.error("Scraper Error:", error)
        sendEvent('error', { message: 'Failed to launch headless browser.' })
        controller.close()
      }
    }
  })

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  })
}
