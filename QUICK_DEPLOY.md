# Deploy in 5 Minutes: Quick Reference

## Prerequisites
- GitHub account (free at github.com)
- Vercel account (free at vercel.com)
- Google OAuth credentials (for Gmail login)

---

## Command 1: Push to GitHub

### First Time Setup:
```bash
# Clone this into a temporary folder to see current state
cd c:\Users\misch\.gemini\antigravity\scratch\proautomation-store
git remote add origin https://github.com/YOUR_USERNAME/proautomation-store.git
git branch -M main
git push -u origin main
```

Replace `YOUR_USERNAME` with your actual GitHub username.

### Next Pushes:
```bash
git add .
git commit -m "Your message"
git push
```

---

## Step 1: Create GitHub Repo
1. Visit https://github.com/new
2. Name: `proautomation-store`
3. Choose Public
4. Click "Create repository"
5. Copy the HTTPS URL

---

## Step 2: Push Code
```bash
cd c:\Users\misch\.gemini\antigravity\scratch\proautomation-store
git remote add origin YOUR_GITHUB_URL_HERE
git branch -M main
git push -u origin main
```

(It's long, so watch the console output - it will show progress)

---

## Step 3: Deploy to Vercel
1. Visit https://vercel.com/new
2. Click "Import Git Repository"
3. Paste your GitHub URL
4. Click "Import"
5. Set Project Name: `proautomation-store`
6. Click "Deploy"

---

## Step 4: Add Environment Variables (Critical!)
After deployment starts:
1. Go to https://vercel.com/dashboard
2. Select your project
3. Click "Settings"
4. Click "Environment Variables"
5. Add these:

```
GOOGLE_CLIENT_ID = xxx
GOOGLE_CLIENT_SECRET = xxx
ANTHROPIC_API_KEY = xxx
NEXTAUTH_URL = https://proautomation-store.vercel.app
NEXTAUTH_SECRET = generate_random_string
DATABASE_URL = file:./dev.db
```

To generate NEXTAUTH_SECRET:
- Option A: Use https://generate-secret.vercel.app
- Option B: Run: `openssl rand -base64 32`

---

## Step 5: Redeploy
After adding env vars:
1. Go back to "Deployments" tab
2. Click "..." on the latest deployment
3. Select "Redeploy"
4. Deployment starts (takes ~2-3 min)

---

## Step 6: Test
Once deployment finishes:
1. Visit: https://proautomation-store.vercel.app
2. Login with Google
3. Test the features!

---

## Your Temporary Domain Will Be:
```
https://proautomation-store.vercel.app
```

(Actual URL shown on Vercel dashboard after deployment)

---

## What Happens Next
- Every git push → auto-deploy in 2-3 min
- Changes live instantly
- Logs visible in Vercel dashboard
- Easy to rollback if needed

---

## Common Issues & Fixes

### Build Failed
→ Check Vercel logs for error  
→ Usually missing env variables

### Login Doesn't Work
→ Add NEXTAUTH_URL to env vars  
→ Configure Google OAuth callback URL

### Emails Don't Send
→ Add ANTHROPIC_API_KEY  
→ Check Gmail account connected

---

## Summary

1. ✅ Git init (done)
2. → Create GitHub repo
3. → Push code
4. → Create Vercel project
5. → Add env variables
6. → Redeploy
7. → Test live!

**You're ready to deploy!** 🚀
