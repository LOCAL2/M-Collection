-- ===================================
-- M-Onew Gallery - Supabase Schema
-- ===================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===================================
-- Tables
-- ===================================

-- Images table
CREATE TABLE IF NOT EXISTS images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  url TEXT NOT NULL,
  uploader_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  uploader_name TEXT,
  file_size INTEGER,
  mime_type TEXT,
  width INTEGER,
  height INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===================================
-- Indexes
-- ===================================

CREATE INDEX IF NOT EXISTS idx_images_created_at ON images(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_images_uploader_id ON images(uploader_id);

-- ===================================
-- Row Level Security (RLS)
-- ===================================

-- Enable RLS
ALTER TABLE images ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can view images
CREATE POLICY "Anyone can view images"
  ON images
  FOR SELECT
  USING (true);

-- Policy: Authenticated users can upload images
CREATE POLICY "Authenticated users can upload images"
  ON images
  FOR INSERT
  WITH CHECK (auth.uid() = uploader_id);

-- Policy: Users can only delete their own images
CREATE POLICY "Users can delete their own images"
  ON images
  FOR DELETE
  USING (auth.uid() = uploader_id);

-- Policy: Users can update their own images
CREATE POLICY "Users can update their own images"
  ON images
  FOR UPDATE
  USING (auth.uid() = uploader_id);

-- ===================================
-- Storage Bucket
-- ===================================

-- Create storage bucket for images
INSERT INTO storage.buckets (id, name, public)
VALUES ('gallery-images', 'gallery-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Anyone can view images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'gallery-images');

CREATE POLICY "Authenticated users can upload images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'gallery-images' 
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Users can delete their own images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'gallery-images' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ===================================
-- Functions
-- ===================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_images_updated_at
  BEFORE UPDATE ON images
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ===================================
-- Enable Realtime (Run this AFTER tables are created)
-- ===================================

-- Enable Realtime for images table
ALTER PUBLICATION supabase_realtime ADD TABLE images;

-- ===================================
-- Sample Data (Optional)
-- ===================================

-- You can add sample data here if needed
-- INSERT INTO images (filename, storage_path, url, uploader_name) 
-- VALUES ('sample.jpg', 'public/sample.jpg', 'https://...', 'Admin');
