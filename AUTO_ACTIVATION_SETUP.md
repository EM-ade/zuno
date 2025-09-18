# Auto-Activation System Setup

This system automatically activates NFT collections when their scheduled mint date/time arrives.

## How It Works

1. **Collections start as "draft"** when created by users
2. **Users set mint phases** with start dates/times
3. **Auto-activation system** checks every 5 minutes for collections whose earliest phase start time has passed
4. **Collections automatically transition** from "draft" to "active" status
5. **Users see collections** appear as "live" in Featured Mints and marketplace

## Components

### 1. Auto-Activation API (`/api/collections/auto-activate`)
- Checks all draft collections
- Compares phase start times with current time
- Updates collection status to "active" when time arrives
- Returns summary of activated collections

### 2. Client-Side Checker (`AutoActivationChecker.tsx`)
- Runs in browser when users visit the site
- Checks every 10 minutes (with 5-minute cooldown)
- Provides immediate activation for active users

### 3. Server-Side Cron Jobs
Multiple options for reliable server-side scheduling:

#### Option A: Vercel Cron Jobs (Recommended for Vercel deployments)
- Configured in `vercel.json`
- Runs every 5 minutes automatically
- No additional setup required

#### Option B: GitHub Actions
- Configured in `.github/workflows/auto-activate.yml`
- Runs every 5 minutes via GitHub's servers
- Requires setting `NEXT_PUBLIC_BASE_URL` secret

#### Option C: External Cron Services
- Use services like cron-job.org, EasyCron, etc.
- Point to: `https://your-domain.com/api/collections/auto-activate`
- Schedule: Every 5 minutes (`*/5 * * * *`)

#### Option D: System Cron Job
- Use the provided script: `scripts/auto-activate-cron.js`
- Add to system crontab: `*/5 * * * * node /path/to/auto-activate-cron.js`

## Setup Instructions

### For Vercel Deployment:
1. Deploy your app to Vercel
2. The `vercel.json` file will automatically set up cron jobs
3. No additional configuration needed!

### For Other Deployments:
1. Choose one of the cron job options above
2. Set up the scheduled task to call `/api/collections/auto-activate`
3. Test with `/api/collections/test-auto-activate`

### Environment Variables:
```bash
NEXT_PUBLIC_BASE_URL=https://your-domain.com
```

## Testing

### Manual Test:
Visit: `https://your-domain.com/api/collections/test-auto-activate`

### Check Logs:
- Browser console will show auto-activation results
- Server logs will show activated collections

### Create Test Collection:
1. Create a collection with draft status
2. Add a mint phase with start time in the past
3. Wait 5-10 minutes or trigger manually
4. Collection should automatically become "active"

## Monitoring

### Success Indicators:
- Collections transition from "upcoming" to "live" in Featured Mints
- Marketplace shows correct status badges
- Console logs show activation messages

### Troubleshooting:
- Check browser console for client-side errors
- Check server logs for API errors
- Verify cron job is running (check external service logs)
- Test manually with `/api/collections/test-auto-activate`

## Security Notes

- API endpoints are public but safe (read-only operations)
- No authentication required for auto-activation
- Rate limiting handled by client-side cooldowns
- Server-side cron jobs should use HTTPS

## Customization

### Change Check Frequency:
- Client-side: Modify interval in `AutoActivationChecker.tsx`
- Server-side: Update cron schedule in chosen method

### Add Notifications:
- Extend API to send emails/webhooks when collections activate
- Add Discord/Slack notifications for creators

### Advanced Scheduling:
- Add timezone support for creators
- Allow custom activation rules beyond phase start times
- Add preview/staging modes before going live

## Status Flow

```
Draft Collection Created
         ↓
   Mint Phases Added
         ↓
    Auto-Activation
    Checks Every 5min
         ↓
   Phase Start Time
      Reached?
         ↓
   Collection Status
   Updated to "Active"
         ↓
   Appears as "Live"
   in UI Components
```

This system ensures collections automatically go live at their scheduled times without manual intervention!
