import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase/config';
import { FriendRequest, Friendship, UserProfile, Conversation } from '../types';
import { searchUserByEmail, getPublicProfile } from './userService';

/**
 * Sends a real friend request to a user by looking up their verified email address.
 */
export async function sendFriendRequest(
  currentUser: UserProfile,
  targetEmail: string
): Promise<{ success: boolean; message: string; targetProfile?: { displayName: string; photoURL?: string } }> {
  const normalizedEmail = targetEmail.trim().toLowerCase();

  if (normalizedEmail === currentUser.email.toLowerCase()) {
    throw new Error('You cannot send a friend request to yourself.');
  }

  // Verify recipient account exists
  const targetUser = await searchUserByEmail(normalizedEmail);
  if (!targetUser) {
    throw new Error('No user found with this email address.');
  }

  const targetUid = targetUser.uid;

  // Check if blocked
  const blockA = doc(db, 'blocks', `${currentUser.uid}_${targetUid}`);
  const blockB = doc(db, 'blocks', `${targetUid}_${currentUser.uid}`);
  try {
    const [b1, b2] = await Promise.all([getDoc(blockA), getDoc(blockB)]);
    if (b1.exists() || b2.exists()) {
      throw new Error('Unable to send friend request to this user.');
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('Unable to send')) throw err;
  }

  // Check if already friends
  const [minUid, maxUid] = [currentUser.uid, targetUid].sort();
  const friendshipId = `${minUid}_${maxUid}`;
  try {
    const existingFriendship = await getDoc(doc(db, 'friends', friendshipId));
    if (existingFriendship.exists()) {
      throw new Error('You are already friends with this user.');
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('already friends')) throw err;
  }

  // Check if pending request exists
  const requestId = `${currentUser.uid}_${targetUid}`;
  const reverseRequestId = `${targetUid}_${currentUser.uid}`;

  try {
    const [req1, req2] = await Promise.all([
      getDoc(doc(db, 'friendRequests', requestId)),
      getDoc(doc(db, 'friendRequests', reverseRequestId)),
    ]);

    if (req1.exists() && req1.data()?.status === 'pending') {
      throw new Error('A friend request has already been sent to this user.');
    }
    if (req2.exists() && req2.data()?.status === 'pending') {
      throw new Error('This user has already sent you a friend request. Check your incoming requests!');
    }
  } catch (err: unknown) {
    if (err instanceof Error && (err.message.includes('already been sent') || err.message.includes('Check your incoming'))) {
      throw err;
    }
  }

  const now = new Date().toISOString();
  const newRequest: FriendRequest = {
    requestId,
    fromUid: currentUser.uid,
    toUid: targetUid,
    fromDisplayName: currentUser.displayName,
    fromEmail: currentUser.email,
    fromPhotoURL: currentUser.photoURL || '',
    toDisplayName: targetUser.displayName,
    toEmail: targetUser.email,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  };

  const path = `friendRequests/${requestId}`;
  try {
    await setDoc(doc(db, 'friendRequests', requestId), newRequest);
    return {
      success: true,
      message: `Friend request sent to ${targetUser.displayName}!`,
      targetProfile: {
        displayName: targetUser.displayName,
        photoURL: targetUser.photoURL,
      },
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Subscribes to pending incoming and outgoing friend requests for the current user.
 */
export function subscribeToFriendRequests(
  uid: string,
  callback: (data: { received: FriendRequest[]; sent: FriendRequest[] }) => void
): () => void {
  let received: FriendRequest[] = [];
  let sent: FriendRequest[] = [];

  const update = () => {
    callback({ received, sent });
  };

  const pathReceived = 'friendRequests';
  const qReceived = query(
    collection(db, 'friendRequests'),
    where('toUid', '==', uid)
  );

  const unsubReceived = onSnapshot(
    qReceived,
    (snap) => {
      received = snap.docs
        .map((d) => d.data() as FriendRequest)
        .filter((r) => r.status === 'pending');
      update();
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, pathReceived);
    }
  );

  const pathSent = 'friendRequests';
  const qSent = query(
    collection(db, 'friendRequests'),
    where('fromUid', '==', uid)
  );

  const unsubSent = onSnapshot(
    qSent,
    (snap) => {
      sent = snap.docs
        .map((d) => d.data() as FriendRequest)
        .filter((r) => r.status === 'pending');
      update();
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, pathSent);
    }
  );

  return () => {
    unsubReceived();
    unsubSent();
  };
}

/**
 * Accepts a friend request, establishes mutual friendship record, and initializes 1-to-1 conversation room.
 */
export async function acceptFriendRequest(
  request: FriendRequest,
  currentUser: UserProfile
): Promise<void> {
  const now = new Date().toISOString();
  const reqPath = `friendRequests/${request.requestId}`;

  // 1. Update friend request status
  try {
    await updateDoc(doc(db, 'friendRequests', request.requestId), {
      status: 'accepted',
      updatedAt: now,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, reqPath);
  }

  // 2. Establish friendship
  const [userA, userB] = [request.fromUid, request.toUid].sort();
  const friendshipId = `${userA}_${userB}`;
  const friendshipPath = `friends/${friendshipId}`;

  const friendship: Friendship = {
    friendshipId,
    userA,
    userB,
    users: [userA, userB],
    createdAt: now,
  };

  try {
    await setDoc(doc(db, 'friends', friendshipId), friendship);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, friendshipPath);
  }

  // 3. Initialize or link 1-to-1 Conversation
  const conversationId = friendshipId;
  const convPath = `conversations/${conversationId}`;

  try {
    const existingConv = await getDoc(doc(db, 'conversations', conversationId));
    if (!existingConv.exists()) {
      // Fetch public profiles to get public keys
      const [pFrom, pTo] = await Promise.all([
        getPublicProfile(request.fromUid),
        getPublicProfile(request.toUid),
      ]);

      const newConversation: Conversation = {
        conversationId,
        participantUids: [userA, userB],
        participantData: {
          [request.fromUid]: {
            displayName: request.fromDisplayName || 'User',
            photoURL: request.fromPhotoURL || '',
            publicKey: pFrom?.publicKey || '',
          },
          [request.toUid]: {
            displayName: currentUser.displayName,
            photoURL: currentUser.photoURL || '',
            publicKey: pTo?.publicKey || currentUser.publicKey || '',
          },
        },
        createdAt: now,
        updatedAt: now,
      };

      await setDoc(doc(db, 'conversations', conversationId), newConversation);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, convPath);
  }
}

/**
 * Rejects a friend request.
 */
export async function rejectFriendRequest(requestId: string): Promise<void> {
  const path = `friendRequests/${requestId}`;
  try {
    await updateDoc(doc(db, 'friendRequests', requestId), {
      status: 'rejected',
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Cancels an outgoing pending friend request.
 */
export async function cancelFriendRequest(requestId: string): Promise<void> {
  const path = `friendRequests/${requestId}`;
  try {
    await deleteDoc(doc(db, 'friendRequests', requestId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Subscribes to mutual friendships for the user.
 */
export function subscribeToFriends(
  uid: string,
  callback: (friends: Friendship[]) => void
): () => void {
  const path = 'friends';
  let listA: Friendship[] = [];
  let listB: Friendship[] = [];

  const update = () => {
    const combined = [...listA, ...listB];
    const unique = Array.from(new Map(combined.map((f) => [f.friendshipId, f])).values());
    callback(unique);
  };

  const qA = query(collection(db, 'friends'), where('userA', '==', uid));
  const unsubA = onSnapshot(
    qA,
    (snap) => {
      listA = snap.docs.map((d) => d.data() as Friendship);
      update();
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );

  const qB = query(collection(db, 'friends'), where('userB', '==', uid));
  const unsubB = onSnapshot(
    qB,
    (snap) => {
      listB = snap.docs.map((d) => d.data() as Friendship);
      update();
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );

  return () => {
    unsubA();
    unsubB();
  };
}

/**
 * Removes an existing friend.
 */
export async function removeFriend(friendshipId: string): Promise<void> {
  const path = `friends/${friendshipId}`;
  try {
    await deleteDoc(doc(db, 'friends', friendshipId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Blocks a user to prevent requests and interaction.
 */
export async function blockUser(blockerUid: string, blockedUid: string): Promise<void> {
  const blockId = `${blockerUid}_${blockedUid}`;
  const path = `blocks/${blockId}`;
  const now = new Date().toISOString();

  try {
    await setDoc(doc(db, 'blocks', blockId), {
      blockId,
      blockerUid,
      blockedUid,
      createdAt: now,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Unblocks a user.
 */
export async function unblockUser(blockerUid: string, blockedUid: string): Promise<void> {
  const blockId = `${blockerUid}_${blockedUid}`;
  const path = `blocks/${blockId}`;
  try {
    await deleteDoc(doc(db, 'blocks', blockId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
