import React, { useState } from 'react';
import {
  ShieldCheck,
  Key,
  Download,
  Upload,
  Lock,
  Eye,
  Check,
  AlertTriangle,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { exportKeyBackup, importKeyBackup } from '../crypto/e2ee';
import { updateUserProfile } from '../services/userService';

export const SecurityView: React.FC = () => {
  const { profile, refreshProfile, deleteAccount } = useAuth();
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const [privacySuccess, setPrivacySuccess] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Privacy states
  const [showOnlineStatus, setShowOnlineStatus] = useState<boolean>(
    profile?.privacySettings?.showOnlineStatus ?? true
  );
  const [showLastSeen, setShowLastSeen] = useState<boolean>(
    profile?.privacySettings?.showLastSeen ?? true
  );
  const [showPhoto, setShowPhoto] = useState<boolean>(
    profile?.privacySettings?.showPhoto ?? true
  );

  const handleExportKeys = async () => {
    if (!profile) return;
    const backupJson = await exportKeyBackup(profile.uid);
    if (!backupJson) {
      alert('No keys found on this device to export.');
      return;
    }

    const blob = new Blob([backupJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cipherwire-e2ee-keys-${profile.uid.slice(0, 8)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 3000);
  };

  const handleImportKeys = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    try {
      const text = await file.text();
      const success = await importKeyBackup(profile.uid, text);
      if (success) {
        setImportNotice('Cryptographic key imported successfully!');
        await refreshProfile();
      } else {
        setImportNotice('Failed to import: Invalid key backup file.');
      }
    } catch {
      setImportNotice('Failed to read key file.');
    }

    setTimeout(() => setImportNotice(null), 4000);
  };

  const handleSavePrivacy = async () => {
    if (!profile) return;
    setSavingPrivacy(true);
    setPrivacySuccess(false);

    try {
      await updateUserProfile(profile.uid, {
        privacySettings: {
          showOnlineStatus,
          showLastSeen,
          showPhoto,
        },
      });
      await refreshProfile();
      setPrivacySuccess(true);
      setTimeout(() => setPrivacySuccess(false), 2500);
    } catch (err) {
      console.error('Failed to update privacy:', err);
    } finally {
      setSavingPrivacy(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      await deleteAccount();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete account');
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          End-to-End Encryption & Privacy
        </h2>
        <p className="text-xs sm:text-sm text-zinc-400 mt-1">
          Review your cryptographic keys, backup your device keys, and customize privacy settings.
        </p>
      </div>

      {/* Cryptographic Architecture Card */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Cryptographic Protocol</h3>
            <p className="text-xs text-zinc-400">Standardized W3C Web Cryptography API</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800/80">
            <span className="text-zinc-500 block text-[10px] uppercase font-mono tracking-wider">
              Key Agreement
            </span>
            <span className="text-emerald-300 font-medium text-sm">ECDH (NIST P-256)</span>
            <p className="text-zinc-400 mt-1 text-[11px]">
              Derives shared symmetric keys between participants without network transmission.
            </p>
          </div>

          <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800/80">
            <span className="text-zinc-500 block text-[10px] uppercase font-mono tracking-wider">
              Payload Cipher
            </span>
            <span className="text-emerald-300 font-medium text-sm">AES-GCM (256-bit)</span>
            <p className="text-zinc-400 mt-1 text-[11px]">
              Authenticated encryption with unique 96-bit IV per message to prevent tampering.
            </p>
          </div>
        </div>
      </div>

      {/* Device Key Backup / Restore */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Key Backup & Device Migration</h3>
            <p className="text-xs text-zinc-400">
              Export your private key to access your messages on another device
            </p>
          </div>
        </div>

        {downloadSuccess && (
          <div className="p-3 bg-emerald-950/50 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>Key backup downloaded. Keep this file confidential!</span>
          </div>
        )}

        {importNotice && (
          <div className="p-3 bg-cyan-950/50 border border-cyan-500/40 rounded-xl text-cyan-300 text-xs flex items-center gap-2">
            <Check className="w-4 h-4 text-cyan-400" />
            <span>{importNotice}</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            onClick={handleExportKeys}
            className="flex-1 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>Export Key Backup</span>
          </button>

          <label className="flex-1 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer">
            <Upload className="w-4 h-4 text-cyan-400" />
            <span>Restore from Key File</span>
            <input
              type="file"
              accept=".json"
              onChange={handleImportKeys}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Privacy Settings */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <Eye className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Privacy Preferences</h3>
            <p className="text-xs text-zinc-400">Choose what other users can see</p>
          </div>
        </div>

        <div className="space-y-3 pt-2">
          <label className="flex items-center justify-between p-3 bg-zinc-950 rounded-xl border border-zinc-800/80 cursor-pointer">
            <div>
              <span className="text-sm font-medium text-white block">Online Presence</span>
              <span className="text-xs text-zinc-400">
                Let your friends see when you are actively using CipherWire
              </span>
            </div>
            <input
              type="checkbox"
              checked={showOnlineStatus}
              onChange={(e) => setShowOnlineStatus(e.target.checked)}
              className="w-4 h-4 accent-emerald-500 rounded"
            />
          </label>

          <label className="flex items-center justify-between p-3 bg-zinc-950 rounded-xl border border-zinc-800/80 cursor-pointer">
            <div>
              <span className="text-sm font-medium text-white block">Last Seen Timestamp</span>
              <span className="text-xs text-zinc-400">
                Display the time of your last activity
              </span>
            </div>
            <input
              type="checkbox"
              checked={showLastSeen}
              onChange={(e) => setShowLastSeen(e.target.checked)}
              className="w-4 h-4 accent-emerald-500 rounded"
            />
          </label>

          <label className="flex items-center justify-between p-3 bg-zinc-950 rounded-xl border border-zinc-800/80 cursor-pointer">
            <div>
              <span className="text-sm font-medium text-white block">Profile Photo Visibility</span>
              <span className="text-xs text-zinc-400">
                Show your avatar image to connections
              </span>
            </div>
            <input
              type="checkbox"
              checked={showPhoto}
              onChange={(e) => setShowPhoto(e.target.checked)}
              className="w-4 h-4 accent-emerald-500 rounded"
            />
          </label>
        </div>

        <div className="flex items-center justify-between pt-2">
          {privacySuccess ? (
            <span className="text-xs text-emerald-400 flex items-center gap-1.5 font-medium">
              <Check className="w-3.5 h-3.5" />
              Settings updated!
            </span>
          ) : (
            <span />
          )}

          <button
            onClick={handleSavePrivacy}
            disabled={savingPrivacy}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
          >
            {savingPrivacy ? 'Saving...' : 'Save Privacy'}
          </button>
        </div>
      </div>

      {/* Danger Zone: Account Deletion */}
      <div className="bg-red-950/20 border border-red-900/40 rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2 text-red-400 text-sm font-semibold">
          <AlertTriangle className="w-4 h-4" />
          <span>Danger Zone</span>
        </div>
        <p className="text-xs text-zinc-400">
          Permanently delete your account, cryptographic keys, and user profile. This action cannot be undone.
        </p>

        {deleteConfirmOpen ? (
          <div className="p-3 bg-red-950/50 border border-red-800/80 rounded-xl space-y-3">
            <p className="text-xs text-red-200 font-medium">
              Are you sure? All your conversations and keys will be permanently deleted.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-semibold cursor-pointer"
              >
                {deleting ? 'Deleting...' : 'Yes, Delete My Account'}
              </button>
              <button
                onClick={() => setDeleteConfirmOpen(false)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-medium cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setDeleteConfirmOpen(true)}
            className="px-4 py-2 bg-zinc-900 hover:bg-red-950 border border-red-900/60 text-red-400 rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete Account</span>
          </button>
        )}
      </div>
    </div>
  );
};
