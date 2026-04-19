-- Add 'completed' value to request_status enum
ALTER TYPE public.request_status ADD VALUE IF NOT EXISTS 'completed';