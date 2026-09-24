export interface PrivacySettings {
  showOnlineStatus: boolean;
  showLastSeen: boolean;
  showPhoto: boolean;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  username?: string;
  photoURL?: string;
  about?: string;
  publicKey?: string;
  isOnline?: boolean;
  lastSeen?: string;
  createdAt: string;
  updatedAt?: string;
  profileCompleted?: boolean;
  privacySettings?: PrivacySettings;
}

export interface PublicProfile {
  uid: string;
  displayName: string;
  username?: string;
  photoURL?: string;
  about?: string;
  publicKey?: string;
  isOnline?: boolean;
  lastSeen?: string;
  updatedAt?: string;
}

export interface EmailLookup {
  uid: string;
  email: string;
  displayName: string;
  username?: string;
  photoURL?: string;
  updatedAt?: string;
}

export interface FriendRequest {
  requestId: string;
  fromUid: string;
  toUid: string;
  fromDisplayName?: string;
  fromEmail?: string;
  fromPhotoURL?: string;
  toDisplayName?: string;
  toEmail?: string;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  createdAt: string;
  updatedAt?: string;
}

export interface Friendship {
  friendshipId: string;
  userA: string;
  userB: string;
  users: string[];
  createdAt: string;
}

export interface ConversationParticipant {
  displayName: string;
  photoURL?: string;
  publicKey?: string;
  lastReadAt?: string;
}

export interface LastMessageData {
  senderId: string;
  ciphertext: string;
  iv: string;
  createdAt: string;
  status: 'sending' | 'sent' | 'delivered' | 'read';
  messageType?: 'text' | 'image' | 'file';
}

export interface Conversation {
  conversationId: string;
  participantUids: string[];
  participantData?: Record<string, ConversationParticipant>;
  lastMessage?: LastMessageData;
  typing?: Record<string, boolean>;
  updatedAt: string;
  createdAt: string;
}

export interface Message {
  messageId: string;
  conversationId: string;
  senderId: string;
  recipientId: string;
  ciphertext: string;
  iv: string;
  status: 'sending' | 'sent' | 'delivered' | 'read';
  messageType?: 'text' | 'image' | 'file';
  createdAt: string;
  decryptedText?: string;
  decryptError?: boolean;
}

export interface BlockRecord {
  blockId: string;
  blockerUid: string;
  blockedUid: string;
  createdAt: string;
}
