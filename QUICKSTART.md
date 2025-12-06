# Quick Start Guide

## Setup (5 minutes)

### 1. Install Dependencies
```bash
npm install
```

### 2. Setup Supabase

Follow the detailed guide in `SUPABASE_SETUP.md` or quick steps:

1. Create project at [supabase.com](https://supabase.com)
2. Run SQL from `supabase-schema.sql` in SQL Editor
3. Get your Project URL and anon key from Settings → API
4. Create `.env` file:

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxx...
```

### 3. Run the App
```bash
npm run dev
```

Open http://localhost:5173

## Features

✅ **Glassmorphism UI** - Modern, professional design  
✅ **Real-time Updates** - See new photos instantly  
✅ **Supabase Backend** - Scalable, secure database  
✅ **User Ownership** - Only delete your own photos  
✅ **Dark/Light Theme** - Toggle between themes  
✅ **Responsive Design** - Works on all devices  

## Usage

1. **Enter your name** when prompted (first time only)
2. **Upload photos** by clicking the upload area
3. **View gallery** with real-time updates
4. **Delete photos** (only your own) by hovering and clicking delete

## Architecture

- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Storage + Realtime)
- **Styling**: Glassmorphism design with backdrop-blur
- **State**: React hooks + Supabase subscriptions

## File Structure

```
m-collection/
├── src/
│   ├── lib/
│   │   └── supabase.ts          # Supabase client config
│   ├── App.tsx                  # Main application
│   ├── index.css                # Glassmorphism styles
│   └── main.tsx                 # Entry point
├── supabase-schema.sql          # Database schema
├── SUPABASE_SETUP.md            # Detailed setup guide
└── .env                         # Environment variables
```

## Deployment

### Vercel (Recommended)
```bash
npm run build
vercel --prod
```

Add environment variables in Vercel dashboard.

### Netlify
```bash
npm run build
netlify deploy --prod
```

Add environment variables in Netlify dashboard.

## Support

For issues or questions, check:
- `SUPABASE_SETUP.md` for setup help
- Supabase docs: https://supabase.com/docs
- Tailwind docs: https://tailwindcss.com/docs
