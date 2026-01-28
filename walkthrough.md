
# HR Requests and Management Migration to Supabase

## Overview
Successfully migrated the HR documents request (user) and management (admin) pages from Firebase to Supabase. Also included `point_history` and `email_templates` in the migration and sync configuration to ensure a complete transition to Supabase. This document outlines the changes made and the necessary steps to complete the migration.

## Key Changes

### 1. Database Schema
- Added `hr_documents` table to store HR request data (vacation, resignation, leave of absence).
- Added `email_templates` table to store email templates.
- Added `point_history` table for tracking customer point changes.
- Enabled Row Level Security (RLS) policies for all new tables.
- **Action Required:** Execute the SQL statements in `create_missing_tables.sql` in the Supabase SQL Editor if not already done.

### 2. User Interface Updates
- **New HR Request Page (`src/app/dashboard/hr/requests/new/page.tsx`)**:
  - Validated and updated to use Supabase client for submitting new requests.
  - Removed Firebase dependencies.
- **HR Management Page (`src/app/dashboard/hr/management/page.tsx`)**:
  - Replaced Firebase Firestore listeners with Supabase Realtime subscriptions.
  - Updated actions (Update Status, Delete) to use Supabase API.
  - Updated file deletion logic to target Supabase Storage (requires `hr_submissions` bucket setup).

### 3. Data Synchronization (`src/lib/firebase-sync.ts`)
- Updated the sync configuration to include:
  - `hr_documents` (Internal HR requests)
  - `point_history` (Customer point transactions)
  - `email_templates` (System email templates)
- Added field mappings to correctly transform Firebase camelCase fields to Supabase snake_case columns.

## Verification Steps
1. **Database Setup**: Ensure `hr_documents`, `point_history`, and `email_templates` tables exist in Supabase.
2. **Data Sync**: Go to **Settings > Data Sync** and click **Start Sync**. Verify that data from Firebase populates the new Supabase tables.
3. **Application Testing**:
   - **User**: Submit a new HR request. Confirm it appears in the list.
   - **Admin**: Go to HR Management. Verify the new request appears. Change its status (Approve/Reject) and delete it. Confirm changes persist.
