import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { withErrorHandling, ForbiddenError, AppError } from '@/lib/errors/handler'
import { prisma } from '@/lib/db/prisma'

interface CRMConfig {
  crmType: 'hubspot' | 'salesforce' | 'pipedrive'
  accessToken?: string
  refreshToken?: string
  portalId?: string
  instanceUrl?: string
  expiresAt?: Date
}

/**
 * POST - Connect CRM account
 */
export const POST = withErrorHandling(async (req: NextRequest) => {
  const session = await auth()
  if (!session?.user?.id) {
    throw new ForbiddenError('Not authenticated')
  }

  try {
    const data = await req.json()
    const { crmType, authCode } = data

    if (!crmType || !authCode) {
      throw new AppError(400, 'crmType and authCode required', 'MISSING_FIELDS')
    }

    if (!['hubspot', 'salesforce', 'pipedrive'].includes(crmType)) {
      throw new AppError(400, 'Invalid CRM type', 'INVALID_CRM')
    }

    let tokens: any = {}

    // Exchange auth code for tokens based on CRM type
    switch (crmType) {
      case 'hubspot':
        tokens = await exchangeHubSpotToken(authCode)
        break
      case 'salesforce':
        tokens = await exchangeSalesforceToken(authCode)
        break
      case 'pipedrive':
        tokens = await exchangePipedriveToken(authCode)
        break
    }

    // Store CRM connection in activity log instead of user model
    // (CRM fields can be added to schema in a future migration)
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        action: `CRM_CONNECTED_${crmType.toUpperCase()}`,
        metadata: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken || null,
          expiresAt: tokens.expiresAt,
          connectedAt: new Date().toISOString()
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: `${crmType} connected successfully`,
      crm: {
        type: crmType,
        connectedAt: new Date().toISOString()
      }
    })
  } catch (err: any) {
    if (err instanceof AppError) throw err
    throw new AppError(500, 'Failed to connect CRM', 'CRM_CONNECTION_FAILED')
  }
})

/**
 * GET - Get CRM connection status
 */
export const GET = withErrorHandling(async (req: NextRequest) => {
  const session = await auth()
  if (!session?.user?.id) {
    throw new ForbiddenError('Not authenticated')
  }

  try {
    // Get latest CRM connection from activity log
    const crmConnection = await prisma.activityLog.findFirst({
      where: {
        userId: session.user.id,
        action: { in: ['CRM_CONNECTED_HUBSPOT', 'CRM_CONNECTED_SALESFORCE', 'CRM_CONNECTED_PIPEDRIVE'] }
      },
      orderBy: { createdAt: 'desc' }
    })

    if (!crmConnection) {
      return NextResponse.json({
        connected: false,
        crm: null
      })
    }

    const metadata = crmConnection.metadata as any
    const isExpired = metadata.expiresAt && new Date(metadata.expiresAt) < new Date()

    return NextResponse.json({
      connected: !isExpired,
      crm: {
        type: crmConnection.action.replace('CRM_CONNECTED_', '').toLowerCase(),
        expiresAt: metadata.expiresAt
      }
    })
  } catch (err: any) {
    throw new AppError(500, 'Failed to get CRM status', 'STATUS_FAILED')
  }
})

/**
 * PUT - Sync leads to CRM
 */
export const PUT = withErrorHandling(async (req: NextRequest) => {
  const session = await auth()
  if (!session?.user?.id) {
    throw new ForbiddenError('Not authenticated')
  }

  try {
    const { leadIds } = await req.json()

    if (!leadIds || leadIds.length === 0) {
      throw new AppError(400, 'leadIds required', 'MISSING_LEADS')
    }

    // Get latest CRM connection
    const crmConnection = await prisma.activityLog.findFirst({
      where: {
        userId: session.user.id,
        action: { in: ['CRM_CONNECTED_HUBSPOT', 'CRM_CONNECTED_SALESFORCE', 'CRM_CONNECTED_PIPEDRIVE'] }
      },
      orderBy: { createdAt: 'desc' }
    })

    if (!crmConnection) {
      throw new AppError(400, 'CRM not connected', 'CRM_NOT_CONNECTED')
    }

    const crmType = crmConnection.action.replace('CRM_CONNECTED_', '').toLowerCase()
    const metadata = crmConnection.metadata as any
    const accessToken = metadata.accessToken

    // Get leads to sync
    const leads = await prisma.lead.findMany({
      where: {
        id: { in: leadIds },
        ownerUserId: session.user.id
      }
    })

    let syncedCount = 0
    let errors: string[] = []

    // Sync each lead to CRM
    for (const lead of leads) {
      try {
        await syncLeadToCRM(crmType, accessToken, lead)
        syncedCount++

        // Log sync activity
        await prisma.activityLog.create({
          data: {
            userId: session.user.id,
            leadId: lead.id,
            action: `CRM_SYNC_${crmType.toUpperCase()}`,
            metadata: {
              timestamp: new Date().toISOString(),
              status: 'synced'
            }
          }
        })
      } catch (err: any) {
        errors.push(`${lead.companyName || lead.id}: ${err.message}`)
      }
    }

    return NextResponse.json({
      success: true,
      syncedCount,
      totalCount: leads.length,
      errors: errors.length > 0 ? errors : undefined
    })
  } catch (err: any) {
    if (err instanceof AppError) throw err
    throw new AppError(500, 'Failed to sync leads', 'SYNC_FAILED')
  }
})

