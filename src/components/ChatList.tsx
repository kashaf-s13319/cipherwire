import React, { useEffect, useState } from 'react';
import { MessageSquare, Lock, Search, Sparkles } from 'lucide-react';
import { Conversation, PublicProfile } from '../types';
import { useAuth } from '../context/AuthContext';
import { getPublicProfile, subscribeToPublicProfile } from '../services/userService';
import {
  getOrGenerateUserKeyPair,
  getSharedSecretKey,
  decryptPayload,
} from '../crypto/e2ee';

interface ChatListProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (conv: Conversation, peerUid: string, peerProfile: PublicProfile) => void;
  onNavigateToFind: () => void;
}

export const ChatList: React.FC<ChatListProps> = ({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNavigateToFind,
}) => {
  const { profile } = useAuth();
  const [profiles, setProfiles] = useState<Record<string, PublicProfile>>({});
  const [decryptedPreviews, setDecryptedPreviews] = useState<Record<string, string>>({});
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Real-time live presence subscription for each conversation partner
  useEffect(() => {
    if (!profile || conversations.length === 0) return;

    const unsubs: (() => void)[] = [];
    const subscribedUids = new Set<string>();

    conversations.forEach((conv) => {
      const peerUid = conv.participantUids.find((uid) => uid !== profile.uid);
      if (!peerUid || subscribedUids.has(peerUid)) return;
      subscribedUids.add(peerUid);

      const unsub = subscribeToPublicProfile(peerUid, (liveProf) => {
        if (liveProf) {
          setProfiles((prev) => ({ ...prev, [peerUid]: liveProf }));
        }
      });
      unsubs.push(unsub);
    });

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [conversations, profile]);

  // Decrypt previews
  useEffect(() => {
    if (!profile) return;

    let isMounted = true;
    const loadPeerData = async () => {
      const pMap: Record<string, PublicProfile> = {};
      const previewMap: Record<string, string> = {};

      for (const conv of conversations) {
        const peerUid = conv.participantUids.find((uid) => uid !== profile.uid);
        if (!peerUid) continue;

        try {
          let peerProf = profiles[peerUid];
          if (!peerProf) {
            const fetched = await getPublicProfile(peerUid);
            if (fetched) {
              pMap[peerUid] = fetched;
              peerProf = fetched;
            }
          }

          // Attempt to decrypt last message preview
          if (conv.lastMessage && peerProf?.publicKey) {
            try {
              const { privateKey } = await getOrGenerateUserKeyPair(profile.uid);
              const sharedKey = await getSharedSecretKey(profile.uid, privateKey, peerProf.publicKey);
              const plaintext = await decryptPayload(
                sharedKey,
                conv.lastMessage.ciphertext,
                conv.lastMessage.iv
              );
              previewMap[conv.conversationId] = plaintext;
            } catch {
              previewMap[conv.conversationId] = 'Encrypted message';
            }
          }
        } catch (err) {
          console.warn('Error loading peer profile in ChatList:', peerUid, err);
        }
      }

      if (isMounted) {
        setProfiles((prev) => ({ ...prev, ...pMap }));
        setDecryptedPreviews((prev) => ({ ...prev, ...previewMap }));
      }
    };

    loadPeerData();
    return () => {
      isMounted = false;
    };
  }, [conversations, profile]);

  const filteredConversations = conversations.filter((c) => {
    if (!profile) return false;
    const peerUid = c.participantUids.find((uid) => uid !== profile.uid);
    if (!peerUid) return false;
    const peer = profiles[peerUid];
    if (!peer) return true;
    const q = searchTerm.toLowerCase();
    return (
      peer.displayName.toLowerCase().includes(q) ||
      (peer.username && peer.username.toLowerCase().includes(q))
    );
  });

  return (
    <div className="flex flex-col h-full bg-zinc-950 border-r border-zinc-800/80">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800/80">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-emerald-400" />
            Chats
          </h2>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400">
            {conversations.length}
          </span>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search conversations..."
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>
      </div>

      {/* Conversations Stream */}
      <div className="flex-1 overflow-y-auto divide-y divide-zinc-900/60">
        {conversations.length === 0 ? (
          <div className="p-6 text-center space-y-3 my-auto">
            <div className="w-12 h-12 rounded-2xl bg-zinc-900 flex items-center justify-center text-zinc-500 mx-auto">
              <Sparkles className="w-6 h-6 text-emerald-400" />
            </div>
            <h3 className="text-sm font-semibold text-white">No active chats</h3>
            <p className="text-xs text-zinc-400 max-w-xs mx-auto">
              Find friends with their registered email to start secure end-to-end encrypted conversations.
            </p>
            <button
              onClick={onNavigateToFind}
              className="mt-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-medium transition-colors cursor-pointer inline-flex items-center gap-1.5"
            >
              <Search className="w-3.5 h-3.5" />
              Find Friends
            </button>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="p-6 text-center text-xs text-zinc-500">
            No chats match &ldquo;{searchTerm}&rdquo;
          </div>
        ) : (
          filteredConversations.map((conv) => {
            if (!profile) return null;
            const peerUid = conv.participantUids.find((uid) => uid !== profile.uid);
            if (!peerUid) return null;
            const peer = profiles[peerUid];
            const isSelected = activeConversationId === conv.conversationId;
            const preview = decryptedPreviews[conv.conversationId] || 'End-to-End Encrypted Message';
            const peerIsTyping = Boolean(conv.typing?.[peerUid]);

            return (
              <button
                key={conv.conversationId}
                onClick={() => {
                  if (peer) onSelectConversation(conv, peerUid, peer);
                }}
                className={`w-full text-left p-3.5 flex items-center gap-3 transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-zinc-900 border-l-2 border-emerald-500'
                    : 'hover:bg-zinc-900/60'
                }`}
              >
                <div className="relative shrink-0">
                  {peer?.photoURL ? (
                    <img
                      src={peer.photoURL}
                      alt={peer.displayName}
                      className="w-12 h-12 rounded-xl object-cover border border-zinc-700"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-700 flex items-center justify-center text-white font-bold text-base shadow-sm">
                      {(peer?.displayName || 'U').charAt(0).toUpperCase()}
                    </div>
                  )}
                  {peer?.isOnline ? (
                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-zinc-950" />
                  ) : (
                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-zinc-600 border-2 border-zinc-950" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-sm font-semibold text-white truncate">
                      {peer?.displayName || 'User'}
                    </h4>
                    {conv.updatedAt && (
                      <span className="text-[10px] text-zinc-500 shrink-0 ml-2">
                        {new Date(conv.updatedAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    )}
                  </div>

                  <p className="text-xs truncate flex items-center gap-1 text-zinc-400">
                    {peerIsTyping ? (
                      <span className="text-emerald-400 font-medium animate-pulse">Typing...</span>
                    ) : (
                      <>
                        <Lock className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                        <span className="truncate">{preview}</span>
                      </>
                    )}
                  </p>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};
