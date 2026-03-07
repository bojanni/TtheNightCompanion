# Prompt Versioning Guide

This guide explains how prompt version control works in NightCafe Companion.

## Automatic Version Tracking

Every time you create or edit a prompt, a new version is saved automatically.
You can always return to older versions without losing your latest work.

## Core Features

- View full prompt history with timestamps and change descriptions.
- Restore any previous version safely.
- Compare changes between historical and current content.
- Edit with confidence because all changes are tracked.

## How It Works

1. Create or edit a prompt.
The app stores a new version record automatically.

2. Open version history.
Go to the Prompts page, hover a prompt card, and click the clock icon.

3. Review, compare, and restore.
Browse versions, inspect differences, and restore when needed.

## Schema Reference

```sql
CREATE TABLE prompt_versions (
  id uuid PRIMARY KEY,
  prompt_id uuid REFERENCES prompts(id),
  content text NOT NULL,
  version_number integer NOT NULL,
  change_description text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(prompt_id, version_number)
);

-- Automatic triggers ensure versions are created
-- whenever prompts are created or updated
```

## Best Practices

- Make meaningful edits between saves so history stays useful.
- Compare before restoring so you verify exactly what will change.
- Review history regularly to track prompt evolution over time.
- Remember that restoring creates a new version entry.
