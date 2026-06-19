import { google } from 'googleapis'
import { prisma } from '@/lib/db/prisma'

const gmail = google.gmail('v1')

interface EmailMessage {
  id: string
  threadId: string
  from: string
  to: string
  subject: string
  body: string
  timestamp: number
  labels: string[]
  isRead: boolean
}

interface SendEmailOptions {
  to: string
  subject: string
  body: string
  cc?: string
  bcc?: string
}

/**
 * Get Gmail auth for a user
 */
async function getGmailAuth(userId: string) {
  const account = await prisma.account.findFirst({
    where: {
      userId,
      provider: 'google'
    }
  })

  if (!account?.access_token) {
    throw new Error('No Gmail access token found for user')
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    process.env.GMAIL_REDIRECT_URL
  )

  oauth2Client.setCredentials({
    access_token: account.access_token,
    refresh_token: account.refresh_token || undefined,
  })

  return oauth2Client
}

/**
 * Sync emails from Gmail inbox
 */
export async function syncGmailInbox(userId: string, maxResults: number = 10) {
  const auth = await getGmailAuth(userId)
  
  const response = await gmail.users.messages.list({
    auth,
    userId: 'me',
    maxResults,
    q: 'in:inbox',
  })

  const messages: EmailMessage[] = []

  if (response.data.messages) {
    for (const msg of response.data.messages) {
      const fullMsg = await gmail.users.messages.get({
        auth,
        userId: 'me',
        id: msg.id!,
        format: 'full',
      })

      const headers = fullMsg.data.payload?.headers || []
      const from = headers.find(h => h.name === 'From')?.value || 'Unknown'
      const to = headers.find(h => h.name === 'To')?.value || ''
      const subject = headers.find(h => h.name === 'Subject')?.value || '(No subject)'
      
      let body = ''
      if (fullMsg.data.payload?.parts) {
        const textPart = fullMsg.data.payload.parts.find(p => p.mimeType === 'text/plain')
        if (textPart?.body?.data) {
          body = Buffer.from(textPart.body.data, 'base64').toString('utf-8')
        }
      } else if (fullMsg.data.payload?.body?.data) {
        body = Buffer.from(fullMsg.data.payload.body.data, 'base64').toString('utf-8')
      }

      messages.push({
        id: msg.id!,
        threadId: msg.threadId!,
        from,
        to,
        subject,
        body: body.slice(0, 1000),
        timestamp: parseInt(fullMsg.data.internalDate || '0'),
        labels: fullMsg.data.labelIds || [],
        isRead: !(fullMsg.data.labelIds?.includes('UNREAD') ?? false),
      })
    }
  }

  return messages
}

/**
 * Send email via Gmail
 */
export async function sendEmail(userId: string, options: SendEmailOptions) {
  const auth = await getGmailAuth(userId)

  const message = [
    `From: <${options.to}>`,
    `To: ${options.to}`,
    ...(options.cc ? [`Cc: ${options.cc}`] : []),
    ...(options.bcc ? [`Bcc: ${options.bcc}`] : []),
    `Subject: ${options.subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 7bit',
    '',
    options.body
  ].join('\n')

  const encodedMessage = Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_')

  const response = await gmail.users.messages.send({
    auth,
    userId: 'me',
    requestBody: {
      raw: encodedMessage,
    }
  })

  return {
    messageId: response.data.id,
    threadId: response.data.threadId,
  }
}

/**
 * Get email thread
 */
export async function getEmailThread(userId: string, threadId: string) {
  const auth = await getGmailAuth(userId)

  const response = await gmail.users.threads.get({
    auth,
    userId: 'me',
    id: threadId,
  })

  const messages: EmailMessage[] = []

  if (response.data.messages) {
    for (const msg of response.data.messages) {
      const headers = msg.payload?.headers || []
      const from = headers.find(h => h.name === 'From')?.value || 'Unknown'
      const to = headers.find(h => h.name === 'To')?.value || ''
      const subject = headers.find(h => h.name === 'Subject')?.value || '(No subject)'

      let body = ''
      if (msg.payload?.parts) {
        const textPart = msg.payload.parts.find(p => p.mimeType === 'text/plain')
        if (textPart?.body?.data) {
          body = Buffer.from(textPart.body.data, 'base64').toString('utf-8')
        }
      } else if (msg.payload?.body?.data) {
        body = Buffer.from(msg.payload.body.data, 'base64').toString('utf-8')
      }

      messages.push({
        id: msg.id!,
        threadId: msg.threadId!,
        from,
        to,
        subject,
        body: body.slice(0, 1000),
        timestamp: parseInt(msg.internalDate || '0'),
        labels: msg.labelIds || [],
        isRead: !(msg.labelIds?.includes('UNREAD') ?? false),
      })
    }
  }

  return messages
}

/**
 * Mark email as read
 */
export async function markAsRead(userId: string, messageId: string) {
  const auth = await getGmailAuth(userId)

  await gmail.users.messages.modify({
    auth,
    userId: 'me',
    id: messageId,
    requestBody: {
      removeLabelIds: ['UNREAD'],
    }
  })
}

/**
 * Add label to email
 */
export async function addLabel(userId: string, messageId: string, labelId: string) {
  const auth = await getGmailAuth(userId)

  await gmail.users.messages.modify({
    auth,
    userId: 'me',
    id: messageId,
    requestBody: {
      addLabelIds: [labelId],
    }
  })
}

/**
 * Get user's Gmail labels
 */
export async function getLabels(userId: string) {
  const auth = await getGmailAuth(userId)

  const response = await gmail.users.labels.list({
    auth,
    userId: 'me',
  })

  return response.data.labels || []
}

/**
 * Create a new label
 */
export async function createLabel(userId: string, labelName: string) {
  const auth = await getGmailAuth(userId)

  const response = await gmail.users.labels.create({
    auth,
    userId: 'me',
    requestBody: {
      name: labelName,
      labelListVisibility: 'labelShow',
      messageListVisibility: 'show',
    }
  })

  return response.data
}

/**
 * Watch for new emails (using history API)
 */
export async function watchMailbox(userId: string) {
  const auth = await getGmailAuth(userId)

  const response = await gmail.users.watch({
    auth,
    userId: 'me',
    requestBody: {
      topicName: process.env.GMAIL_PUB_SUB_TOPIC,
    }
  })

  if (response.data.historyId) {
    await prisma.account.updateMany({
      where: {
        userId,
        provider: 'google'
      },
      data: {
        syncHistoryId: response.data.historyId
      }
    })
  }

  return response.data
}

/**
 * Get email history since last sync
 */
export async function getEmailHistory(userId: string) {
  const auth = await getGmailAuth(userId)

  const account = await prisma.account.findFirst({
    where: { userId, provider: 'google' }
  })

  if (!account?.syncHistoryId) {
    throw new Error('No sync history found. Please run watchMailbox first.')
  }

  const response = await gmail.users.history.list({
    auth,
    userId: 'me',
    startHistoryId: account.syncHistoryId,
  })

  return response.data.history || []
}
