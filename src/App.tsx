/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthModal } from './components/AuthModal';
import { Navigation, NavTab } from './components/Navigation';
import { ChatList } from './components/ChatList';
import { ChatRoom } from './components/ChatRoom';
import { FriendsView } from './components/FriendsView';
import { FindFriendsView } from './components/FindFriendsView';
import { FriendRequestsView } from './components/FriendRequestsView';
import { SecurityView } from './components/SecurityView';
import { ProfileView } from './components/ProfileView';
import { ProfileSetupModal } from './components/ProfileSetupModal';
import {
  Conversation,
  FriendRequest,
  Friendship,
  PublicProfile,
} from './types';
import {
  subscribeToFriendRequests,
  subscribeToFriends,
} from './services/friendService';
import {
  subscribeToConversations,
  getOrCreateConversation,
} from './services/chatService';
import { getPublicProfile } from './services/userService';
import { ShieldCheck, MessageSquare, WifiOff } from 'lucide-react';

const MainApp: React.FC = () => {
  const { user, profile, loading, refreshProfile } = useAuth();
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const isProfileIncomplete = Boolean(
    user && profile && (!profile.profileCompleted || !profile.username || profile.username.trim() === '')
  );

  const [currentTab, setCurrentTab] = useState<NavTab>('chats');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [friendRequests, setFriendRequests] = useState<{
    received: FriendRequest[];
    sent: FriendRequest[];
  }>({ received: [], sent: [] });

  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [activePeerUid, setActivePeerUid] = useState<string | null>(null);
  const [activePeerProfile, setActivePeerProfile] = useState<PublicProfile | null>(null);

  // Subscribe to real-time friend requests
  useEffect(() => {
    if (!profile) return;
    const unsub = subscribeToFriendRequests(profile.uid, (data) => {
      setFriendRequests(data);
    });
    return () => unsub();
  }, [profile]);

  // Subscribe to real-time mutual friends
  useEffect(() => {
    if (!profile) return;
    const unsub = subscribeToFriends(profile.uid, (list) => {
      setFriends(list);
    });
    return () => unsub();
  }, [profile]);

  // Subscribe to real-time conversations
  useEffect(() => {
    if (!profile) return;
    const unsub = subscribeToConversations(profile.uid, (convs) => {
      setConversations(convs);
      // If currently active conversation received an update, sync it
      if (activeConversation) {
        const updated = convs.find(
          (c) => c.conversationId === activeConversation.conversationId
        );
        if (updated) {
          setActiveConversation(updated);
        }
      }
    });
    return () => unsub();
  }, [profile, activeConversation]);

  // Handler to open chat with a friend
  const handleOpenChatWithFriend = async (
    peerUid: string,
    providedProfile?: PublicProfile
  ) => {
    if (!profile) return;

    let targetProfile = providedProfile;
    if (!targetProfile) {
      const fetched = await getPublicProfile(peerUid);
      if (fetched) targetProfile = fetched;
    }

    if (!targetProfile) {
      alert('Unable to load friend profile for chat.');
      return;
    }

    try {
      const convId = await getOrCreateConversation(
        profile.uid,
        peerUid,
        profile,
        targetProfile
      );

      // Find or construct conversation object
      let conv = conversations.find((c) => c.conversationId === convId);
      if (!conv) {
        conv = {
          conversationId: convId,
          participantUids: [profile.uid, peerUid],
          participantData: {
            [profile.uid]: {
              displayName: profile.displayName,
              photoURL: profile.photoURL || '',
              publicKey: profile.publicKey || '',
            },
            [peerUid]: {
              displayName: targetProfile.displayName,
              photoURL: targetProfile.photoURL || '',
              publicKey: targetProfile.publicKey || '',
            },
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }

      setActiveConversation(conv);
      setActivePeerUid(peerUid);
      setActivePeerProfile(targetProfile);
      setCurrentTab('chats');
    } catch (err) {
      console.error('Failed to open chat:', err);
    }
  };

  const handleSelectConversation = (
    conv: Conversation,
    peerUid: string,
    peerProf: PublicProfile
  ) => {
    setActiveConversation(conv);
    setActivePeerUid(peerUid);
    setActivePeerProfile(peerProf);
  };

  if (loading) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-zinc-950 text-white">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 p-0.5 shadow-xl shadow-emerald-500/20 mb-4 animate-pulse">
          <div className="w-full h-full bg-zinc-900 rounded-[14px] flex items-center justify-center text-emerald-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
        </div>
        <p className="text-sm font-semibold tracking-wider uppercase text-zinc-300">
          CipherWire
        </p>
        <p className="text-xs text-zinc-500 mt-1">Initializing secure keystore...</p>
      </div>
    );
  }

  if (!user) {
    return <AuthModal />;
  }

  return (
    <div className="h-screen w-screen flex flex-col md:flex-row bg-zinc-950 overflow-hidden font-sans text-zinc-100">
      {/* Mobile Top Header */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-zinc-900 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <span className="font-bold text-sm text-white">CipherWire</span>
        </div>
        <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          E2EE Active
        </span>
      </div>

      {/* Sidebar Navigation */}
      <Navigation
        currentTab={currentTab}
        onTabChange={(tab) => {
          setCurrentTab(tab);
          // If switching away from chats on mobile, clear active conversation view
          if (tab !== 'chats') {
            setActiveConversation(null);
          }
        }}
        pendingRequestsCount={friendRequests.received.length}
        totalFriendsCount={friends.length}
      />

      {/* Offline Network Warning Banner */}
      {!isOnline && (
        <div className="bg-amber-950/80 border-b border-amber-800/80 px-4 py-2 text-xs text-amber-200 flex items-center justify-center gap-2 transition-all">
          <WifiOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>
            You are operating in offline mode. CipherWire will automatically reconnect and sync when your network returns.
          </span>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex overflow-hidden relative">
        {currentTab === 'chats' && (
          <div className="flex-1 flex w-full h-full overflow-hidden">
            {/* Conversations list column: visible on desktop, or on mobile when no active conversation */}
            <div
              className={`w-full md:w-80 lg:w-96 h-full shrink-0 ${
                activeConversation ? 'hidden md:block' : 'block'
              }`}
            >
              <ChatList
                conversations={conversations}
                activeConversationId={activeConversation?.conversationId || null}
                onSelectConversation={handleSelectConversation}
                onNavigateToFind={() => setCurrentTab('find')}
              />
            </div>

            {/* Active chat window column */}
            <div
              className={`flex-1 h-full bg-zinc-950 ${
                activeConversation ? 'block' : 'hidden md:flex'
              }`}
            >
              {activeConversation && activePeerUid ? (
                <ChatRoom
                  conversation={activeConversation}
                  peerUid={activePeerUid}
                  initialPeerProfile={activePeerProfile}
                  onBack={() => setActiveConversation(null)}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-center p-8 text-zinc-500 select-none">
                  <div className="w-16 h-16 rounded-3xl bg-zinc-900 border border-zinc-800/80 flex items-center justify-center text-zinc-400 mb-4 shadow-inner">
                    <MessageSquare className="w-8 h-8 text-emerald-500/80" />
                  </div>
                  <h3 className="text-base font-semibold text-zinc-200">
                    Your Encrypted Messages
                  </h3>
                  <p className="text-xs text-zinc-400 max-w-sm mt-1.5 leading-relaxed">
                    Select a conversation from the left or search for a friend by email to begin chatting securely.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {currentTab === 'friends' && (
          <div className="flex-1 overflow-y-auto w-full">
            <FriendsView
              friends={friends}
              onOpenChat={handleOpenChatWithFriend}
              onNavigateToFind={() => setCurrentTab('find')}
            />
          </div>
        )}

        {currentTab === 'find' && (
          <div className="flex-1 overflow-y-auto w-full">
            <FindFriendsView
              onNavigateToRequests={() => setCurrentTab('requests')}
            />
          </div>
        )}

        {currentTab === 'requests' && (
          <div className="flex-1 overflow-y-auto w-full">
            <FriendRequestsView
              requests={friendRequests}
              onStartChatWithFriend={(peerUid) => handleOpenChatWithFriend(peerUid)}
            />
          </div>
        )}

        {currentTab === 'security' && (
          <div className="flex-1 overflow-y-auto w-full">
            <SecurityView />
          </div>
        )}

        {currentTab === 'profile' && (
          <div className="flex-1 overflow-y-auto w-full">
            <ProfileView />
          </div>
        )}

        {/* Mandatory Profile Setup Modal triggered right after signup / first login */}
        <ProfileSetupModal
          isOpen={isProfileIncomplete}
          onComplete={() => refreshProfile()}
        />
      </main>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
