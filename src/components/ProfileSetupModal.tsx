import React, { useState, useEffect, useRef } from 'react';
import {
  User,
  AtSign,
  Camera,
  Check,
  X,
  AlertCircle,
  Sparkles,
  Shield,
  Loader2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  checkUsernameAvailability,
  completeUserProfile,
} from '../services/userService';

const AVATAR_PRESETS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
];

interface ProfileSetupModalProps {
  isOpen: boolean;
  onComplete: () => void;
}

export const ProfileSetupModal: React.FC<ProfileSetupModalProps> = ({
  isOpen,
  onComplete,
}) => {
  const { user, profile, refreshProfile } = useAuth();

  const [displayName, setDisplayName] = useState(
    profile?.displayName || user?.displayName || ''
  );
  const [username, setUsername] = useState(
    profile?.username || (user?.email ? user.email.split('@')[0].replace(/[^a-zA-Z0-9_-]/g, '') : '')
  );
  const [photoURL, setPhotoURL] = useState(profile?.photoURL || user?.photoURL || '');
  const [about, setAbout] = useState(profile?.about || 'Hey there! I am using CipherWire.');

  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<{
    checked: boolean;
    available: boolean;
    error?: string;
  }>({ checked: false, available: false });

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-validate username on change
  useEffect(() => {
    if (!username.trim()) {
      setUsernameStatus({ checked: false, available: false });
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    setCheckingUsername(true);
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const res = await checkUsernameAvailability(username, user?.uid);
        setUsernameStatus({
          checked: true,
          available: res.available,
          error: res.error,
        });
      } catch {
        setUsernameStatus({
          checked: true,
          available: false,
          error: 'Error checking availability.',
        });
      } finally {
        setCheckingUsername(false);
      }
    }, 450);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [username, user?.uid]);

  // Handle local image file upload with client-side canvas compression
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setSubmitError('Please select a valid image file (PNG, JPG, WebP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Resize to maximum 256x256 square to fit efficiently in Firestore
        const canvas = document.createElement('canvas');
        const maxDim = 256;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
          setPhotoURL(compressedDataUrl);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !user.email) return;

    if (!displayName.trim()) {
      setSubmitError('Please enter your display name.');
      return;
    }

    if (!username.trim() || !usernameStatus.available) {
      setSubmitError(usernameStatus.error || 'Please choose an available username.');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      await completeUserProfile(user.uid, user.email, {
        displayName: displayName.trim(),
        username: username.trim(),
        photoURL,
        about: about.trim(),
      });
      await refreshProfile();
      onComplete();
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to save profile.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="relative w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-zinc-100 overflow-hidden">
        {/* Glow accent */}
        <div className="absolute -top-20 -right-20 w-44 h-44 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              Complete Your Profile
            </h2>
            <p className="text-xs text-zinc-400">
              Set up your public identity and secure handle on CipherWire
            </p>
          </div>
        </div>

        {submitError && (
          <div className="mb-4 p-3 bg-red-950/50 border border-red-800/80 rounded-xl text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{submitError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Avatar Selection */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Profile Picture (Optional)
            </label>
            <div className="flex items-center gap-4">
              <div className="relative shrink-0">
                {photoURL ? (
                  <img
                    src={photoURL}
                    alt="Preview"
                    className="w-16 h-16 rounded-2xl object-cover border-2 border-emerald-500/40 shadow-md"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-700 flex items-center justify-center text-white font-bold text-xl shadow-md">
                    {(displayName || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 text-zinc-950 flex items-center justify-center">
                  <Shield className="w-3 h-3" />
                </div>
              </div>

              <div className="flex-1 space-y-1.5">
                <div className="flex items-center gap-2">
                  <label className="px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-medium cursor-pointer transition-colors flex items-center gap-1.5 border border-zinc-700">
                    <Camera className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Upload Photo</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                  {photoURL && (
                    <button
                      type="button"
                      onClick={() => setPhotoURL('')}
                      className="text-xs text-zinc-500 hover:text-red-400 transition-colors"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-zinc-500">
                  Or pick one of these avatars:
                </p>
                <div className="flex items-center gap-1.5 overflow-x-auto py-1">
                  {AVATAR_PRESETS.map((url, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setPhotoURL(url)}
                      className={`w-7 h-7 rounded-lg overflow-hidden border transition-all shrink-0 cursor-pointer ${
                        photoURL === url
                          ? 'border-emerald-400 scale-105 ring-1 ring-emerald-400'
                          : 'border-zinc-700 opacity-60 hover:opacity-100'
                      }`}
                    >
                      <img src={url} alt={`Avatar ${i}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Display Name */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
              Display Name *
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                required
                maxLength={70}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Alex Johnson"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all shadow-inner"
              />
            </div>
          </div>

          {/* Unique Username */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Unique Handle (@username) *
              </label>
              {checkingUsername && (
                <span className="text-[11px] text-zinc-400 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin text-emerald-400" />
                  Checking availability...
                </span>
              )}
              {!checkingUsername && usernameStatus.checked && (
                <span
                  className={`text-[11px] font-medium flex items-center gap-1 ${
                    usernameStatus.available ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {usernameStatus.available ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Available
                    </>
                  ) : (
                    <>
                      <X className="w-3.5 h-3.5" />
                      {usernameStatus.error || 'Taken'}
                    </>
                  )}
                </span>
              )}
            </div>

            <div className="relative">
              <AtSign className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                required
                minLength={3}
                maxLength={30}
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                placeholder="alex_dev"
                className={`w-full bg-zinc-950 border rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none transition-all shadow-inner ${
                  usernameStatus.checked
                    ? usernameStatus.available
                      ? 'border-emerald-500/80 focus:border-emerald-500'
                      : 'border-red-500/80 focus:border-red-500'
                    : 'border-zinc-800 focus:border-emerald-500'
                }`}
              />
            </div>
            <p className="text-[11px] text-zinc-500 mt-1">
              Letters, numbers, underscores, and dashes only. Must be unique.
            </p>
          </div>

          {/* About / Bio */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
              Short Bio
            </label>
            <textarea
              rows={2}
              maxLength={200}
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              placeholder="Tell your friends what you're working on..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition-all resize-none shadow-inner"
            />
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting || checkingUsername || (usernameStatus.checked && !usernameStatus.available)}
              className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-emerald-950/40 transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Setting Up Your Encrypted Profile...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Start Messaging</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
