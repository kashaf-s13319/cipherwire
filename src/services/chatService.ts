import {
  collection,
  doc,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  getDoc,
  limit,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase/config';
import { Conversation, Message, PublicProfile } from '../types';
import {
  getOrGenerateUserKeyPair,
  getSharedSecretKey,
  encryptPayload,
  decryptPayload,
} from '../crypto/e2ee';
import { getPublicProfile } from './userService';

/**
 * Subscribes to the current user's active conversations in real-time.
 */
export function subscribeToConversations(
  currentUid: string,
  callback: (conversations: Conversation[]) => void
): () => void {
  const path = 'conversations';
  // Note: we filter conversations where current user is a participant
  const q = query(
    collection(db, 'conversations'),
    where('participantUids', 'array-contains', currentUid),
    limit(50)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const convs = snapshot.docs.map((docSnap) => docSnap.data() as Conversation);
      // Sort in-memory by updatedAt descending
      convs.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      callback(convs);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

/**
 * Subscribes to real-time messages in a conversation and decrypts them client-side.
 */
export function subscribeToMessages(
  conversationId: string,
  currentUid: string,
  peerPublicKey: string | null,
  callback: (messages: Message[]) => void
): () => void {
  const path = `conversations/${conversationId}/messages`;
  const q = query(
    collection(db, 'conversations', conversationId, 'messages'),
    orderBy('createdAt', 'asc'),
    limit(100)
  );

  return onSnapshot(
    q,
    async (snapshot) => {
      const rawMessages = snapshot.docs.map((docSnap) => docSnap.data() as Message);

      // Decrypt messages client-side
      const decryptedList = await Promise.all(
        rawMessages.map(async (msg) => {
          if (msg.decryptedText) {
            return msg;
          }

          try {
            // Need our private key and the peer's public key
            const { privateKey } = await getOrGenerateUserKeyPair(currentUid);
            let effectivePeerPubKey = peerPublicKey;

            if (!effectivePeerPubKey) {
              const peerUid = msg.senderId === currentUid ? msg.recipientId : msg.senderId;
              const peerProfile = await getPublicProfile(peerUid);
              effectivePeerPubKey = peerProfile?.publicKey || null;
            }

            if (!effectivePeerPubKey) {
              return {
                ...msg,
                decryptedText: '[Encrypted message: Waiting for peer public key]',
                decryptError: true,
              };
            }

            const sharedKey = await getSharedSecretKey(currentUid, privateKey, effectivePeerPubKey);
            const plaintext = await decryptPayload(sharedKey, msg.ciphertext, msg.iv);

            return {
              ...msg,
              decryptedText: plaintext,
              decryptError: false,
            };
          } catch (err) {
            console.warn('Decryption failed for message', msg.messageId, err);
            return {
              ...msg,
              decryptedText: '[Unable to decrypt: Key mismatch or invalid payload]',
              decryptError: true,
            };
          }
        })
      );

      callback(decryptedList);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

/**
 * Sends a client-side end-to-end encrypted message.
 * Plaintext NEVER leaves the device or enters the database.
 */
export async function sendEncryptedMessage(
  conversationId: string,
  senderId: string,
  recipientId: string,
  plaintext: string
): Promise<Message> {
  if (!plaintext.trim()) {
    throw new Error('Message cannot be empty.');
  }

  // 1. Retrieve sender's private key
  const { privateKey, publicKeyString: senderPubKeyStr } = await getOrGenerateUserKeyPair(senderId);

  // 2. Retrieve recipient's public key
  let recipientPubKeyStr: string | null = null;
  const convRef = doc(db, 'conversations', conversationId);
  const convSnap = await getDoc(convRef);

  if (convSnap.exists()) {
    const convData = convSnap.data() as Conversation;
    recipientPubKeyStr = convData.participantData?.[recipientId]?.publicKey || null;
  }

  if (!recipientPubKeyStr) {
    const recipientProfile = await getPublicProfile(recipientId);
    recipientPubKeyStr = recipientProfile?.publicKey || null;
  }

  if (!recipientPubKeyStr) {
    throw new Error('Recipient has not registered an E2EE public key yet.');
  }

  // 3. Derive symmetric AES-GCM-256 key from sender private key + recipient public key
  const sharedKey = await getSharedSecretKey(senderId, privateKey, recipientPubKeyStr);

  // 4. Encrypt message locally with fresh IV
  const { ciphertext, iv } = await encryptPayload(sharedKey, plaintext.trim());

  // 5. Create message document
  const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const now = new Date().toISOString();

  const messageDoc: Message = {
    messageId,
    conversationId,
    senderId,
    recipientId,
    ciphertext,
    iv,
    status: 'sent',
    messageType: 'text',
    createdAt: now,
  };

  const msgPath = `conversations/${conversationId}/messages/${messageId}`;
  try {
    await setDoc(doc(db, 'conversations', conversationId, 'messages', messageId), messageDoc);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, msgPath);
  }

  // 6. Update conversation last message & timestamp
  const convPath = `conversations/${conversationId}`;
  try {
    await updateDoc(convRef, {
      lastMessage: {
        senderId,
        ciphertext,
        iv,
        createdAt: now,
        status: 'sent',
        messageType: 'text',
      },
      updatedAt: now,
      [`typing.${senderId}`]: false,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, convPath);
  }

  return {
    ...messageDoc,
    decryptedText: plaintext.trim(),
  };
}

/**
 * Marks a received message as read.
 */
export async function markMessageAsRead(
  conversationId: string,
  messageId: string
): Promise<void> {
  const path = `conversations/${conversationId}/messages/${messageId}`;
  try {
    await updateDoc(doc(db, 'conversations', conversationId, 'messages', messageId), {
      status: 'read',
    });
  } catch (error) {
    // Non-critical update
    console.debug('Failed to mark message as read:', error);
  }
}

/**
 * Updates typing presence in a conversation with debounce/timeout.
 */
export async function setTypingStatus(
  conversationId: string,
  userId: string,
  isTyping: boolean
): Promise<void> {
  const convRef = doc(db, 'conversations', conversationId);
  try {
    await updateDoc(convRef, {
      [`typing.${userId}`]: isTyping,
    });
  } catch {
    // Non-critical presence update
  }
}

/**
 * Ensures or creates a conversation between two users with their public profiles.
 */
export async function getOrCreateConversation(
  userAId: string,
  userBId: string,
  profileA: PublicProfile,
  profileB: PublicProfile
): Promise<string> {
  const [minUid, maxUid] = [userAId, userBId].sort();
  const conversationId = `${minUid}_${maxUid}`;
  const convRef = doc(db, 'conversations', conversationId);
  const now = new Date().toISOString();

  try {
    const snap = await getDoc(convRef);
    if (!snap.exists()) {
      const newConv: Conversation = {
        conversationId,
        participantUids: [minUid, maxUid],
        participantData: {
          [userAId]: {
            displayName: profileA.displayName,
            photoURL: profileA.photoURL || '',
            publicKey: profileA.publicKey || '',
          },
          [userBId]: {
            displayName: profileB.displayName,
            photoURL: profileB.photoURL || '',
            publicKey: profileB.publicKey || '',
          },
        },
        createdAt: now,
        updatedAt: now,
      };
      await setDoc(convRef, newConv);
    }
    return conversationId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `conversations/${conversationId}`);
  }
}
