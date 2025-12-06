-- ===================================
-- STEP 2: Enable RLS Policies
-- ===================================

-- Enable RLS
ALTER TABLE images ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Anyone can view images" ON images;
DROP POLICY IF EXISTS "Authenticated users can upload images" ON images;
DROP POLICY IF EXISTS "Users can delete their own images" ON images;
DROP POLICY IF EXISTS "Users can update their own images" ON images;

-- Policy: Anyone can view images
CREATE POLICY "Anyone can view images"
  ON images
  FOR SELECT
  USING (true);

-- Policy: Anyone can upload images (no auth required)
CREATE POLICY "Anyone can upload images"
  ON images
  FOR INSERT
  WITH CHECK (true);

-- Policy: Anyone can delete images (we'll handle this in app logic)
CREATE POLICY "Anyone can delete images"
  ON images
  FOR DELETE
  USING (true);

-- Policy: Anyone can update images
CREATE POLICY "Anyone can update images"
  ON images
  FOR UPDATE
  USING (true);
