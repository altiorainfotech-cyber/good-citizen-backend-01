# Vercel Deployment Guide

## ✅ What's Been Fixed

Your NestJS application is now configured for Vercel serverless deployment:

1. **`vercel.json`** - Configures Vercel build and routing
2. **`api/index.ts`** - Serverless function entry point
3. **`.vercelignore`** - Excludes unnecessary files from deployment
4. **`package.json`** - Added `vercel-build` script

## 🚀 How to Deploy

### Option 1: Deploy via Vercel CLI

```bash
# Install Vercel CLI (if not installed)
npm i -g vercel

# Deploy to Vercel
vercel

# Deploy to production
vercel --prod
```

### Option 2: Deploy via GitHub

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Click "Import Project"
4. Select your GitHub repository
5. Vercel will auto-detect the configuration and deploy

## ⚙️ Environment Variables

Make sure to add these environment variables in Vercel Dashboard:

- `NODE_ENV=production`
- `DATABASE_URL` - Your MongoDB connection string
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `AUTH0_DOMAIN`
- `AUTH0_CLIENT_ID`
- `AUTH0_CLIENT_SECRET`
- `GOOGLE_API_KEY`
- `PROJECT_ID` (Firebase)
- `CLIENT_EMAIL` (Firebase)
- `PRIVATE_KEY` (Firebase)

**Go to:** Project Settings → Environment Variables

## ⚠️ Important Limitations

### Features that WON'T work on Vercel:

1. **WebSockets** - Your Socket.io implementation won't work
   - **Solution:** Use external service (Pusher, Ably) or deploy WebSocket server separately

2. **Scheduled Tasks** - `@nestjs/schedule` won't work
   - **Solution:** Use Vercel Cron (add to vercel.json) or external scheduler

3. **In-Memory Caching** - State doesn't persist between requests
   - **Solution:** You already use Redis, which is perfect

4. **File Uploads** - Files uploaded won't persist
   - **Solution:** You already use AWS S3, which is correct

5. **Timeouts** - Functions must complete within 10 seconds
   - Long-running operations will fail

## 🔧 Recommended Architecture

For your app with WebSockets and scheduled tasks:

### Hybrid Approach (RECOMMENDED):

```
┌─────────────────────────────────────┐
│  Vercel (API Routes)               │
│  - REST endpoints                   │
│  - HTTP requests                    │
└─────────────────────────────────────┘
           │
           ├── Redis (Upstash) - Shared state
           │
┌─────────────────────────────────────┐
│  Railway/Render (WebSocket Server)  │
│  - Socket.io real-time features    │
│  - Background jobs                  │
│  - Scheduled tasks                  │
└─────────────────────────────────────┘
```

### Alternative: Use Railway/Render Only

Your app would work perfectly on Railway/Render with zero code changes:

- **Railway:** [railway.app](https://railway.app)
- **Render:** [render.com](https://render.com)
- **Fly.io:** [fly.io](https://fly.io)

Cost: ~$5/month for small apps

## 🧪 Test Locally

```bash
# Test locally with Vercel dev server
npm run serve

# Or use vercel dev
vercel dev
```

## 📝 Next Steps

1. **Deploy to Vercel** - Try the deployment
2. **Test HTTP endpoints** - They should work
3. **Plan for WebSockets** - Decide on hybrid or alternative hosting
4. **Monitor cold starts** - First request may be slow (1-2s)

## 🆘 If Issues Occur

1. Check Vercel deployment logs
2. Verify environment variables are set
3. Check function timeout (10s limit)
4. Ensure database is accessible from Vercel IPs

---

**Note:** If you need WebSocket support immediately, consider deploying to Railway/Render instead where your current code will work without modifications.
