import React, { useState } from 'react';
import { Search, UserPlus, Check, AlertCircle, ShieldCheck, Mail, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { searchUserByEmail } from '../services/userService';
import { sendFriendRequest } from '../services/friendService';
import { EmailLookup } from '../types';

export const FindFriendsView: React.FC<{ onNavigateToRequests: () => void }> = ({
  onNavigateToRequests,
}) => {
  const { profile } = useAuth();
  const [searchEmail, setSearchEmail] = useState('');
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [foundUser, setFoundUser] = useState<EmailLookup | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [requestSending, setRequestSending] = useState(false);
  const [requestSent, setRequestSent] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchEmail.trim().toLowerCase();
    if (!query) return;

    setErrorMsg(null);
    setSearched(false);
    setRequestSent(false);
    setSearching(true);

    try {
      if (profile && query === profile.email.toLowerCase()) {
        setErrorMsg('You cannot search for or add your own email address.');
        setFoundUser(null);
        setSearched(true);
        return;
      }

      const result = await searchUserByEmail(query);
      setFoundUser(result);
      setSearched(true);
      if (!result) {
        setErrorMsg('No user found with this email address.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Search failed';
      setErrorMsg(msg);
      setFoundUser(null);
      setSearched(true);
    } finally {
      setSearching(false);
    }
  };

  const handleSendRequest = async () => {
    if (!profile || !foundUser) return;
    setRequestSending(true);
    setErrorMsg(null);

    try {
      await sendFriendRequest(profile, foundUser.email);
      setRequestSent(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send friend request';
      setErrorMsg(msg);
    } finally {
      setRequestSending(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Search className="w-5 h-5 text-emerald-400" />
          Find Registered Friends
        </h2>
        <p className="text-xs sm:text-sm text-zinc-400 mt-1">
          Search for another registered user using their real email address. The system performs an isolated point-lookup to protect privacy and prevent directory crawling.
        </p>
      </div>

      {/* Search Input Box */}
      <form onSubmit={handleSearch} className="relative">
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="email"
              required
              value={searchEmail}
              onChange={(e) => {
                setSearchEmail(e.target.value);
                if (searched) {
                  setSearched(false);
                  setFoundUser(null);
                  setErrorMsg(null);
                }
              }}
              placeholder="Enter exact friend's email (e.g. friend@example.com)"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all shadow-inner"
            />
          </div>
          <button
            type="submit"
            disabled={searching || !searchEmail.trim()}
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-emerald-950/30 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {searching ? (
              <span className="inline-block w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Search className="w-4 h-4" />
                <span>Search</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Result Card: User Found */}
      {searched && foundUser && (
        <div className="bg-zinc-900/90 border border-emerald-500/30 rounded-2xl p-5 shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                {foundUser.photoURL ? (
                  <img
                    src={foundUser.photoURL}
                    alt={foundUser.displayName}
                    className="w-14 h-14 rounded-2xl object-cover border border-zinc-700 shadow-md"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-700 flex items-center justify-center text-white font-bold text-xl shadow-md">
                    {foundUser.displayName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-zinc-900 flex items-center justify-center text-zinc-950">
                  <ShieldCheck className="w-3 h-3" />
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-white">
                    {foundUser.displayName}
                  </h3>
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-medium">
                    Verified Member
                  </span>
                </div>
                <p className="text-xs text-zinc-400 font-mono mt-0.5">{foundUser.email}</p>
                {foundUser.username && (
                  <p className="text-xs text-zinc-500">@{foundUser.username}</p>
                )}
              </div>
            </div>

            <div>
              {requestSent ? (
                <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold px-4 py-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                  <Check className="w-4 h-4" />
                  <span>Request Sent</span>
                </div>
              ) : (
                <button
                  onClick={handleSendRequest}
                  disabled={requestSending}
                  className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-emerald-950/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {requestSending ? (
                    <span className="inline-block w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>Add Friend</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Result: Not Found or Error */}
      {errorMsg && (
        <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 text-zinc-300 text-xs flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-zinc-200">{errorMsg}</p>
            {errorMsg.includes('already pending') && (
              <button
                onClick={onNavigateToRequests}
                className="text-emerald-400 hover:underline inline-block mt-1 text-xs"
              >
                View pending friend requests →
              </button>
            )}
          </div>
        </div>
      )}

      {/* Friendly Guide */}
      <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300 uppercase tracking-wider">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          How Real-Time Friend Discovery Works
        </div>
        <ul className="text-xs text-zinc-400 space-y-2 list-disc list-inside leading-relaxed">
          <li>
            Enter the exact email your friend used when creating their CipherWire account.
          </li>
          <li>
            Our database rules prevent client-side scraping or downloading of registered user directories.
          </li>
          <li>
            Once your friend accepts your request, an end-to-end encrypted channel is created with ECDH key negotiation.
          </li>
        </ul>
      </div>
    </div>
  );
};
