import { z } from 'zod'

// ============================================================================
// SHARED VALIDATORS
// ============================================================================

export const EmailSchema = z.string().email('Invalid email address')

export const URLSchema = z.string().url('Invalid URL').optional().nullable()

export const PhoneSchema = z.string().regex(/^[+\d\s\-()]{10,20}$/, 'Invalid phone number').optional()

export const PaginationSchema = z.object({
  skip: z.coerce.number().int().min(0).default(0),
  take: z.coerce.number().int().min(1).max(100).default(10),
})

// ============================================================================
// LEAD SCHEMAS
// ============================================================================

export const CreateLeadSchema = z.object({
  companyName: z.string().min(1, 'Company name is required').max(255),
  websiteUrl: URLSchema,
  industry: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  city: z.string().max(100).optional(),
  contactEmail: EmailSchema.optional(),
  phone: PhoneSchema,
  linkedinUrl: URLSchema,
  googleBusinessUrl: URLSchema,
  sourceUrl: URLSchema,
  sourceType: z.string().max(100).optional(),
  discoveryMethod: z.string().max(100).optional(),
  leadPurpose: z.string().max(255).optional(),
  businessTypeId: z.string().cuid().optional(),
})

export const UpdateLeadSchema = z.object({
  companyName: z.string().min(1).max(255).optional(),
  websiteUrl: URLSchema,
  industry: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  city: z.string().max(100).optional(),
  contactEmail: EmailSchema.optional(),
  phone: PhoneSchema,
  linkedinUrl: URLSchema,
  googleBusinessUrl: URLSchema,
  leadPurpose: z.string().max(255).optional(),
  businessTypeId: z.string().cuid().optional(),
})

export const UpdateLeadStatusSchema = z.object({
  status: z.enum(['NEW', 'CONTACTED', 'INTERESTED', 'QUALIFIED', 'CONVERTED', 'REJECTED', 'ARCHIVED']),
})

export const AddLeadNoteSchema = z.object({
  note: z.string().min(1, 'Note cannot be empty').max(5000),
})

export const BulkImportLeadsSchema = z.object({
  leads: z.array(CreateLeadSchema).min(1, 'At least one lead is required').max(1000, 'Maximum 1000 leads at a time'),
  enrichData: z.boolean().default(true),
})

// ============================================================================
// WEBSITE SCHEMAS
// ============================================================================

export const GenerateWebsiteSchema = z.object({
  leadId: z.string().cuid('Invalid lead ID'),
  templateId: z.string().optional(),
  companyName: z.string().min(1).max(255),
  tagline: z.string().max(255).optional(),
  description: z.string().max(1000).optional(),
  primaryColor: z.string().regex(/^#[0-9A-F]{6}$/i, 'Invalid color format').default('#0066cc'),
  includeContactForm: z.boolean().default(true),
  includeBlog: z.boolean().default(false),
})

export const PublishWebsiteSchema = z.object({
  leadId: z.string().cuid('Invalid lead ID'),
  htmlContent: z.string().min(1, 'HTML content is required'),
  domainName: z.string().optional(),
})

export const UpdateWebsiteSchema = z.object({
  htmlContent: z.string().min(1, 'HTML content is required'),
  domainName: z.string().optional(),
})

// ============================================================================
// EMAIL SCHEMAS
// ============================================================================

export const DraftEmailSchema = z.object({
  leadId: z.string().cuid('Invalid lead ID'),
  subject: z.string().min(1, 'Subject is required').max(255),
  body: z.string().min(1, 'Body is required').max(5000),
  templateId: z.string().optional(),
  useAiGeneration: z.boolean().default(false),
})

export const SendEmailSchema = z.object({
  emailId: z.string().cuid('Invalid email ID'),
  leadId: z.string().cuid('Invalid lead ID').optional(),
})

export const BulkSendEmailSchema = z.object({
  leadIds: z.array(z.string().cuid()).min(1).max(50, 'Maximum 50 emails at a time'),
  templateId: z.string().cuid('Invalid template ID'),
  personalizeEmails: z.boolean().default(true),
})

// ============================================================================
// WEBSITE ANALYSIS SCHEMAS
// ============================================================================

export const AnalyzeWebsiteSchema = z.object({
  leadId: z.string().cuid('Invalid lead ID'),
  websiteUrl: z.string().url('Invalid website URL'),
  fullAnalysis: z.boolean().default(false),
})

export const GenerateReportSchema = z.object({
  leadId: z.string().cuid('Invalid lead ID'),
  includeRecommendations: z.boolean().default(true),
  reportType: z.enum(['FULL', 'QUICK', 'CUSTOM']).default('FULL'),
})

// ============================================================================
// MARKETPLACE SCHEMAS
// ============================================================================

export const ListLeadOnMarketplaceSchema = z.object({
  leadId: z.string().cuid('Invalid lead ID'),
  askingPrice: z.number().int().min(1, 'Price must be at least 1').max(1000000),
  description: z.string().max(500).optional(),
})

export const BuyLeadSchema = z.object({
  listingId: z.string().cuid('Invalid listing ID'),
  leadId: z.string().cuid('Invalid lead ID'),
  price: z.number().int().min(1),
})

export const UpdateMarketplaceListingSchema = z.object({
  askingPrice: z.number().int().min(1).max(1000000).optional(),
  description: z.string().max(500).optional(),
  status: z.enum(['ACTIVE', 'SOLD', 'HIDDEN']).optional(),
})

// ============================================================================
// BILLING SCHEMAS
// ============================================================================

export const PurchaseCreditsSchema = z.object({
  packageId: z.string().min(1, 'Package ID is required'),
  quantity: z.number().int().min(1).default(1),
})

export const CreateCheckoutSessionSchema = z.object({
  credits: z.number().int().min(10, 'Minimum 10 credits').max(10000, 'Maximum 10000 credits'),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
})

// ============================================================================
// ADMIN SCHEMAS
// ============================================================================

export const CreateModuleSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  category: z.string().max(100).optional(),
  isInternal: z.boolean().default(false),
})

