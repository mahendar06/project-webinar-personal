-- Migration 016: Add storage_path to recordings table
ALTER TABLE recordings ADD COLUMN IF NOT EXISTS storage_path TEXT;
