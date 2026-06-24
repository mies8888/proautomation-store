# Cloudflare Upload Instructions

## What's in this folder:
- /static/ - Next.js static assets (CSS, JS bundles)
- /public/ - Public static files (SVGs, images)
- index.html - Landing page

## Upload to Cloudflare:

### Option 1: CLI (Recommended)
npm install -g @cloudflare/wrangler
wrangler login
wrangler pages deploy .

### Option 2: Dashboard
1. Go to https://dash.cloudflare.com
2. Pages -> Create Project -> Direct Upload
3. Drag and drop this folder
4. Deploy!

## After Upload:
Your site will be available at: https://your-project.pages.dev

Note: This is static assets only. For dynamic features (API, database),
you need Cloudflare Workers or a backend server.
