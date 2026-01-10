# Vercel Deployment Checklist

## Before Pushing to GitHub

Run these commands locally to catch errors before Vercel builds:

```bash
# 1. Type check (catches TypeScript errors)
npm run type-check

# 2. Lint (catches ESLint errors)
npm run lint

# 3. Full verification (runs both + build)
npm run verify
```

## Common Issues to Watch For

### TypeScript Errors
- ✅ All Supabase queries use type assertions (`as any` or explicit types)
- ✅ All hooks are called before early returns
- ✅ No conditional hook calls
- ✅ All apostrophes in JSX are escaped (`'` → `&apos;`)

### ESLint Errors
- ✅ No unused variables or imports
- ✅ All React hooks follow rules (no conditional calls)
- ✅ Proper dependency arrays in `useEffect` and `useCallback`

### Build Errors
- ✅ Environment variables are set in Vercel dashboard
- ✅ No missing dependencies
- ✅ All imports resolve correctly

## Pre-commit Hook (Optional)

To automatically run checks before commits, install husky:

```bash
npm install --save-dev husky lint-staged
npx husky install
npx husky add .husky/pre-commit "npm run lint && npm run type-check"
```

## CI/CD Integration

The `prebuild` script in `package.json` automatically runs lint and type-check before builds.

## Quick Verification

Before pushing, always run:
```bash
npm run verify
```

This ensures:
1. ✅ No linting errors
2. ✅ No TypeScript errors  
3. ✅ Build succeeds

If all pass, your Vercel deployment should succeed! 🎉