export const UpdateModuleSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(500).optional(),
  category: z.string().max(100).optional(),
  isActive: z.boolean().optional(),
})

export const EnableModuleForBusinessTypeSchema = z.object({
  businessTypeId: z.string().cuid(),
  moduleId: z.string().cuid(),
  requiresWhitelist: z.boolean().default(false),
  requiresPremium: z.boolean().default(false),
})

export const SetUserModuleOverrideSchema = z.object({
  userId: z.string().cuid(),
  moduleId: z.string().cuid(),
  enabled: z.boolean(),
  reason: z.string().max(500).optional(),
})

// ============================================================================
// USER SCHEMAS
// ============================================================================

export const UpdateUserProfileSchema = z.object({
  companyName: z.string().max(255).optional(),
  website: URLSchema,
  preferredLanguage: z.string().max(10).default('en'),
  preferredTone: z.string().max(50).default('professional'),
  country: z.string().max(100).optional(),
  timezone: z.string().max(50).optional(),
  targetCustomers: z.string().max(500).optional(),
  serviceDescription: z.string().max(5000).optional(),
})

export const UpdateUserBusinessProfileSchema = z.object({
  businessTypeId: z.string().cuid(),
  companyName: z.string().max(255).optional(),
  website: URLSchema,
  serviceDescription: z.string().max(5000).optional(),
  targetCustomers: z.string().max(500).optional(),
  preferredTone: z.string().max(50).optional(),
  preferredLanguage: z.string().max(10).optional(),
})

// ============================================================================
// AUTH SCHEMAS
// ============================================================================

export const WhitelistUserSchema = z.object({
  userId: z.string().cuid(),
  status: z.enum(['APPROVED', 'REJECTED']),
  reason: z.string().max(500).optional(),
})

// ============================================================================
// EXPORT ALL SCHEMAS FOR TYPE INFERENCE
// ============================================================================

export type CreateLead = z.infer<typeof CreateLeadSchema>
export type UpdateLead = z.infer<typeof UpdateLeadSchema>
export type UpdateLeadStatus = z.infer<typeof UpdateLeadStatusSchema>
export type GenerateWebsite = z.infer<typeof GenerateWebsiteSchema>
export type DraftEmail = z.infer<typeof DraftEmailSchema>
export type SendEmail = z.infer<typeof SendEmailSchema>
export type AnalyzeWebsite = z.infer<typeof AnalyzeWebsiteSchema>
export type GenerateReport = z.infer<typeof GenerateReportSchema>
export type ListLeadOnMarketplace = z.infer<typeof ListLeadOnMarketplaceSchema>
export type BuyLead = z.infer<typeof BuyLeadSchema>
export type PurchaseCredits = z.infer<typeof PurchaseCreditsSchema>
export type CreateCheckoutSession = z.infer<typeof CreateCheckoutSessionSchema>
