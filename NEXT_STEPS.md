# ProAutomation.store - Remaining Development Roadmap

## Current Status: 60% Complete (Phase 2 ✅ + Phase 3 64%)

---

## Phase 3: Gmail Integration (Continue)

### Priority 1: Core Webhook Implementation (1-2 hours)

**1. Create Cloud Pub/Sub Webhook Endpoint**
- [ ] Create `/src/app/api/webhooks/gmail/route.ts`
- [ ] Implement POST handler for Cloud Pub/Sub messages
- [ ] Decode and validate Pub/Sub message format
- [ ] Extract emailAddress and historyId from payload
- [ ] Call `GmailWebhookService.processWebhookNotification()`
- [ ] Add error handling and retry logic
- [ ] Test with sample Pub/Sub messages

**2. Environment Variables Setup**
- [ ] Add `GMAIL_PUB_SUB_TOPIC` environment variable
- [ ] Add `GOOGLE_CLOUD_PROJECT_ID` for Pub/Sub
- [ ] Document required GCP permissions
- [ ] Add to `.env.example`

**3. Update Gmail Sync to Use Webhooks**
- [ ] Modify `/api/gmail/sync` to trigger from webhook
- [ ] Cache last sync time to avoid duplicate processing
- [ ] Add rate limiting (max 1 sync per 30 seconds)

---

### Priority 2: Email Template UI (2-3 hours)

**1. Create Template Management Endpoint**
- [ ] Create `/src/app/api/templates/route.ts`
- [ ] GET - List all templates with categories
- [ ] POST - Create custom template
- [ ] PUT - Update template
- [ ] DELETE - Remove custom template
- [ ] Validation: required fields, variable syntax

**2. Build Template Editor Component**
- [ ] Create `/src/app/(dashboard)/templates/page.tsx`
- [ ] List all available templates
- [ ] Template preview with live variable substitution
- [ ] Add/Edit custom templates form
- [ ] Variable reference guide ({{companyName}}, {{service}}, etc.)
- [ ] Rich text editor for HTML body

**3. Integrate with Email Composer**
- [ ] Update lead detail page to use templates
- [ ] Template selection dropdown
- [ ] Auto-fill variables from lead data
- [ ] Preview before sending

---

### Priority 3: Reply Detection Refinement (1-2 hours)

**1. Improve Email Matching Algorithm**
- [ ] Enhance `replyDetector.ts` pattern matching
- [ ] Check for "In-Reply-To" header first
- [ ] Then fall back to subject matching (Re: prefix)
- [ ] Implement email body context matching
- [ ] Add confidence scoring (0-100)

**2. Handle Reply Threading**
- [ ] Create `/src/app/api/leads/[id]/email-thread/route.ts`
- [ ] GET - Fetch full email thread for a lead
- [ ] Track conversation history per lead
- [ ] Return chronological message order

**3. Auto-Update Lead Status**
- [ ] When reply detected, mark OutreachEmail as `REPLIED`
- [ ] Update Lead status to `ENGAGED`
- [ ] Increase lead engagement scores
- [ ] Log reply activity

---

### Priority 4: Engagement Dashboard (2-3 hours)

**1. Create Engagement Analytics Page**
- [ ] Create `/src/app/(dashboard)/email-analytics/page.tsx`
- [ ] Show email send summary (today, week, month)
- [ ] Display open/click/reply rates
- [ ] List recent email activities
- [ ] Show top performing templates

**2. Email Activity Cards**
- [ ] Component for email status summary
- [ ] Cards for: sent, opened, clicked, replied, bounced
- [ ] Real-time update indicators
- [ ] Filter by date range

**3. Campaign Performance Charts**
- [ ] Chart: open rates by template
- [ ] Chart: reply rate over time
- [ ] Chart: email volume vs replies
- [ ] Chart: conversion funnel

---

## Phase 4: Advanced Features (3-4 weeks)

### AI Email Optimization (3-5 hours)
- [ ] Create `/src/app/api/ai/email-optimizer/route.ts`
- [ ] Use Claude to suggest email improvements
- [ ] Analyze subject lines for open rate optimization
- [ ] Suggest personalization improvements
- [ ] A/B testing recommendations

### Sequence Execution Engine (4-6 hours)
- [ ] Implement background job processor
- [ ] Create scheduled task runner (cron-like)
- [ ] Execute email sends at scheduled intervals
- [ ] Handle retries for failed sends
- [ ] Track sequence progress per lead

### Sales CRM Integration (4-6 hours)
- [ ] Create `/src/app/api/crm/sync/route.ts`
- [ ] Support HubSpot, Salesforce, Pipedrive APIs
- [ ] Two-way sync: leads, activities, deals
- [ ] Automated activity logging on email events
- [ ] Deal stage advancement based on replies

