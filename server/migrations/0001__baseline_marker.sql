-- Baseline migration marker for NightCompanion.
--
-- This migration intentionally does not create/alter schema.
-- It establishes the versioned migration pipeline so future
-- schema changes can be added as incremental SQL files.

SELECT 1;
