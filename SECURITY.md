# Security Policy

Security is a primary priority for ProAutomation.store.

## Supported Versions

Only the latest `main` branch is actively supported with security updates.

## Reporting a Vulnerability

If you discover a security vulnerability within ProAutomation.store, please send an e-mail to the security team. All security vulnerabilities will be promptly addressed.

## Security Rules

1. **No Hardcoded Secrets:** Never hardcode credentials, tokens, or API keys in the source code.
2. **Environment Variables:** Only commit `.env.example`. Ensure `.env` is always excluded via `.gitignore`.
3. **Encrypted Tokens:** External OAuth tokens (e.g., Gmail) must be securely encrypted before storage.
4. **Principle of Least Privilege:** Request minimal required scopes from third-party services.
5. **Rate Limiting:** Protect all expensive and sensitive API routes against abuse.
6. **Data Validation:** Validate all incoming requests and payload data using `zod`.
7. **Audit Logs:** Log all sensitive actions, billing events, and whitelist modifications for Super Admin review.
