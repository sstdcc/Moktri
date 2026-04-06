
-- Create listing_conversations table
CREATE TABLE public.listing_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(listing_id, user_id)
);

ALTER TABLE public.listing_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own conversations"
  ON public.listing_conversations FOR SELECT
  USING (auth.uid() = owner_id OR auth.uid() = user_id);

CREATE POLICY "Users can create conversations"
  ON public.listing_conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create listing_messages table
CREATE TABLE public.listing_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.listing_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.listing_messages ENABLE ROW LEVEL SECURITY;

-- Security definer function to check conversation membership
CREATE OR REPLACE FUNCTION public.is_conversation_member(_user_id UUID, _conversation_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.listing_conversations
    WHERE id = _conversation_id
      AND (owner_id = _user_id OR user_id = _user_id)
  );
$$;

CREATE POLICY "Users can view messages in own conversations"
  ON public.listing_messages FOR SELECT
  USING (public.is_conversation_member(auth.uid(), conversation_id));

CREATE POLICY "Users can send messages in own conversations"
  ON public.listing_messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND public.is_conversation_member(auth.uid(), conversation_id)
  );

CREATE POLICY "Users can mark messages as read"
  ON public.listing_messages FOR UPDATE
  USING (public.is_conversation_member(auth.uid(), conversation_id))
  WITH CHECK (public.is_conversation_member(auth.uid(), conversation_id));

-- Add notification type 'new_message' if not exists
-- Since notification_type is an enum, we need to add the new value
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'new_message';

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.listing_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.listing_messages;

-- Index for performance
CREATE INDEX idx_listing_messages_conversation ON public.listing_messages(conversation_id, created_at);
CREATE INDEX idx_listing_conversations_owner ON public.listing_conversations(owner_id);
CREATE INDEX idx_listing_conversations_user ON public.listing_conversations(user_id);
