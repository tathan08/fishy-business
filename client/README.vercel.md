# Vercel Deployment Guide for Fishy Business Client

## Quick Start

1. **Install Vercel CLI** (optional, for local testing):
   ```bash
   npm i -g vercel
   ```

2. **Configure Environment Variables**:
   - Copy `.env.example` to `.env.local` for local development
   - Set `NEXT_PUBLIC_WS_SERVER_URL` to your Fly.io server URL (e.g., `wss://your-app.fly.dev`)

3. **Deploy to Vercel**:

   ### Option A: Using Vercel Dashboard (Recommended)
   1. Go to [vercel.com](https://vercel.com)
   2. Click "Add New Project"
   3. Import your GitHub repository `tathan08/fishy-business`
   4. Set the **Root Directory** to `client`
   5. Add environment variable:
      - Key: `NEXT_PUBLIC_WS_SERVER_URL`
      - Value: Your Fly.io WebSocket server URL (e.g., `wss://your-app.fly.dev`)
   6. Click "Deploy"

   ### Option B: Using Vercel CLI
   ```bash
   cd client
   vercel
   ```
   Follow the prompts and set the environment variable when asked.

## Environment Variables

### Required Variables
- `NEXT_PUBLIC_WS_SERVER_URL`: WebSocket server URL for game connection
  - Format: `wss://your-server.fly.dev`
  - Must start with `wss://` for secure WebSocket connection
  - Get this from your Fly.io server deployment

## Post-Deployment

After deployment:
1. Note your Vercel URL (e.g., `https://fishy-business.vercel.app`)
2. Test the connection to your WebSocket server
3. Update your server's CORS settings if needed to allow connections from your Vercel domain

## Troubleshooting

- **WebSocket Connection Failed**: Ensure your `NEXT_PUBLIC_WS_SERVER_URL` is correct and the server is running
- **Build Errors**: Check the Vercel build logs for specific errors
- **Environment Variables**: Remember that `NEXT_PUBLIC_*` variables are embedded at build time, so redeploy after changing them

## Local Development

```bash
npm install
npm run dev
```

The app will be available at `http://localhost:3000`
