-- ==============================================================================
-- ZCLIP STUDIO - COMPLETE DATABASE SCHEMA & STORED PROCEDURES
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. APP SETTINGS (Global configuration, concurrency, kill switches, and ledger rates)
CREATE TABLE IF NOT EXISTS public.app_settings (
    key text PRIMARY KEY,
    value text NOT NULL,
    description text,
    updated_at timestamptz DEFAULT now()
);

-- Seed default settings
INSERT INTO public.app_settings (key, value, description)
VALUES 
    ('kill_switch_render', 'false', 'Emergency pause for rendering pipeline'),
    ('kill_switch_ai', 'false', 'Force deterministic fallback instead of Gemini API'),
    ('max_concurrent_renders_global', '5', 'Maximum concurrent renders across all users'),
    ('max_concurrent_renders_per_user', '1', 'Maximum concurrent renders per single user'),
    ('credit_seconds_per_credit', '60', 'Seconds of footage per credit consumed'),
    ('credit_min_per_job', '1', 'Minimum credits required per edit job'),
    ('credit_ceiling_multiplier', '1.5', 'Multiplier on estimated credits to reserve as max ceiling')
ON CONFLICT (key) DO NOTHING;

-- 3. PROJECTS TABLE
CREATE TABLE IF NOT EXISTS public.projects (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title text DEFAULT 'Untitled Project',
    status text NOT NULL DEFAULT 'draft', -- draft, analysing, planning, rendering, ready, qa_failed, failed
    aspect_ratio text,
    purpose text,
    mood text,
    platform text,
    created_at timestamptz DEFAULT now(),
    expires_at timestamptz DEFAULT (now() + interval '24 hours')
);

-- 4. MEDIA ASSETS TABLE
CREATE TABLE IF NOT EXISTS public.media_assets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    object_key text NOT NULL,
    original_name text NOT NULL,
    duration_sec numeric NOT NULL,
    width int NOT NULL,
    height int NOT NULL,
    fps numeric NOT NULL,
    codec text NOT NULL,
    has_audio boolean NOT NULL DEFAULT true,
    size_bytes bigint NOT NULL,
    retention_expires_at timestamptz DEFAULT (now() + interval '24 hours'),
    created_at timestamptz DEFAULT now()
);

-- 5. EDIT PLANS TABLE
CREATE TABLE IF NOT EXISTS public.edit_plans (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    version int NOT NULL DEFAULT 1,
    source text NOT NULL, -- gemini, deterministic
    plan jsonb NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- 6. RENDER JOBS TABLE
CREATE TABLE IF NOT EXISTS public.render_jobs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    idempotency_key text UNIQUE NOT NULL,
    status text NOT NULL DEFAULT 'running', -- running, succeeded, failed
    failure_code text,
    runtime_ms bigint,
    output_object_key text,
    created_at timestamptz DEFAULT now(),
    finished_at timestamptz
);

-- 7. QUALITY REPORTS TABLE
CREATE TABLE IF NOT EXISTS public.quality_reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    render_job_id uuid NOT NULL REFERENCES public.render_jobs(id) ON DELETE CASCADE,
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    technical jsonb NOT NULL,
    defects jsonb NOT NULL DEFAULT '[]'::jsonb,
    corrections jsonb NOT NULL DEFAULT '[]'::jsonb,
    passed boolean NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- 8. CREDIT LEDGER & RESERVATIONS
