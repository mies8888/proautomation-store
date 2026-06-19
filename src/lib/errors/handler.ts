import { NextRequest, NextResponse } from 'next/server'
import { ZodError } from 'zod'

// ============================================================================
// ERROR CLASSES
// ============================================================================

export class AppError extends Error {
  constructor(
    public statusCode: number = 500,
    public message: string = 'Internal Server Error',
    public code: string = 'INTERNAL_ERROR',
    public details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = this.constructor.name
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      ...(this.details && { details: this.details }),
    }
  }
}

export class ValidationError extends AppError {
  constructor(message: string = 'Validation failed', details?: Record<string, unknown>) {
    super(400, message, 'VALIDATION_ERROR', details)
  }
}

export class AuthError extends AppError {
  constructor(message: string = 'Authentication failed') {
    super(401, message, 'AUTH_ERROR')
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Access denied') {
    super(403, message, 'FORBIDDEN')
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(404, `${resource} not found`, 'NOT_FOUND')
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Resource already exists') {
    super(409, message, 'CONFLICT')
  }
}

export class RateLimitError extends AppError {
  constructor(retryAfter?: number) {
    super(
      429,
      'Too many requests. Please try again later.',
      'RATE_LIMIT',
      retryAfter ? { retryAfter } : undefined,
    )
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, message: string) {
    super(502, `${service} service unavailable: ${message}`, 'EXTERNAL_SERVICE_ERROR')
  }
}

// ============================================================================
// ERROR RESPONSE FORMATTING
// ============================================================================

export interface ErrorResponse {
  code: string
  message: string
  statusCode: number
  details?: Record<string, unknown>
  timestamp: string
}

export function formatErrorResponse(error: unknown): ErrorResponse {
  const timestamp = new Date().toISOString()

  if (error instanceof AppError) {
    return {
      code: error.code,
      message: error.message,
      statusCode: error.statusCode,
      ...(error.details && { details: error.details }),
      timestamp,
    }
  }

  if (error instanceof ZodError) {
    const details = (error as any).errors?.reduce((acc: Record<string, string>, err: any) => {
      const path = err.path.join('.')
      acc[path] = err.message
      return acc
    }, {} as Record<string, string>) || {}

    return {
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      statusCode: 400,
      details,
      timestamp,
    }
  }

  if (error instanceof Error) {
    return {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      statusCode: 500,
      timestamp,
    }
  }

  return {
    code: 'INTERNAL_ERROR',
    message: 'Internal server error',
    statusCode: 500,
    timestamp,
  }
}

// ============================================================================
// API ERROR HANDLER
// ============================================================================

export function createErrorResponse(error: unknown): NextResponse {
  const errorResponse = formatErrorResponse(error)

  // Log error in development
  if (process.env.NODE_ENV === 'development') {
    console.error('[API Error]', {
      code: errorResponse.code,
      message: errorResponse.message,
      statusCode: errorResponse.statusCode,
      timestamp: errorResponse.timestamp,
      originalError: error instanceof Error ? error.stack : String(error),
    })
  }

  const response = NextResponse.json(errorResponse, {
    status: errorResponse.statusCode,
  })

  // Add security headers
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')

  return response
}

// ============================================================================
// VALIDATION HELPER
// ============================================================================

export async function validateRequest<T>(req: NextRequest, schema: { parseAsync: (data: unknown) => Promise<T> }): Promise<T> {
  try {
    const body = await req.json()
    return await schema.parseAsync(body)
  } catch (error) {
    if (error instanceof ZodError) {
      const details = (error as any).errors?.reduce((acc: Record<string, string>, err: any) => {
        const path = err.path.join('.')
        acc[path] = err.message
        return acc
      }, {} as Record<string, string>) || {}
      throw new ValidationError('Request validation failed', details)
    }
    throw new ValidationError('Invalid request body')
  }
}

// ============================================================================
// SAFE HANDLER WRAPPER
// ============================================================================

export function withErrorHandling(
  handler: (req: NextRequest) => Promise<NextResponse>
): (req: NextRequest) => Promise<NextResponse>
export function withErrorHandling(
  handler: (req: NextRequest, props: any) => Promise<NextResponse>
): (req: NextRequest, props: any) => Promise<NextResponse>
export function withErrorHandling(handler: any) {
  return async (...args: any[]) => {
    try {
      return await handler(...args)
    } catch (error) {
      return createErrorResponse(error)
    }
  }
}
