import React, { useEffect, useState } from 'react';
import {
  Users,
  MessageSquare,
  UserMinus,
  Ban,
  MoreVertical,
  Shield,
  Search,
} from 'lucide-react';
import { Friendship, PublicProfile } from '../types';
import { useAuth } from '../context/AuthContext';
import { getPublicProfile, subscribeToPublicProfile } from '../services/userService';
import { removeFriend, blockUser } from '../services/friendService';

interface FriendsViewProps {
  friends: Friendship[];
  onOpenChat: (peerUid: string, peerProfile: PublicProfile) => void;
  onNavigateToFind: () => void;
}

export const FriendsView: React.FC<FriendsViewProps> = ({
  friends,
  onOpenChat,
  onNavigateToFind,
}) => {
  const { profile } = useAuth();
  const [friendProfiles, setFriendProfiles] = useState<Record<string, PublicProfile>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Subscribe to real-time public profiles (online status & last-seen) for all mutual friends
  useEffect(() => {
    if (!profile) return;

    if (friends.length === 0) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubs: (() => void)[] = [];

    friends.forEach((f) => {
      const peerUid = f.userA === profile.uid ? f.userB : f.userA;
      const unsub = subscribeToPublicProfile(peerUid, (liveProfile) => {
        if (liveProfile) {
          setFriendProfiles((prev) => ({
            ...prev,
            [peerUid]: liveProfile,
          }));
        }
      });
      unsubs.push(unsub);
    });

    setLoading(false);

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [friends, profile]);

  const handleRemove = async (friendshipId: string) => {
    if (confirm('Are you sure you want to remove this friend?')) {
      await removeFriend(friendshipId);
    }
  };

  const handleBlock = async (friendshipId: string, peerUid: string) => {
    if (!profile) return;
    if (confirm('Are you sure you want to block this user? They will not be able to message you.')) {
      await blockUser(profile.uid, peerUid);
      await removeFriend(friendshipId);
    }
  };

  const filteredFriends = friends.filter((f) => {
    if (!profile) return false;
    const peerUid = f.userA === profile.uid ? f.userB : f.userA;
    const p = friendProfiles[peerUid];
    if (!p) return true;
    const q = searchTerm.toLowerCase();
    return (
      p.displayName.toLowerCase().includes(q) ||
      (p.username && p.username.toLowerCase().includes(q))
    );
  });

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-400" />
            Friends ({friends.length})
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Your verified mutual connections. Messages are end-to-end encrypted with ECDH P-256.
          </p>
        </div>

        <button
          onClick={onNavigateToFind}
          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
        >
          <Search className="w-3.5 h-3.5 text-emerald-400" />
          <span>Find More Friends</span>
        </button>
      </div>

      {friends.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filter friends by name..."
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>
      )}

      {loading && friends.length === 0 ? (
        <div className="flex justify-center p-8">
          <div className="w-6 h-6 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
        </div>
      ) : friends.length === 0 ? (
        <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-zinc-800/80 flex items-center justify-center text-zinc-400 mx-auto">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-white">No friends added yet</h3>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto">
            Search for registered friends by entering their real email address and send them an invite.
          </p>
          <button
            onClick={onNavigateToFind}
            className="mt-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-medium transition-colors cursor-pointer inline-flex items-center gap-2"
          >
            <Search className="w-3.5 h-3.5" />
            Find Friends Now
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filteredFriends.map((f) => {
            if (!profile) return null;
            const peerUid = f.userA === profile.uid ? f.userB : f.userA;
            const p = friendProfiles[peerUid];
            const isMenuOpen = activeMenuId === f.friendshipId;

            return (
              <div
                key={f.friendshipId}
                className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col justify-between gap-3 shadow-md hover:border-zinc-700 transition-all relative group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      {p?.photoURL ? (
                        <img
                          src={p.photoURL}
                          alt={p.displayName}
                          className="w-12 h-12 rounded-xl object-cover border border-zinc-700"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-700 flex items-center justify-center text-white font-bold text-lg">
                          {(p?.displayName || 'U').charAt(0).toUpperCase()}
                        </div>
                      )}
                      {p?.isOnline ? (
                        <span
                          className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-zinc-900"
                          title="Online"
                        />
                      ) : (
                        <span
                          className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-zinc-600 border-2 border-zinc-900"
                          title="Offline"
                        />
                      )}
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-white flex items-center gap-1.5">
                        {p?.displayName || 'Loading...'}
                        <Shield className="w-3.5 h-3.5 text-emerald-400" />
                      </h4>
                      {p?.username && (
                        <p className="text-xs text-zinc-500">@{p.username}</p>
                      )}
                      <p className="text-[11px] text-zinc-400 mt-0.5">
                        {p?.isOnline ? (
                          <span className="text-emerald-400 font-medium">Online now</span>
                        ) : p?.lastSeen ? (
                          `Last seen ${new Date(p.lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                        ) : (
                          'Offline'
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="relative">
                    <button
                      onClick={() => setActiveMenuId(isMenuOpen ? null : f.friendshipId)}
                      className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {isMenuOpen && (
                      <div className="absolute right-0 top-8 z-20 w-44 bg-zinc-950 border border-zinc-800 rounded-xl p-1.5 shadow-xl space-y-1">
                        <button
                          onClick={() => {
                            setActiveMenuId(null);
                            handleRemove(f.friendshipId);
                          }}
                          className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:text-red-400 hover:bg-zinc-900 rounded-lg flex items-center gap-2"
                        >
                          <UserMinus className="w-3.5 h-3.5" />
                          <span>Remove Friend</span>
                        </button>
                        <button
                          onClick={() => {
                            setActiveMenuId(null);
                            handleBlock(f.friendshipId, peerUid);
                          }}
                          className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-red-950/30 rounded-lg flex items-center gap-2"
                        >
                          <Ban className="w-3.5 h-3.5" />
                          <span>Block User</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between">
                  <span className="text-[10px] text-zinc-500 font-mono">
                    E2EE Active
                  </span>
                  <button
                    onClick={() => {
                      if (p) onOpenChat(peerUid, p);
                    }}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-sm shadow-emerald-950/40 cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Message</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
