-- Enable uuid-ossp extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 1. PROFILES TABLE
-- ==========================================
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Function to check if current user is admin without triggering RLS (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role FROM public.profiles WHERE id = auth.uid();
  RETURN user_role = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "Users can read own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- Admins can read all profiles
CREATE POLICY "Admins can read all profiles" ON public.profiles
  FOR SELECT USING (public.is_admin());

-- ==========================================
-- 2. LINKS TABLE
-- ==========================================
CREATE TABLE public.links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  target_url TEXT NOT NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  click_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for links
ALTER TABLE public.links ENABLE ROW LEVEL SECURITY;

-- Users can read their own links (or all if admin)
CREATE POLICY "Users can read own links" ON public.links
  FOR SELECT USING (auth.uid() = created_by OR public.is_admin());

-- Users can insert their own links
CREATE POLICY "Users can insert own links" ON public.links
  FOR INSERT WITH CHECK (auth.uid() = created_by);

-- Users can update their own links
CREATE POLICY "Users can update own links" ON public.links
  FOR UPDATE USING (auth.uid() = created_by);

-- Users can delete their own links
CREATE POLICY "Users can delete own links" ON public.links
  FOR DELETE USING (auth.uid() = created_by);

-- Admins can do anything to links
CREATE POLICY "Admins can manage all links" ON public.links
  FOR ALL USING (public.is_admin());

-- ==========================================
-- 3. TRIGGERS & FUNCTIONS
-- ==========================================

-- A. Validate domain before allowing signup
CREATE OR REPLACE FUNCTION public.check_email_domain()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email NOT LIKE '%@yuritechpp.co.id' THEN
    RAISE EXCEPTION 'Only @yuritechpp.co.id domain is allowed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to run before insert on auth.users
-- Note: This trigger requires superuser privileges to create on auth.users.
-- If running via Supabase SQL editor, it should work.
DROP TRIGGER IF EXISTS check_email_domain_trigger ON auth.users;
CREATE TRIGGER check_email_domain_trigger
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.check_email_domain();

-- B. Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (
    NEW.id,
    NEW.email,
    -- Make the first user an admin, or default to user
    'user'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- C. Auto-update links.updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_links_updated_at
  BEFORE UPDATE ON public.links
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- D. RPC for incrementing click count safely
CREATE OR REPLACE FUNCTION increment_click_count(row_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.links
  SET click_count = click_count + 1
  WHERE id = row_id;
END;
$$ LANGUAGE plpgsql;

