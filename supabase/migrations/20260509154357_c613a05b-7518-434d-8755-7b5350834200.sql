
-- Dedicated conversations for housing-request responses
CREATE TABLE IF NOT EXISTS public.request_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL,
  requester_id uuid NOT NULL,
  responder_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (request_id, requester_id, responder_id)
);

CREATE INDEX IF NOT EXISTS idx_request_conversations_requester ON public.request_conversations(requester_id);
CREATE INDEX IF NOT EXISTS idx_request_conversations_responder ON public.request_conversations(responder_id);
CREATE INDEX IF NOT EXISTS idx_request_conversations_request ON public.request_conversations(request_id);

ALTER TABLE public.request_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parties can view their request conversations"
  ON public.request_conversations FOR SELECT
  TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = responder_id);

CREATE POLICY "Parties can create their request conversations"
  ON public.request_conversations FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.uid() = requester_id OR auth.uid() = responder_id)
    AND requester_id <> responder_id
    AND EXISTS (
      SELECT 1 FROM public.housing_requests hr
      WHERE hr.id = request_id AND hr.requester_id = request_conversations.requester_id
    )
  );

-- Messages inside a request conversation
CREATE TABLE IF NOT EXISTS public.request_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.request_conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_request_messages_conv ON public.request_messages(conversation_id, created_at);

ALTER TABLE public.request_messages ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_request_conversation_member(_user_id uuid, _conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.request_conversations
    WHERE id = _conversation_id
      AND (requester_id = _user_id OR responder_id = _user_id)
  );
$$;

CREATE POLICY "Members can view request messages"
  ON public.request_messages FOR SELECT
  TO authenticated
  USING (public.is_request_conversation_member(auth.uid(), conversation_id));

CREATE POLICY "Members can send request messages"
  ON public.request_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND public.is_request_conversation_member(auth.uid(), conversation_id)
  );

CREATE POLICY "Members can mark request messages read"
  ON public.request_messages FOR UPDATE
  TO authenticated
  USING (public.is_request_conversation_member(auth.uid(), conversation_id))
  WITH CHECK (public.is_request_conversation_member(auth.uid(), conversation_id));

ALTER PUBLICATION supabase_realtime ADD TABLE public.request_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.request_conversations;
