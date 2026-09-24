import React, { useState } from 'react';
import { User, Mail, Camera, FileText, Check, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { updateUserProfile } from '../services/userService';

export const ProfileView: React.FC = () => {
  const { profile, refreshProfile } = useAuth();

  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [username, setUsername] = useState(profile?.username || '');
  const [about, setAbout] = useState(profile?.about || '');
  const [photoURL, setPhotoURL] = useState(profile?.photoURL || '');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    setSaving(true);
    setSuccess(false);
    setErrorMsg(null);

    try {
      await updateUserProfile(profile.uid, {
        displayName: displayName.trim(),
        username: username.trim(),
        about: about.trim(),
        photoURL: photoURL.trim(),
      });
      await refreshProfile();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <User className="w-5 h-5 text-emerald-400" />
          My Profile
        </h2>
        <p className="text-xs sm:text-sm text-zinc-400 mt-1">
          Manage your personal information, handle, and avatar picture.
        </p>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-md">
        {/* Avatar Display */}
        <div className="flex flex-col sm:flex-row items-center gap-5 pb-6 border-b border-zinc-800">
          <div className="relative">
            {photoURL ? (
              <img
                src={photoURL}
                alt="Avatar"
                className="w-20 h-20 rounded-2xl object-cover border-2 border-emerald-500/40 shadow-lg"
              />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-700 flex items-center justify-center text-white font-bold text-2xl shadow-lg">
                {(displayName || 'U').charAt(0).toUpperCase()}
              </div>
            )}
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-zinc-800 border-2 border-zinc-900 flex items-center justify-center text-emerald-400">
              <Shield className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="text-center sm:text-left space-y-1">
            <h3 className="text-base font-semibold text-white">
              {displayName || 'Anonymous User'}
            </h3>
            <p className="text-xs text-zinc-400 font-mono">{profile?.email}</p>
            <p className="text-[11px] text-zinc-500">
              UID: {profile?.uid}
            </p>
          </div>
        </div>

        {/* Edit Form */}
        <form onSubmit={handleSubmit} className="space-y-4 pt-6">
          {success && (
            <div className="p-3 bg-emerald-950/50 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>Profile updated successfully!</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 bg-red-950/50 border border-red-800 rounded-xl text-red-300 text-xs">
              {errorMsg}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              Email Address (Authentication identity)
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
              <input
                type="text"
                disabled
                value={profile?.email || ''}
                className="w-full bg-zinc-950/40 border border-zinc-800/60 rounded-xl pl-10 pr-4 py-2.5 text-xs text-zinc-500 cursor-not-allowed"
              />
            </div>
            <p className="text-[11px] text-zinc-500 mt-1">
              Your registered email is used for direct point-lookup by friends.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              Display Name
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                required
                maxLength={100}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Alice Walker"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              Username Handle
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 text-xs font-mono">
                @
              </span>
              <input
                type="text"
                maxLength={50}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="alice_dev"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-8 pr-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              About / Status Bio
            </label>
            <div className="relative">
              <FileText className="absolute left-3.5 top-3 w-4 h-4 text-zinc-500" />
              <textarea
                rows={3}
                maxLength={300}
                value={about}
                onChange={(e) => setAbout(e.target.value)}
                placeholder="Write a brief status bio..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition-colors resize-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              Avatar Image URL
            </label>
            <div className="relative">
              <Camera className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="url"
                maxLength={2048}
                value={photoURL}
                onChange={(e) => setPhotoURL(e.target.value)}
                placeholder="https://images.unsplash.com/photo-..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-emerald-950/40 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
