/*
  # Create Core Database Schema

  ## Overview
  Creates the foundational tables for the capital matching dashboard including users,
  deals, opportunities, participants, and documents with proper relationships and security.

  ## New Tables

  ### `users`
  - `id` (uuid, primary key) - Unique user identifier
  - `email` (text, unique, required) - User email address
  - `full_name` (text) - User's full name
  - `role` (text, default 'user') - User role for access control
  - `created_at` (timestamptz) - Record creation timestamp
  - `updated_at` (timestamptz) - Record last update timestamp

  ### `deals`
  - `id` (uuid, primary key) - Unique deal identifier
  - `address` (text, required) - Property address
  - `deal_type` (text, required) - Type of deal (e.g., acquisition, development)
  - `purchase_price` (numeric) - Purchase price of the property
  - `estimated_value` (numeric) - Estimated value of the property
  - `status` (text, default 'active') - Deal status
  - `created_by` (uuid, foreign key → users.id) - User who created the deal
  - `created_at` (timestamptz) - Record creation timestamp
  - `updated_at` (timestamptz) - Record last update timestamp

  ### `opportunities`
  - `id` (uuid, primary key) - Unique opportunity identifier
  - `deal_id` (uuid, foreign key → deals.id) - Associated deal
  - `title` (text, required) - Opportunity title
  - `description` (text) - Detailed description
  - `funding_needed` (numeric) - Amount of funding needed
  - `status` (text, default 'open') - Opportunity status
  - `created_by` (uuid, foreign key → users.id) - User who created the opportunity
  - `created_at` (timestamptz) - Record creation timestamp
  - `updated_at` (timestamptz) - Record last update timestamp

  ### `participants`
  - `id` (uuid, primary key) - Unique participant identifier
  - `opportunity_id` (uuid, foreign key → opportunities.id) - Associated opportunity
  - `name` (text, required) - Participant name
  - `email` (text, required) - Participant email
  - `role` (text, required) - Participant role (e.g., investor, advisor)
  - `created_at` (timestamptz) - Record creation timestamp
  - `updated_at` (timestamptz) - Record last update timestamp

  ### `documents`
  - `id` (uuid, primary key) - Unique document identifier
  - `deal_id` (uuid, foreign key → deals.id, nullable) - Associated deal
  - `opportunity_id` (uuid, foreign key → opportunities.id, nullable) - Associated opportunity
  - `document_name` (text, required) - Name of the document
  - `document_type` (text) - Type/category of document
  - `file_url` (text) - Storage URL for the document
  - `status` (text, default 'pending') - Document review status
  - `uploaded_by` (uuid, foreign key → users.id) - User who uploaded the document
  - `created_at` (timestamptz) - Record creation timestamp
  - `updated_at` (timestamptz) - Record last update timestamp

  ## Security
  - Row Level Security (RLS) enabled on all tables
  - Authenticated users can read all records
  - Users can create new records
  - Users can update their own records
  - Users can delete their own records

  ## Indexes
  - Index on deals.status for filtering
  - Index on deals.created_at for sorting
  - Index on opportunities.deal_id for joins
  - Index on participants.opportunity_id for joins
  - Index on documents.deal_id and documents.opportunity_id for joins

  ## Notes
  - All tables use UUID for primary keys
  - Foreign keys use CASCADE on delete to maintain referential integrity
  - Timestamps are automatically managed
  - Default values ensure data consistency
*/

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  full_name text,
  role text DEFAULT 'user',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create deals table
CREATE TABLE IF NOT EXISTS deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  address text NOT NULL,
  deal_type text NOT NULL,
  purchase_price numeric,
  estimated_value numeric,
  status text DEFAULT 'active',
  created_by uuid REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create opportunities table
CREATE TABLE IF NOT EXISTS opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid REFERENCES deals(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text,
  funding_needed numeric,
  status text DEFAULT 'open',
  created_by uuid REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create participants table
CREATE TABLE IF NOT EXISTS participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid REFERENCES opportunities(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  email text NOT NULL,
  role text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create documents table
CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid REFERENCES deals(id) ON DELETE CASCADE,
  opportunity_id uuid REFERENCES opportunities(id) ON DELETE CASCADE,
  document_name text NOT NULL,
  document_type text,
  file_url text,
  status text DEFAULT 'pending',
  uploaded_by uuid REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_deals_status ON deals(status);
CREATE INDEX IF NOT EXISTS idx_deals_created_at ON deals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_opportunities_deal_id ON opportunities(deal_id);
CREATE INDEX IF NOT EXISTS idx_participants_opportunity_id ON participants(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_documents_deal_id ON documents(deal_id);
CREATE INDEX IF NOT EXISTS idx_documents_opportunity_id ON documents(opportunity_id);

-- Enable Row Level Security on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Users can view all users"
  ON users FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- RLS Policies for deals table
CREATE POLICY "Authenticated users can view deals"
  ON deals FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create deals"
  ON deals FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own deals"
  ON deals FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can delete own deals"
  ON deals FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

-- RLS Policies for opportunities table
CREATE POLICY "Authenticated users can view opportunities"
  ON opportunities FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create opportunities"
  ON opportunities FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own opportunities"
  ON opportunities FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can delete own opportunities"
  ON opportunities FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

-- RLS Policies for participants table
CREATE POLICY "Authenticated users can view participants"
  ON participants FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create participants"
  ON participants FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM opportunities
      WHERE opportunities.id = opportunity_id
      AND opportunities.created_by = auth.uid()
    )
  );

CREATE POLICY "Opportunity owners can update participants"
  ON participants FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM opportunities
      WHERE opportunities.id = opportunity_id
      AND opportunities.created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM opportunities
      WHERE opportunities.id = opportunity_id
      AND opportunities.created_by = auth.uid()
    )
  );

CREATE POLICY "Opportunity owners can delete participants"
  ON participants FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM opportunities
      WHERE opportunities.id = opportunity_id
      AND opportunities.created_by = auth.uid()
    )
  );

-- RLS Policies for documents table
CREATE POLICY "Authenticated users can view documents"
  ON documents FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can upload documents"
  ON documents FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Users can update own documents"
  ON documents FOR UPDATE
  TO authenticated
  USING (auth.uid() = uploaded_by)
  WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Users can delete own documents"
  ON documents FOR DELETE
  TO authenticated
  USING (auth.uid() = uploaded_by);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic updated_at management
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_deals_updated_at
  BEFORE UPDATE ON deals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_opportunities_updated_at
  BEFORE UPDATE ON opportunities
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_participants_updated_at
  BEFORE UPDATE ON participants
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();