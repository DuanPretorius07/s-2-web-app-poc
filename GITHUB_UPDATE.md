# GitHub Update Guide

## Steps to Update GitHub and Deploy to Vercel

### 1. Review Changes

Before pushing to GitHub, review all changes:

```bash
git status
git diff
```

### 2. Commit Changes

```bash
# Add all changes
git add .

# Commit with descriptive message
git commit -m "Fix GeoNames API reliability, improve UI, and update documentation

- Add retry logic with exponential backoff to GeoNames service
- Implement 7-day caching for location data
- Decrease background opacity to 0.3
- Fix notification z-index to appear above modals
- Remove 'Get New Quote' button
- Update SQL schema with camelCase column names
- Add comprehensive README documentation
- Create Vercel deployment guide"

# Push to GitHub
git push origin main
```

### 3. Verify GitHub Push

1. Go to your GitHub repository
2. Verify all files are pushed correctly
3. Check that `README.md`, `DEPLOYMENT.md`, and `server/supabase/schema.sql` are updated

### 4. Vercel Auto-Deployment

Vercel will automatically:
1. Detect the push to main branch
2. Run `npm run vercel-build`
3. Deploy to production

### 5. Monitor Deployment

1. Go to Vercel Dashboard
2. Check build logs for any errors
3. Verify deployment is successful
4. Test the deployed application

### 6. If Build Fails

If Vercel build fails:

1. **Check Build Logs**:
   - Go to Vercel Dashboard → Deployments
   - Click on failed deployment
   - Review error messages

2. **Common Issues**:
   - Missing environment variables → Add in Vercel settings
   - TypeScript errors → Fix locally and push again
   - Missing dependencies → Check `package.json` files

3. **Fix and Redeploy**:
   ```bash
   # Fix issues locally
   npm run build  # Test build locally
   
   # Commit fixes
   git add .
   git commit -m "Fix build errors"
   git push origin main
   ```

## Files Changed

### Core Application Files
- `server/src/services/geonames.ts` - Added retry logic and caching
- `client/src/components/AnimatedBackground.tsx` - Reduced opacity to 0.3
- `client/src/components/RateTokensUsedNotification.tsx` - Fixed z-index
- `client/src/components/QuoteForm.tsx` - Removed "Get New Quote" button
- `client/src/services/locationService.ts` - Already has retry logic (from previous update)

### Documentation Files
- `README.md` - Comprehensive update with all features
- `DEPLOYMENT.md` - Complete Vercel deployment guide
- `server/supabase/schema.sql` - Updated with camelCase columns and rate tokens

### Configuration Files
- `vercel.json` - Already configured correctly

## Pre-Deployment Checklist

Before pushing to GitHub:

- [ ] All code changes tested locally
- [ ] `npm run build` succeeds without errors
- [ ] `npm run dev` starts successfully
- [ ] Registration form works with password validation
- [ ] Location selector loads countries/states/cities
- [ ] Rate request flow works end-to-end
- [ ] SQL schema matches current implementation
- [ ] README.md is comprehensive and accurate
- [ ] DEPLOYMENT.md includes all deployment steps
- [ ] Environment variables documented

## Post-Deployment Verification

After Vercel deployment:

- [ ] Application loads at deployment URL
- [ ] Registration form displays password requirements
- [ ] Location selector loads data correctly
- [ ] Rate request completes successfully
- [ ] Notification appears above modal (not behind navbar)
- [ ] Background opacity is reduced
- [ ] No console errors in browser
- [ ] API endpoints respond correctly

## Rollback Plan

If deployment has issues:

1. **Revert Last Commit**:
   ```bash
   git revert HEAD
   git push origin main
   ```

2. **Or Promote Previous Deployment**:
   - Go to Vercel Dashboard
   - Find last successful deployment
   - Click "Promote to Production"

## Next Steps After Deployment

1. **Monitor Error Logs**: Check Vercel function logs for any errors
2. **Test User Flows**: Verify all user journeys work correctly
3. **Performance Check**: Monitor API response times
4. **User Feedback**: Gather feedback on new features

## Notes

- Background opacity is set to 0.3 in `AnimatedBackground.tsx` (line 83)
- Notification z-index is 9999 in `RateTokensUsedNotification.tsx` (line 34)
- GeoNames retry logic: 3 attempts with exponential backoff (1s, 2s, 4s)
- Cache TTL: 7 days for all location data
- SQL schema uses camelCase: `firstname`, `lastname` (not `first_name`, `last_name`)