### Lead Scoring Enhancements (2-3 hours)
- [ ] Factor in email engagement into lead score
- [ ] Weight: opens (5%), clicks (10%), replies (25%)
- [ ] Time decay: older activities worth less
- [ ] Update scoring in real-time

### Bulk Email Operations (2-3 hours)
- [ ] Create `/src/app/api/leads/bulk/email/route.ts`
- [ ] Send same email to multiple leads
- [ ] Apply template substitution per lead
- [ ] Schedule bulk sends
- [ ] Progress tracking and reporting

---

## Quick Implementation Checklist

### Immediate (Next 1-2 hours)
```
☐ Set up Cloud Pub/Sub webhook endpoint
☐ Test webhook with sample messages
☐ Add environment variables
☐ Verify Gmail sync triggered by webhooks
```

### Short-term (Next 3-5 hours)
```
☐ Create template management API
☐ Build template editor UI
☐ Integrate templates with email composer
☐ Test template variable substitution
```

### Medium-term (Next 5-8 hours)
```
☐ Improve reply detection algorithm
☐ Create email thread endpoint
☐ Auto-update lead status on replies
☐ Build engagement analytics dashboard
☐ Create email activity tracking cards
```

### Before Production (Phase 4)
```
☐ Email send rate limiting (per user quotas)
☐ Bounce handling and list management
☐ Unsubscribe handling
☐ GDPR compliance (consent tracking)
☐ Spam score checking before send
☐ Full test coverage for email flows
☐ Performance optimization (batch processing)
```

---

## Testing Checklist

### Gmail API Integration
- [ ] Test sending email via Gmail API
- [ ] Test reply detection with real Gmail messages
- [ ] Test token refresh when access token expires
- [ ] Test rate limiting (Gmail API limits)
- [ ] Test webhook delivery and processing

### Email Flows
- [ ] Cold outreach → reply detection → lead update
- [ ] Sequence execution → proper delays → auto-send
- [ ] Template substitution → verify all variables replaced
- [ ] Engagement tracking → open/click/bounce detection

### Edge Cases
- [ ] Duplicate email handling (same lead, same message)
- [ ] Reply from new email address
- [ ] Forward instead of reply
- [ ] Group email threads
- [ ] Email without In-Reply-To header

---

## Environment Setup Required

```
# Gmail API
GMAIL_CLIENT_ID=your_oauth_client_id
GMAIL_CLIENT_SECRET=your_oauth_secret
GMAIL_REDIRECT_URL=http://localhost:3000/api/auth/callback/google

# Cloud Pub/Sub (for webhooks)
GMAIL_PUB_SUB_TOPIC=projects/YOUR_PROJECT/topics/gmail-notifications
GOOGLE_CLOUD_PROJECT_ID=your-gcp-project-id

# Database
DATABASE_URL=file:./dev.db

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=generate_with_openssl

# AI Integration
ANTHROPIC_API_KEY=your_claude_api_key
```

---

## Architecture Notes

### Current Structure
- `src/lib/gmail/` - Gmail API wrapper
- `src/services/gmail/` - Email services (send, sync, templates, etc.)
- `src/app/api/gmail/` - Gmail API endpoints
- `src/app/api/sequences/` - Sequence management
- Database: Prisma SQLite with OutreachEmail, EmailReply, ActivityLog models

### Next Additions
- `src/app/api/templates/` - Template management
- `src/app/api/webhooks/gmail/` - Webhook receiver
- `src/app/api/emails/` - Email analytics
- `src/app/(dashboard)/templates/` - Template editor UI
- `src/app/(dashboard)/email-analytics/` - Dashboard

---

## Performance Considerations

1. **Email Sync Optimization**
   - Use Gmail `historyId` to sync only new emails
   - Batch process multiple users in background jobs
   - Cache template data to avoid repeated lookups

2. **Reply Detection**
   - Use Gmail's built-in threading instead of custom matching
   - Implement confidence scoring to avoid false positives
   - Process replies asynchronously in background jobs

3. **Sequence Execution**
   - Use background job queue (Bull, Agenda)
   - Batch process multiple sequences
   - Implement exponential backoff for failures

4. **Database Queries**
   - Index on (userId, leadId) for activity queries
   - Index on outreachEmail(userId, status) for filtering
   - Use pagination for large result sets

---

## Success Metrics

By end of Phase 3:
- ✓ 100 emails sent per day (MVP)
- ✓ 95%+ delivery success rate
- ✓ Reply detection accuracy > 90%
- ✓ Response time < 2 seconds for all endpoints
- ✓ 99% uptime with proper error handling

By end of Phase 4:
- ✓ 1000+ emails sent per day
- ✓ A/B testing for email templates
- ✓ AI-optimized subject lines
- ✓ Full CRM integration
- ✓ Advanced analytics and reporting
