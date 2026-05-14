export interface ChatMessage {
  id: string;
  channelId: string;
  senderId: string;
  text: string;
  createdAt: string;
  editedAt: string | null;
  sender: {
    id: string;
    displayName: string;
    slug: string;
    avatarUrl: string | null;
    isVerifiedBadge: boolean;
  };
}

export interface ChatHistoryEnvelope {
  data: ChatMessage[];
  meta: { hasMore: boolean };
}

export interface AckResponse {
  ok: boolean;
  code?: string;
  message?: ChatMessage;
}
