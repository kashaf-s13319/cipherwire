import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase/config';
import { UserProfile, PublicProfile, EmailLookup } from '../types';

/**
 * Converts an email to a safe, deterministic Base64URL key matching firestore.rules regex ^[a-zA-Z0-9_\-]+$
 */
export function emailToLookupKey(email: string): string {
  const normalized = email.trim().toLowerCase();
  const b64 = window.btoa(normalized);
  return b64.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

/**
 * Normalizes username for consistent storage and conflict checking
 */
export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

/**
 * Validates a candidate username format
 */
export function validateUsernameFormat(username: string): { valid: boolean; error?: string } {
  const trimmed = username.trim();
  if (trimmed.length < 3) {
    return { valid: false, error: 'Username must be at least 3 characters long.' };
  }
  if (trimmed.length > 30) {
    return { valid: false, error: 'Username cannot exceed 30 characters.' };
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
    return { valid: false, error: 'Username can only contain letters, numbers, underscores, and hyphens.' };
  }
  return { valid: true };
}

/**
 * Checks whether a unique username is available
 */
export async function checkUsernameAvailability(
  username: string,
  currentUid?: string
): Promise<{ available: boolean; error?: string }> {
  const format = validateUsernameFormat(username);
  if (!format.valid) {
    return { available: false, error: format.error };
  }

  const normalized = normalizeUsername(username);
  const path = `usernames/${normalized}`;

  try {
    const snap = await getDoc(doc(db, 'usernames', normalized));
    if (!snap.exists()) {
      return { available: true };
    }
    const data = snap.data();
    if (currentUid && data?.uid === currentUid) {
      return { available: true }; // Owned by current user
    }
    return { available: false, error: `The username @${normalized} is already taken.` };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

/**
 * Creates or synchronizes a user's private and public profiles along with the email lookup record.
 */
export async function syncUserProfile(
  uid: string,
  email: string,
  displayName: string,
  photoURL?: string,
  publicKey?: string
): Promise<UserProfile> {
  const userRef = doc(db, 'users', uid);
  const publicRef = doc(db, 'publicProfiles', uid);
  const emailKey = emailToLookupKey(email);
  const lookupRef = doc(db, 'emailLookups', emailKey);

  let existingUser: UserProfile | null = null;
  try {
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      existingUser = snap.data() as UserProfile;
    }
  } catch (err) {
    console.warn('Could not fetch existing user doc, creating new:', err);
  }

  const now = new Date().toISOString();

  // If existing user already completed profile, preserve it; otherwise false
  const isProfileCompleted = existingUser?.profileCompleted ?? false;

  const userProfile: UserProfile = {
    uid,
    email: email.trim().toLowerCase(),
    displayName: displayName || (existingUser?.displayName ?? ''),
    username: existingUser?.username || '',
    photoURL: photoURL || existingUser?.photoURL || '',
    about: existingUser?.about || 'Hey there! I am using CipherWire.',
    publicKey: publicKey || existingUser?.publicKey || '',
    isOnline: true,
    lastSeen: now,
    createdAt: existingUser?.createdAt || now,
    updatedAt: now,
    profileCompleted: isProfileCompleted,
    privacySettings: existingUser?.privacySettings || {
      showOnlineStatus: true,
      showLastSeen: true,
      showPhoto: true,
    },
  };

  const publicProfile: PublicProfile = {
    uid,
    displayName: userProfile.displayName,
    username: userProfile.username,
    photoURL: userProfile.photoURL,
    about: userProfile.about,
    publicKey: userProfile.publicKey,
    isOnline: true,
    lastSeen: now,
    updatedAt: now,
  };

  const emailLookup: EmailLookup = {
    uid,
    email: userProfile.email,
    displayName: userProfile.displayName,
    username: userProfile.username,
    photoURL: userProfile.photoURL,
    updatedAt: now,
  };

  try {
    await setDoc(userRef, userProfile, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${uid}`);
  }

  try {
    await setDoc(publicRef, publicProfile, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `publicProfiles/${uid}`);
  }

  try {
    await setDoc(lookupRef, emailLookup, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `emailLookups/${emailKey}`);
  }

  return userProfile;
}

/**
 * Completes the first-time profile creation flow, guaranteeing unique username reservation.
 */
export async function completeUserProfile(
  uid: string,
  userEmail: string,
  data: {
    displayName: string;
    username: string;
    photoURL?: string;
    about?: string;
  }
): Promise<UserProfile> {
  const normalizedUsername = normalizeUsername(data.username);

  // 1. Check availability
  const check = await checkUsernameAvailability(normalizedUsername, uid);
  if (!check.available) {
    throw new Error(check.error || 'Username is not available.');
  }

  const now = new Date().toISOString();

  // 2. Fetch current user to check if old username needs release
  const userRef = doc(db, 'users', uid);
  const snap = await getDoc(userRef);
  const existing = snap.exists() ? (snap.data() as UserProfile) : null;
  const oldUsername = existing?.username ? normalizeUsername(existing.username) : null;

  // 3. Claim username
  const usernamePath = `usernames/${normalizedUsername}`;
  try {
    await setDoc(doc(db, 'usernames', normalizedUsername), {
      username: normalizedUsername,
      uid,
      createdAt: now,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, usernamePath);
  }

  // 4. If old username differs, delete old reservation
  if (oldUsername && oldUsername !== normalizedUsername) {
    try {
      await deleteDoc(doc(db, 'usernames', oldUsername));
    } catch {
      // Non-critical cleanup
    }
  }

  // 5. Update user profile
  const userUpdates: Partial<UserProfile> = {
    displayName: data.displayName.trim(),
    username: normalizedUsername,
    photoURL: data.photoURL || existing?.photoURL || '',
    about: data.about?.trim() || existing?.about || 'Hey there! I am using CipherWire.',
    profileCompleted: true,
    updatedAt: now,
  };

  try {
    await updateDoc(userRef, userUpdates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
  }

  // 6. Update public profile
  try {
    await updateDoc(doc(db, 'publicProfiles', uid), {
      displayName: userUpdates.displayName,
      username: normalizedUsername,
      photoURL: userUpdates.photoURL,
      about: userUpdates.about,
      updatedAt: now,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `publicProfiles/${uid}`);
  }

  // 7. Update email lookup
  const emailKey = emailToLookupKey(userEmail);
  try {
    await updateDoc(doc(db, 'emailLookups', emailKey), {
      displayName: userUpdates.displayName,
      username: normalizedUsername,
      photoURL: userUpdates.photoURL,
      updatedAt: now,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `emailLookups/${emailKey}`);
  }

  const updatedSnap = await getDoc(userRef);
  return updatedSnap.data() as UserProfile;
}

/**
 * Retrieves the authenticated user's private profile.
 */
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const path = `users/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return null;
    return snap.data() as UserProfile;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

/**
 * Retrieves another user's public profile (including public key for E2EE).
 */
export async function getPublicProfile(uid: string): Promise<PublicProfile | null> {
  const path = `publicProfiles/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'publicProfiles', uid));
    if (!snap.exists()) return null;
    return snap.data() as PublicProfile;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

/**
 * Updates editable fields in the user's profile and synchronizes the public record.
 */
export async function updateUserProfile(
  uid: string,
  updates: {
    displayName?: string;
    username?: string;
    about?: string;
    photoURL?: string;
    privacySettings?: UserProfile['privacySettings'];
  }
): Promise<void> {
  const now = new Date().toISOString();
  const userPath = `users/${uid}`;
  const publicPath = `publicProfiles/${uid}`;

  // If username is changing, claim the new username
  if (updates.username) {
    const norm = normalizeUsername(updates.username);
    const check = await checkUsernameAvailability(norm, uid);
    if (!check.available) {
      throw new Error(check.error || 'Username is not available.');
    }

    const currentDoc = await getDoc(doc(db, 'users', uid));
    const oldName = currentDoc.data()?.username;

    await setDoc(doc(db, 'usernames', norm), {
      username: norm,
      uid,
      createdAt: now,
    });

    if (oldName && normalizeUsername(oldName) !== norm) {
      try {
        await deleteDoc(doc(db, 'usernames', normalizeUsername(oldName)));
      } catch {
        // Non-critical
      }
    }
    updates.username = norm;
  }

  try {
    await updateDoc(doc(db, 'users', uid), {
      ...updates,
      updatedAt: now,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, userPath);
  }

  // Sync public profile
  const publicUpdates: Partial<PublicProfile> = { updatedAt: now };
  if (updates.displayName !== undefined) publicUpdates.displayName = updates.displayName;
  if (updates.username !== undefined) publicUpdates.username = updates.username;
  if (updates.about !== undefined) publicUpdates.about = updates.about;
  if (updates.photoURL !== undefined) publicUpdates.photoURL = updates.photoURL;

  try {
    await updateDoc(doc(db, 'publicProfiles', uid), publicUpdates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, publicPath);
  }
}

/**
 * Searches for a registered user by their real email address via point lookup in emailLookups collection.
 */
export async function searchUserByEmail(email: string): Promise<EmailLookup | null> {
  const emailKey = emailToLookupKey(email);
  const path = `emailLookups/${emailKey}`;
  try {
    const snap = await getDoc(doc(db, 'emailLookups', emailKey));
    if (!snap.exists()) {
      return null;
    }
    return snap.data() as EmailLookup;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

// Presence throttling trackers to prevent Firestore quota exhaustion
let lastPresenceUpdate = 0;
let lastReportedStatus: boolean | null = null;

/**
 * Updates online presence status and last seen timestamp efficiently with throttling.
 */
export async function setUserPresence(
  uid: string,
  isOnline: boolean,
  force = false
): Promise<void> {
  const now = Date.now();
  // Throttle: don't write if status hasn't changed and less than 45 seconds have passed
  if (!force && lastReportedStatus === isOnline && now - lastPresenceUpdate < 45000) {
    return;
  }

  lastPresenceUpdate = now;
  lastReportedStatus = isOnline;
  const isoTime = new Date().toISOString();

  try {
    await Promise.all([
      updateDoc(doc(db, 'users', uid), {
        isOnline,
        lastSeen: isoTime,
      }),
      updateDoc(doc(db, 'publicProfiles', uid), {
        isOnline,
        lastSeen: isoTime,
      }),
    ]);
  } catch {
    // Non-critical, avoid throwing when browser is unloading or offline
  }
}

/**
 * Subscribes to real-time updates for a user's public profile (presence, status).
 */
export function subscribeToPublicProfile(
  uid: string,
  callback: (profile: PublicProfile | null) => void
): () => void {
  const path = `publicProfiles/${uid}`;
  return onSnapshot(
    doc(db, 'publicProfiles', uid),
    (snap) => {
      if (snap.exists()) {
        callback(snap.data() as PublicProfile);
      } else {
        callback(null);
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}
