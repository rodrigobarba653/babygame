# How to Debug Server Errors

## Method 1: Check Vercel Logs (Easiest)

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click on your project
3. Go to **Deployments** tab
4. Click on the latest deployment
5. Click on **Functions** tab or scroll to **Runtime Logs**
6. Look for red error messages - they'll show the full stack trace

## Method 2: Check Vercel Dashboard Logs

1. Go to your Vercel project dashboard
2. Click on **Logs** in the left sidebar
3. Select the latest deployment
4. Filter by "Error" to see only errors
5. Click on any error to see full details

## Method 3: Run Locally (See Full Error Messages)

1. Create a `.env.local` file in the project root:
```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

2. Install dependencies (if not already done):
```bash
npm install
```

3. Run development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000)
5. Errors will show full stack traces in the browser and terminal

## Method 4: Check Browser Network Tab

1. Open your deployed app in browser
2. Open Developer Tools (F12 or Cmd+Option+I)
3. Go to **Network** tab
4. Refresh the page
5. Look for failed requests (red status codes)
6. Click on the failed request
7. Check the **Response** tab - sometimes error details are there

## Method 5: Add Console Logging (Temporary)

The error page now shows more details. If you need even more debugging:

1. Check the browser console for client-side errors
2. Server-side `console.error()` calls appear in Vercel logs
3. Check the error digest code in the error message - it's a unique identifier for that specific error

## Common Issues

- **Missing environment variables**: Make sure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set in Vercel
- **Supabase connection errors**: Check your Supabase project is active and the URL/key are correct
- **Database RLS policies**: Errors might be related to Row Level Security policies in Supabase
