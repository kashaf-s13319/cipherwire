import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  sendPasswordResetEmail,
  deleteUser,
  updateProfile,
} from 'firebase/auth';
import { auth, googleProvider, facebookProvider, testConnection } from '../firebase/config';
import { UserProfile } from '../types';
import {
  syncUserProfile,
  getUserProfile,
  setUserPresence,
} from '../services/userService';
import { getOrGenerateUserKeyPair } from '../crypto/e2ee';

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  networkOnline: boolean;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string, displayName: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  loginWithFacebook: () => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  deleteAccount: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  authError: string | null;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [networkOnline, setNetworkOnline] = useState<boolean>(navigator.onLine);
  const [authError, setAuthError] = useState<string | null>(null);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  // Monitor network connectivity
  useEffect(() => {
    const handleOnline = () => {
      setNetworkOnline(true);
      testConnection();
      if (auth.currentUser) {
        setUserPresence(auth.currentUser.uid, true, true);
      }
    };
    const handleOffline = () => {
      setNetworkOnline(false);
      if (auth.currentUser) {
        setUserPresence(auth.currentUser.uid, false, true);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Monitor user activity and presence (throttled)
  useEffect(() => {
    if (!user) return;

    let inactivityTimeout: NodeJS.Timeout | null = null;
    let heartbeatInterval: NodeJS.Timeout | null = null;

    const resetInactivityTimer = () => {
      // Efficiently record presence as online (throttled internally)
      setUserPresence(user.uid, true);

      if (inactivityTimeout) clearTimeout(inactivityTimeout);
      // Mark idle/inactive after 2 minutes of no user interaction
      inactivityTimeout = setTimeout(() => {
        setUserPresence(user.uid, false);
      }, 2 * 60 * 1000);
    };

    // User interaction events
    const activityEvents = ['mousemove', 'keydown', 'touchstart', 'scroll', 'click'];
    const handleActivity = () => {
      resetInactivityTimer();
    };

    activityEvents.forEach((evt) => window.addEventListener(evt, handleActivity, { passive: true }));
    resetInactivityTimer();

    // Heartbeat every 60 seconds while window is visible and active
    heartbeatInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        setUserPresence(user.uid, true);
      }
    }, 60 * 1000);

    // Visibility change handler (tab switch, minimize)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        setUserPresence(user.uid, false, true);
      } else if (document.visibilityState === 'visible') {
        setUserPresence(user.uid, true, true);
        resetInactivityTimer();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Unload handler
    const handleBeforeUnload = () => {
      setUserPresence(user.uid, false, true);
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      if (inactivityTimeout) clearTimeout(inactivityTimeout);
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      activityEvents.forEach((evt) => window.removeEventListener(evt, handleActivity));
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [user]);

  // Sync profile & keys when user logs in
  const initUserSession = useCallback(async (fbUser: FirebaseUser) => {
    try {
      // 1. Get or generate user's device E2EE ECDH keys
      const { publicKeyString } = await getOrGenerateUserKeyPair(fbUser.uid);

      // 2. Sync profile and public key to Firestore
      const userProf = await syncUserProfile(
        fbUser.uid,
        fbUser.email || '',
        fbUser.displayName || 'Anonymous',
        fbUser.photoURL || '',
        publicKeyString
      );

      setProfile(userProf);

      // 3. Mark online
      await setUserPresence(fbUser.uid, true);
    } catch (err) {
      console.error('Error initializing user session:', err);
    }
  }, []);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await initUserSession(currentUser);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    // Run connection test
    testConnection();

    return () => unsubscribe();
  }, [initUserSession]);

  const refreshProfile = useCallback(async () => {
    if (auth.currentUser) {
      const p = await getUserProfile(auth.currentUser.uid);
      if (p) setProfile(p);
    }
  }, []);

  const loginWithEmail = async (email: string, pass: string) => {
    clearAuthError();
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), pass);
      await initUserSession(cred.user);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      setAuthError(mapAuthErrorMessage(msg));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signUpWithEmail = async (email: string, pass: string, displayName: string) => {
    clearAuthError();
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), pass);
      if (displayName) {
        await updateProfile(cred.user, { displayName: displayName.trim() });
      }
      await initUserSession(cred.user);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sign up failed';
      setAuthError(mapAuthErrorMessage(msg));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogle = async () => {
    clearAuthError();
    setLoading(true);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      await initUserSession(cred.user);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Google sign-in failed';
      setAuthError(mapAuthErrorMessage(msg));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const loginWithFacebook = async () => {
    clearAuthError();
    setLoading(true);
    try {
      const cred = await signInWithPopup(auth, facebookProvider);
      await initUserSession(cred.user);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Facebook sign-in failed';
      if (msg.includes('auth/operation-not-allowed') || msg.includes('configuration-not-found')) {
        setAuthError(
          'Facebook Login is not enabled yet in your Firebase Console. Go to Firebase Console -> Authentication -> Sign-in method -> Add Facebook Provider with your App ID.'
        );
      } else {
        setAuthError(mapAuthErrorMessage(msg));
      }
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    if (user) {
      await setUserPresence(user.uid, false);
    }
    await signOut(auth);
    setUser(null);
    setProfile(null);
  };

  const resetPassword = async (email: string) => {
    clearAuthError();
    try {
      await sendPasswordResetEmail(auth, email.trim());
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Password reset failed';
      setAuthError(mapAuthErrorMessage(msg));
      throw err;
    }
  };

  const deleteAccount = async () => {
    if (!auth.currentUser) return;
    try {
      await deleteUser(auth.currentUser);
      setUser(null);
      setProfile(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Account deletion failed';
      setAuthError(mapAuthErrorMessage(msg));
      throw err;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        networkOnline,
        loginWithEmail,
        signUpWithEmail,
        loginWithGoogle,
        loginWithFacebook,
        logout,
        resetPassword,
        deleteAccount,
        refreshProfile,
        authError,
        clearAuthError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

function mapAuthErrorMessage(errorMsg: string): string {
  if (errorMsg.includes('auth/unauthorized-domain')) {
    const host = typeof window !== 'undefined' ? window.location.hostname : 'this domain';
    return `auth/unauthorized-domain: This domain (${host}) is not added to Firebase Authorized Domains yet. Please add "${host}" under Firebase Console -> Authentication -> Settings -> Authorized domains, or use Email/Password which works on any device and domain without restriction.`;
  }
  if (errorMsg.includes('auth/operation-not-allowed')) {
    return 'Email/Password sign-in is not enabled in Firebase Console yet. Please open Firebase Console -> Authentication -> Sign-in method, click Email/Password, and enable it. In the meantime, you can sign in directly with Google!';
  }
  if (errorMsg.includes('auth/invalid-credential') || errorMsg.includes('auth/wrong-password')) {
    return 'Invalid email or password. Please check your credentials and try again.';
  }
  if (errorMsg.includes('auth/user-not-found')) {
    return 'No user found with this email address.';
  }
  if (errorMsg.includes('auth/email-already-in-use')) {
    return 'This email address is already registered. Please log in instead.';
  }
  if (errorMsg.includes('auth/weak-password')) {
    return 'Password is too weak. Please use at least 6 characters.';
  }
  if (errorMsg.includes('auth/invalid-email')) {
    return 'Please enter a valid email address.';
  }
  if (errorMsg.includes('auth/popup-closed-by-user')) {
    return 'Authentication popup was closed before completing.';
  }
  if (errorMsg.includes('auth/popup-blocked')) {
    return 'Authentication popup was blocked by browser. Please allow popups for this site.';
  }
  return errorMsg;
}
