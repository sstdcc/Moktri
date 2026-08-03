
-- FCM Integration V2 Final — enable chat message notifications.
--
-- Chat flows (ChatModal.tsx:151, ConversationPage.tsx:339,
-- RequestConversationPage.tsx:297) call
-- createNotificationService(supabase).create('new_message', peerId, { link: '/chat/<conversationId>' | '/request-chat/<conversationId>' }).
-- There was NO INSERT policy on public.notifications allowing a user to write a
-- 'new_message' row addressed to another user, so those inserts were denied by
-- RLS (42501) and no row was ever created — no trigger, no FCM push.
--
-- This policy permits the insert ONLY when the recipient is the other party of a
-- listing_conversations / request_conversations row that the caller is a member
-- of, and the notification link references that exact conversation.

CREATE POLICY "Chat parties can send new_message notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (
    type = 'new_message'
    AND user_id <> auth.uid()
    AND (
      EXISTS (
        SELECT 1 FROM public.listing_conversations lc
        WHERE lc.owner_id = auth.uid()
          AND lc.user_id = notifications.user_id
          AND notifications.link = '/chat/' || lc.id::text
      )
      OR EXISTS (
        SELECT 1 FROM public.listing_conversations lc
        WHERE lc.user_id = auth.uid()
          AND lc.owner_id = notifications.user_id
          AND notifications.link = '/chat/' || lc.id::text
      )
      OR EXISTS (
        SELECT 1 FROM public.request_conversations rc
        WHERE rc.requester_id = auth.uid()
          AND rc.responder_id = notifications.user_id
          AND notifications.link = '/request-chat/' || rc.id::text
      )
      OR EXISTS (
        SELECT 1 FROM public.request_conversations rc
        WHERE rc.responder_id = auth.uid()
          AND rc.requester_id = notifications.user_id
          AND notifications.link = '/request-chat/' || rc.id::text
      )
    )
  );
