import { gmail_v1, google } from "googleapis"
import { prisma } from "@/lib/db/prisma"
import { AppError } from "@/lib/errors/handler"

interface GmailSendOptions {
  userId: string
  to: string
  subject: string
  body: string
  htmlBody?: string
  replyTo?: string
}

interface GmailSendResult {
  messageId: string
  threadId: string
  sentAt: Date
  success: boolean
  error?: string
}

class GmailSendError extends AppError {
  constructor(message: string, public readonly retryable: boolean = true) {
    super(500, message, 'GMAIL_SEND_ERROR')
  }
}

const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
}

/**
 * Exponential backoff retry logic
 */
async function withExponentialBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = RETRY_CONFIG.maxRetries
): Promise<T> {
  let lastError: Error | null = null
  let delayMs = RETRY_CONFIG.initialDelayMs

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error
      
      const isRetryable =
        error instanceof GmailSendError
          ? error.retryable
          : isRetryableError(error)

      if (attempt === maxRetries || !isRetryable) {
        throw error
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs))
      delayMs = Math.min(delayMs * RETRY_CONFIG.backoffMultiplier, RETRY_CONFIG.maxDelayMs)
    }
  }

  throw lastError || new Error("Unknown error in retry logic")
}

/**
 * Determine if an error is retryable
 */
function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false

  const message = error.message.toLowerCase()
  const retryablePatterns = [
    "econnreset",
    "econnrefused",
    "timeout",
    "429", // Rate limit
    "500", // Server error
    "503", // Service unavailable
  ]

  return retryablePatterns.some((pattern) => message.includes(pattern))
}

/**
 * Create RFC 2822 formatted email
 */
function createMessage(options: GmailSendOptions): string {
  const headers = [
    `From: ${options.userId}`,
    `To: ${options.to}`,
    `Subject: ${options.subject}`,
    "MIME-Version: 1.0",
    'Content-Type: multipart/alternative; boundary="boundary123"',
  ]

  if (options.replyTo) {
    headers.push(`Reply-To: ${options.replyTo}`)
  }

  const body = `--boundary123
Content-Type: text/plain; charset="UTF-8"

${options.body}

--boundary123
Content-Type: text/html; charset="UTF-8"

${options.htmlBody || `<p>${options.body.replace(/\n/g, "<br>")}</p>`}

--boundary123--`

  return `${headers.join("\r\n")}\r\n\r\n${body}`
}

/**
 * Send email via Gmail API
 */
export async function sendEmailViaGmail(
  options: GmailSendOptions & { refreshToken: string; accessToken?: string }
): Promise<GmailSendResult> {
  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/auth/callback/google`
    )

    // Set the credentials
    oauth2Client.setCredentials({
      refresh_token: options.refreshToken,
      access_token: options.accessToken,
    })

    const gmail = google.gmail({ version: "v1", auth: oauth2Client })

    // Create and send message with retry logic
    const result = await withExponentialBackoff(async () => {
      const message = createMessage(options)
      const encodedMessage = Buffer.from(message)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "")

      const response = await gmail.users.messages.send({
        userId: "me",
        requestBody: {
          raw: encodedMessage,
        },
      })

      if (!response.data.id) {
        throw new GmailSendError("No message ID returned from Gmail API", false)
      }

      return {
        messageId: response.data.id,
        threadId: response.data.threadId || response.data.id,
      }
    })

    // Update the OutreachEmail record with sent timestamp
    try {
      // Find the most recent draft email for this recipient
      const emailRecord = await prisma.outreachEmail.findFirst({
        where: {
          to: options.to,
          userId: options.userId,
          sentAt: null,
        },
        orderBy: { createdAt: 'desc' }
      })

      if (emailRecord) {
        await prisma.outreachEmail.update({
          where: { id: emailRecord.id },
          data: {
            sentAt: new Date(),
            externalMessageId: result.messageId,
            externalThreadId: result.threadId,
          },
        })
      }
    } catch (dbError) {
      // Log but don't fail the send if DB update fails
      console.error("Failed to update OutreachEmail record:", dbError)
    }

    return {
      messageId: result.messageId,
      threadId: result.threadId,
      sentAt: new Date(),
      success: true,
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error sending email"

    // Classify Gmail API errors
    if (error instanceof Error) {
      const errorMessage = error.message.toLowerCase()

      if (errorMessage.includes("unauthorized")) {
        throw new GmailSendError(
          "Gmail OAuth token expired or invalid. Please re-authenticate.",
          false
        )
      }

      if (errorMessage.includes("invalid_grant")) {
        throw new GmailSendError(
          "Gmail refresh token expired. Please re-authenticate.",
          false
        )
      }

      if (errorMessage.includes("rate_limit_exceeded")) {
        throw new GmailSendError(
          "Gmail rate limit exceeded. Please try again later.",
          true
        )
      }

      if (errorMessage.includes("daily_limit_exceeded")) {
        throw new GmailSendError(
          "Gmail daily quota exceeded. Please try again tomorrow.",
          true
        )
      }
    }

    throw new GmailSendError(`Failed to send email: ${message}`, true)
  }
}

/**
 * Send email with automatic token refresh and retry
 * Uses stored account credentials from NextAuth
 */
export async function sendEmailWithStoredCredentials(
  options: Omit<GmailSendOptions, "userId"> & { accountId: string }
): Promise<GmailSendResult> {
  try {
    // Get account credentials from database
    const account = await prisma.account.findUnique({
      where: { id: options.accountId },
    })

    if (!account || account.provider !== "google") {
      throw new GmailSendError("Google account credentials not found", false)
    }

    if (!account.refresh_token) {
      throw new GmailSendError(
        "Gmail refresh token not available. Please re-connect your Gmail account.",
        false
      )
    }

    return await sendEmailViaGmail({
      ...options,
      userId: account.providerAccountId || "",
      refreshToken: account.refresh_token,
      accessToken: account.access_token || undefined,
    })
  } catch (error) {
    if (error instanceof GmailSendError) {
      throw error
    }
    throw new GmailSendError(
      `Failed to send email with stored credentials: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
      false
    )
  }
}

/**
 * Batch send emails with retry on failure
 */
export async function batchSendEmails(
  emails: (GmailSendOptions & { refreshToken: string; accountId?: string })[]
): Promise<(GmailSendResult | { error: string })[]> {
  return Promise.all(
    emails.map(async (email) => {
      try {
        return await sendEmailViaGmail(email)
      } catch (error) {
        return {
          error:
            error instanceof Error ? error.message : "Unknown error sending email",
        }
      }
    })
  )
}
