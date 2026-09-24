import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  ArrowLeft,
  Send,
  ShieldCheck,
  Lock,
  Check,
  CheckCheck,
  Clock,
  AlertTriangle,
  Smile,
} from 'lucide-react';
import { Conversation, Message, PublicProfile } from '../types';
import { useAuth } from '../context/AuthContext';
import {
  subscribeToMessages,
  sendEncryptedMessage,
  markMessageAsRead,
  setTypingStatus,
} from '../services/chatService';
import { subscribeToPublicProfile } from '../services/userService';
import { SecurityFingerprintModal } from './SecurityFingerprintModal';

interface ChatRoomProps {
  conversation: Conversation;
  peerUid: string;
  initialPeerProfile?: PublicProfile | null;
  onBack: () => void;
}

export const ChatRoom: React.FC<ChatRoomProps> = ({
  conversation,
  peerUid,
  initialPeerProfile,
  onBack,
}) => {
  const { profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState<string>('');
  const [sending, setSending] = useState<boolean>(false);
  const [peerProfile, setPeerProfile] = useState<PublicProfile | null>(initialPeerProfile || null);
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState<boolean>(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Subscribe to peer's live presence
  useEffect(() => {
    const unsub = subscribeToPublicProfile(peerUid, (liveProfile) => {
      if (liveProfile) setPeerProfile(liveProfile);
    });
    return () => unsub();
  }, [peerUid]);

  // Subscribe to messages in this conversation
  useEffect(() => {
    if (!profile) return;
    const unsub = subscribeToMessages(
      conversation.conversationId,
      profile.uid,
      peerProfile?.publicKey || null,
      (msgs) => {
        setMessages(msgs);
        // Mark unread messages sent by peer as read
        msgs.forEach((m) => {
          if (m.senderId === peerUid && m.status !== 'read') {
            markMessageAsRead(conversation.conversationId, m.messageId);
          }
        });
      }
    );
    return () => unsub();
  }, [conversation.conversationId, profile, peerUid, peerProfile?.publicKey]);

  // Scroll to bottom
  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  useEffect(() => {
    scrollToBottom(false);
  }, [messages.length, scrollToBottom]);

  // Handle typing presence
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);

    if (!profile) return;

    // Notify typing status
    setTypingStatus(conversation.conversationId, profile.uid, true);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      setTypingStatus(conversation.conversationId, profile.uid, false);
    }, 2000);
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = inputText.trim();
    if (!text || !profile || sending) return;

    setSending(true);
    setInputText('');

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    setTypingStatus(conversation.conversationId, profile.uid, false);

    try {
      await sendEncryptedMessage(
        conversation.conversationId,
        profile.uid,
        peerUid,
        text
      );
      scrollToBottom(true);
    } catch (err: unknown) {
      console.error('Failed to send message:', err);
      // Restore input text on failure
      setInputText(text);
    } finally {
      setSending(false);
    }
  };

  const peerIsTyping = Boolean(conversation.typing?.[peerUid]);

  const quickEmojis = ['👍', '❤️', '😊', '🎉', '🔒', '👏', '🔥', '✨'];

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-100">
      {/* Top Header */}
      <div className="h-16 px-4 border-b border-zinc-800/80 bg-zinc-900/80 backdrop-blur-md flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="md:hidden p-2 text-zinc-400 hover:text-white rounded-lg -ml-2"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="relative">
            {peerProfile?.photoURL ? (
              <img
                src={peerProfile.photoURL}
                alt={peerProfile.displayName}
                className="w-10 h-10 rounded-xl object-cover border border-zinc-700"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-700 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                {(peerProfile?.displayName || 'U').charAt(0).toUpperCase()}
              </div>
            )}
            {peerProfile?.isOnline ? (
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-zinc-900" />
            ) : (
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-zinc-600 border-2 border-zinc-900" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="font-semibold text-sm text-white leading-none">
                {peerProfile?.displayName || 'User'}
              </h3>
              <span className="text-[10px] text-emerald-400 font-semibold px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                E2EE
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 mt-1 leading-none">
              {peerIsTyping ? (
                <span className="text-emerald-400 font-medium animate-pulse">Typing...</span>
              ) : peerProfile?.isOnline ? (
                <span className="text-emerald-400 font-medium">Online</span>
              ) : peerProfile?.lastSeen ? (
                `Last seen ${new Date(peerProfile.lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
              ) : (
                'Offline'
              )}
            </p>
          </div>
        </div>

        {/* Security Fingerprint trigger */}
        <button
          onClick={() => setIsSecurityModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-800/60 rounded-xl text-emerald-300 text-xs font-medium transition-all shadow-sm cursor-pointer"
          title="Inspect End-to-End Encryption Safety Code"
        >
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span className="hidden sm:inline">Verify Encryption</span>
        </button>
      </div>

      {/* Message Stream */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
        {/* Security notice banner */}
        <div className="max-w-md mx-auto my-3 p-3 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl text-center space-y-1">
          <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-emerald-400">
            <Lock className="w-3.5 h-3.5" />
            <span>End-to-End Encrypted</span>
          </div>
          <p className="text-[11px] text-zinc-400 leading-relaxed">
            Messages are encrypted on your device with ECDH P-256 and AES-256-GCM. Plaintext is never stored on the server.
          </p>
        </div>

        {messages.map((msg) => {
          const isMe = msg.senderId === profile?.uid;

          return (
            <div
              key={msg.messageId}
              className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group`}
            >
              <div
                className={`relative max-w-[85%] sm:max-w-md px-4 py-2.5 rounded-2xl text-sm shadow-md transition-all ${
                  isMe
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-tr-none'
                    : 'bg-zinc-800/90 text-zinc-100 border border-zinc-700/60 rounded-tl-none'
                }`}
              >
                {msg.decryptError ? (
                  <div className="flex items-center gap-1.5 text-amber-300 text-xs font-mono">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{msg.decryptedText}</span>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap break-words leading-relaxed select-text font-sans">
                    {msg.decryptedText || '...'}
                  </p>
                )}

                <div
                  className={`flex items-center justify-end gap-1.5 mt-1 text-[10px] ${
                    isMe ? 'text-emerald-200/80' : 'text-zinc-400'
                  }`}
                >
                  <span title="256-bit AES-GCM Encrypted">
                    <Lock className="w-2.5 h-2.5 opacity-60" />
                  </span>
                  <span>
                    {new Date(msg.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  {isMe && (
                    <span>
                      {msg.status === 'sending' && <Clock className="w-3 h-3" />}
                      {msg.status === 'sent' && <Check className="w-3 h-3" />}
                      {msg.status === 'delivered' && <CheckCheck className="w-3 h-3 text-zinc-300" />}
                      {msg.status === 'read' && <CheckCheck className="w-3.5 h-3.5 text-cyan-300 font-bold" />}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Real-time typing bubble */}
        {peerIsTyping && (
          <div className="flex items-center gap-2 text-zinc-400 text-xs py-1">
            <div className="bg-zinc-800 border border-zinc-700/60 rounded-2xl px-3 py-2 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span className="text-[11px] text-zinc-500 font-mono">
              {peerProfile?.displayName || 'User'} is typing...
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick emoji drawer */}
      {showEmojiPicker && (
        <div className="px-4 py-2 bg-zinc-900 border-t border-zinc-800 flex items-center gap-2 overflow-x-auto shrink-0">
          {quickEmojis.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => {
                setInputText((prev) => prev + emoji);
                setShowEmojiPicker(false);
              }}
              className="text-lg p-1.5 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Message Input Bar */}
      <div className="p-3 sm:p-4 bg-zinc-900/90 border-t border-zinc-800/80 shrink-0">
        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowEmojiPicker((prev) => !prev)}
            className={`p-2.5 rounded-xl border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer ${
              showEmojiPicker ? 'bg-zinc-800 text-emerald-400' : 'bg-zinc-950'
            }`}
            title="Emoji reactions"
          >
            <Smile className="w-5 h-5" />
          </button>

          <input
            type="text"
            value={inputText}
            onChange={handleInputChange}
            placeholder="Type an end-to-end encrypted message..."
            className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all shadow-inner"
          />

          <button
            type="submit"
            disabled={sending || !inputText.trim()}
            className="p-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl shadow-lg shadow-emerald-950/40 disabled:opacity-40 transition-all cursor-pointer shrink-0"
            aria-label="Send encrypted message"
          >
            {sending ? (
              <span className="inline-block w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </form>
      </div>

      {/* Verification modal */}
      {profile?.publicKey && peerProfile?.publicKey && (
        <SecurityFingerprintModal
          isOpen={isSecurityModalOpen}
          onClose={() => setIsSecurityModalOpen(false)}
          myPublicKey={profile.publicKey}
          peerPublicKey={peerProfile.publicKey}
          peerName={peerProfile.displayName}
        />
      )}
    </div>
  );
};