CREATE TABLE IF NOT EXISTS public.user_credits (
    owner_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    balance int NOT NULL DEFAULT 100,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.credit_reservations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    idempotency_key text UNIQUE NOT NULL,
    amount int NOT NULL,
    meta jsonb,
    status text NOT NULL DEFAULT 'active', -- active, settled, released
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cost_ledger (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
    render_job_id uuid REFERENCES public.render_jobs(id) ON DELETE SET NULL,
    category text NOT NULL, -- ai, compute, storage
    provider text,
    estimated_usd numeric,
    detail jsonb,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.usage_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
    kind text NOT NULL,
    provider text,
    model text,
    tokens_in int,
    tokens_out int,
    estimated_cost_usd numeric,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.guardian_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    event_type text NOT NULL,
    severity text NOT NULL, -- info, warn, block
    evidence jsonb,
    created_at timestamptz DEFAULT now()
);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edit_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.render_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quality_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guardian_events ENABLE ROW LEVEL SECURITY;

-- Projects
CREATE POLICY "Users can manage own projects" ON public.projects
    FOR ALL USING (auth.uid() = owner_id);

-- Media Assets
CREATE POLICY "Users can manage own assets" ON public.media_assets
    FOR ALL USING (auth.uid() = owner_id);

-- Edit Plans
CREATE POLICY "Users can read own edit plans" ON public.edit_plans
    FOR SELECT USING (auth.uid() = owner_id);

-- Render Jobs
CREATE POLICY "Users can read own render jobs" ON public.render_jobs
    FOR SELECT USING (auth.uid() = owner_id);

-- User Credits
CREATE POLICY "Users can view own credits" ON public.user_credits
    FOR SELECT USING (auth.uid() = owner_id);

-- ==============================================================================
-- RPC STORED PROCEDURES
-- ==============================================================================

-- 1. start_render_job: Claims a render slot atomically and checks concurrency
CREATE OR REPLACE FUNCTION public.start_render_job(
    p_owner uuid,
    p_project uuid,
    p_key text,
    p_max_global int,
    p_max_user int
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_job_id uuid;
    v_running_global int;
    v_running_user int;
BEGIN
    -- Check duplicate idempotency
    SELECT id INTO v_job_id FROM public.render_jobs WHERE idempotency_key = p_key;
    IF v_job_id IS NOT NULL THEN
        RAISE EXCEPTION 'duplicate_job';
    END IF;

    -- Concurrency check: user level
    SELECT COUNT(*) INTO v_running_user 
    FROM public.render_jobs 
    WHERE owner_id = p_owner AND status = 'running';
    IF v_running_user >= p_max_user THEN
        RAISE EXCEPTION 'render_busy_user';
    END IF;

    -- Concurrency check: global level
    SELECT COUNT(*) INTO v_running_global 
    FROM public.render_jobs 
    WHERE status = 'running';
    IF v_running_global >= p_max_global THEN
        RAISE EXCEPTION 'render_busy_global';
    END IF;

    -- Insert new render job
    INSERT INTO public.render_jobs (project_id, owner_id, idempotency_key, status)
    VALUES (p_project, p_owner, p_key, 'running')
    RETURNING id INTO v_job_id;

    RETURN v_job_id;
END;
$$;

-- 2. credit_balance: Returns available user credits
CREATE OR REPLACE FUNCTION public.credit_balance(p_owner uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_bal int;
BEGIN
    SELECT balance INTO v_bal FROM public.user_credits WHERE owner_id = p_owner;
    IF v_bal IS NULL THEN
        -- Default initial credits for new users
        INSERT INTO public.user_credits (owner_id, balance) VALUES (p_owner, 100)
        ON CONFLICT (owner_id) DO NOTHING;
        v_bal := 100;
    END IF;
    RETURN v_bal;
END;
$$;

-- 3. reserve_credit: Atomically reserves credit ceiling up front
CREATE OR REPLACE FUNCTION public.reserve_credit(
    p_owner uuid,
    p_project uuid,
    p_key text,
    p_amount int,
    p_meta jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_res_id uuid;
    v_bal int;
BEGIN
    SELECT id INTO v_res_id FROM public.credit_reservations WHERE idempotency_key = p_key;
    IF v_res_id IS NOT NULL THEN
        RETURN v_res_id;
    END IF;

    v_bal := public.credit_balance(p_owner);
    IF v_bal < p_amount THEN
        RAISE EXCEPTION 'insufficient_credits';
    END IF;

    -- Deduct reserved amount from balance
    UPDATE public.user_credits 
    SET balance = balance - p_amount, updated_at = now() 
    WHERE owner_id = p_owner;

    INSERT INTO public.credit_reservations (owner_id, project_id, idempotency_key, amount, meta, status)
    VALUES (p_owner, p_project, p_key, p_amount, p_meta, 'active')
    RETURNING id INTO v_res_id;

    RETURN v_res_id;
END;
$$;

-- 4. settle_credit: Charges actual usage and refunds the remainder
CREATE OR REPLACE FUNCTION public.settle_credit(
    p_reservation uuid,
    p_actual int,
    p_meta jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_res public.credit_reservations%ROWTYPE;
    v_refund int;
BEGIN
    SELECT * INTO v_res FROM public.credit_reservations WHERE id = p_reservation AND status = 'active';
    IF NOT FOUND THEN
        RETURN;
    END IF;

    v_refund := v_res.amount - p_actual;
    IF v_refund > 0 THEN
        UPDATE public.user_credits 
        SET balance = balance + v_refund, updated_at = now()
        WHERE owner_id = v_res.owner_id;
    END IF;

    UPDATE public.credit_reservations
    SET status = 'settled', meta = COALESCE(meta, '{}'::jsonb) || p_meta, updated_at = now()
    WHERE id = p_reservation;
END;
$$;
