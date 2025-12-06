# Supabase Setup Guide

## 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Sign up / Login
3. Click "New Project"
4. Fill in project details:
   - Name: `m-onew-gallery`
   - Database Password: (save this!)
   - Region: Choose closest to you
5. Wait for project to be created (~2 minutes)

## 2. Run SQL Schema

1. In your Supabase dashboard, go to **SQL Editor**
2. Click "New Query"
3. Copy and paste the entire content from `supabase-schema.sql`
4. Click "Run" or press `Ctrl+Enter`
5. Wait for success message

## 3. Get API Keys

1. Go to **Settings** → **API**
2. Copy these values:
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **anon public** key (long string starting with `eyJ...`)

## 4. Configure Environment Variables

1. Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

2. Replace with your actual values from step 3

## 5. Enable Realtime

1. Go to **Database** → **Replication**
2. Find the `images` table
3. Toggle "Realtime" to **ON**
4. Click "Save"

## 6. Verify Storage Bucket

1. Go to **Storage**
2. You should see `gallery-images` bucket
3. If not, create it manually:
   - Click "New bucket"
   - Name: `gallery-images`
   - Public: **Yes**
   - Click "Create bucket"

## 7. Test the Application

1. Install dependencies:
```bash
npm install
```

2. Start the dev server:
```bash
npm run dev
```

3. Open browser and test:
   - Upload an image
   - Check if it appears in Supabase Storage
   - Check if it appears in the images table
   - Open another browser tab and see if it updates in realtime

## Troubleshooting

### Images not uploading
- Check if storage bucket exists and is public
- Check if RLS policies are enabled
- Check browser console for errors

### Realtime not working
- Make sure Realtime is enabled for `images` table
- Check if you're subscribed to the correct channel
- Check browser console for WebSocket errors

### Can't delete images
- Make sure you're using the same name you uploaded with
- Check if RLS policies allow deletion

## Security Notes

- The `anon` key is safe to use in frontend (it's public)
- RLS policies protect your data
- Users can only delete their own images
- Storage is organized by uploader name

## Next Steps

- Add user authentication (optional)
- Add image optimization
- Add pagination for large galleries
- Add search/filter functionality