// Helper functions

async function exchangeHubSpotToken(authCode: string): Promise<any> {
  const response = await fetch('https://api.hubapi.com/oauth/v1/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: process.env.HUBSPOT_CLIENT_ID || '',
      client_secret: process.env.HUBSPOT_CLIENT_SECRET || '',
      redirect_uri: `${process.env.NEXTAUTH_URL}/api/crm/callback?type=hubspot`,
      code: authCode
    }).toString()
  })

  if (!response.ok) {
    throw new Error('Failed to exchange HubSpot token')
  }

  const data = await response.json()
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000)
  }
}

async function exchangeSalesforceToken(authCode: string): Promise<any> {
  const response = await fetch(
    `${process.env.SALESFORCE_INSTANCE_URL}/services/oauth2/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: process.env.SALESFORCE_CLIENT_ID || '',
        client_secret: process.env.SALESFORCE_CLIENT_SECRET || '',
        redirect_uri: `${process.env.NEXTAUTH_URL}/api/crm/callback?type=salesforce`,
        code: authCode
      }).toString()
    }
  )

  if (!response.ok) {
    throw new Error('Failed to exchange Salesforce token')
  }

  const data = await response.json()
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000)
  }
}

async function exchangePipedriveToken(authCode: string): Promise<any> {
  const response = await fetch('https://oauth.pipedrive.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: process.env.PIPEDRIVE_CLIENT_ID || '',
      client_secret: process.env.PIPEDRIVE_CLIENT_SECRET || '',
      redirect_uri: `${process.env.NEXTAUTH_URL}/api/crm/callback?type=pipedrive`,
      code: authCode
    }).toString()
  })

  if (!response.ok) {
    throw new Error('Failed to exchange Pipedrive token')
  }

  const data = await response.json()
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000)
  }
}

async function syncLeadToCRM(
  crmType: string,
  accessToken: string,
  lead: any
): Promise<void> {
  switch (crmType) {
    case 'hubspot':
      await syncLeadToHubSpot(accessToken, lead)
      break
    case 'salesforce':
      await syncLeadToSalesforce(accessToken, lead)
      break
    case 'pipedrive':
      await syncLeadToPipedrive(accessToken, lead)
      break
  }
}

async function syncLeadToHubSpot(accessToken: string, lead: any): Promise<void> {
  const response = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      properties: {
        firstname: lead.companyName?.split(' ')[0] || 'Lead',
        lastname: lead.companyName?.split(' ')[1] || '',
        email: lead.contactEmail,
        company: lead.companyName,
        phone: lead.phone
      }
    })
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`HubSpot sync failed: ${error.message}`)
  }
}

async function syncLeadToSalesforce(
  accessToken: string,
  lead: any
): Promise<void> {
  const instanceUrl = process.env.SALESFORCE_INSTANCE_URL
  const response = await fetch(`${instanceUrl}/services/data/v57.0/sobjects/Lead`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      FirstName: lead.companyName?.split(' ')[0] || 'Lead',
      LastName: lead.companyName?.split(' ')[1] || '',
      Email: lead.contactEmail,
      Company: lead.companyName,
      Phone: lead.phone
    })
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Salesforce sync failed: ${error[0]?.message}`)
  }
}

async function syncLeadToPipedrive(accessToken: string, lead: any): Promise<void> {
  const response = await fetch('https://api.pipedrive.com/v1/persons', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: lead.companyName,
      email: lead.contactEmail,
      phone: lead.phone,
      org_id: lead.companyName,
      access_token: accessToken
    })
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Pipedrive sync failed: ${error.error}`)
  }
}
