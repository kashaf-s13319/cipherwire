import React, { useState } from 'react';
import { UserCheck, UserX, Clock, ArrowDownLeft, ArrowUpRight, Check, Shield } from 'lucide-react';
import { FriendRequest } from '../types';
import { useAuth } from '../context/AuthContext';
import {
  acceptFriendRequest,
  rejectFriendRequest,
  cancelFriendRequest,
} from '../services/friendService';

interface FriendRequestsViewProps {
  requests: { received: FriendRequest[]; sent: FriendRequest[] };
  onStartChatWithFriend: (peerUid: string) => void;
}

export const FriendRequestsView: React.FC<FriendRequestsViewProps> = ({
  requests,
  onStartChatWithFriend,
}) => {
  const { profile } = useAuth();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const handleAccept = async (req: FriendRequest) => {
    if (!profile) return;
    setProcessingId(req.requestId);
    try {
      await acceptFriendRequest(req, profile);
      setSuccessNotice(`You and ${req.fromDisplayName || 'User'} are now friends!`);
      setTimeout(() => {
        setSuccessNotice(null);
        onStartChatWithFriend(req.fromUid);
      }, 1500);
    } catch (err: unknown) {
      console.error('Accept request failed:', err);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (requestId: string) => {
    setProcessingId(requestId);
    try {
      await rejectFriendRequest(requestId);
    } catch (err: unknown) {
      console.error('Reject request failed:', err);
    } finally {
      setProcessingId(null);
    }
  };

  const handleCancel = async (requestId: string) => {
    setProcessingId(requestId);
    try {
      await cancelFriendRequest(requestId);
    } catch (err: unknown) {
      console.error('Cancel request failed:', err);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Clock className="w-5 h-5 text-emerald-400" />
          Friend Requests
        </h2>
        <p className="text-xs sm:text-sm text-zinc-400 mt-1">
          Review incoming invitations and monitor your outgoing requests in real time.
        </p>
      </div>

      {successNotice && (
        <div className="p-3.5 bg-emerald-950/50 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in duration-200">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{successNotice}</span>
        </div>
      )}

      {/* Received Requests */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-zinc-400">
          <span className="flex items-center gap-1.5">
            <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
            Received Requests ({requests.received.length})
          </span>
        </div>

        {requests.received.length === 0 ? (
          <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-6 text-center text-zinc-500 text-xs">
            No incoming friend requests right now.
          </div>
        ) : (
          <div className="space-y-2.5">
            {requests.received.map((req) => (
              <div
                key={req.requestId}
                className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md"
              >
                <div className="flex items-center gap-3">
                  {req.fromPhotoURL ? (
                    <img
                      src={req.fromPhotoURL}
                      alt={req.fromDisplayName}
                      className="w-11 h-11 rounded-xl object-cover border border-zinc-700"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-700 flex items-center justify-center text-white font-bold text-base shadow-sm">
                      {(req.fromDisplayName || 'U').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h4 className="text-sm font-semibold text-white">
                      {req.fromDisplayName || 'Registered User'}
                    </h4>
                    <p className="text-xs text-zinc-400 font-mono">{req.fromEmail}</p>
                    <span className="text-[10px] text-zinc-500">
                      Sent {new Date(req.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    onClick={() => handleReject(req.requestId)}
                    disabled={processingId === req.requestId}
                    className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                  >
                    <UserX className="w-3.5 h-3.5 text-red-400" />
                    <span>Decline</span>
                  </button>
                  <button
                    onClick={() => handleAccept(req)}
                    disabled={processingId === req.requestId}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-md shadow-emerald-950/30 disabled:opacity-50 cursor-pointer"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Accept</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sent Requests */}
      <div className="space-y-3 pt-4 border-t border-zinc-800">
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-zinc-400">
          <span className="flex items-center gap-1.5">
            <ArrowUpRight className="w-4 h-4 text-cyan-400" />
            Sent Pending Requests ({requests.sent.length})
          </span>
        </div>

        {requests.sent.length === 0 ? (
          <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-6 text-center text-zinc-500 text-xs">
            You don&apos;t have any pending sent requests.
          </div>
        ) : (
          <div className="space-y-2.5">
            {requests.sent.map((req) => (
              <div
                key={req.requestId}
                className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-4 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center text-zinc-300 font-semibold text-sm">
                    {(req.toDisplayName || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-white">
                      {req.toDisplayName || 'Pending recipient'}
                    </h4>
                    <p className="text-xs text-zinc-400 font-mono">{req.toEmail}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-amber-400/90 font-medium px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Pending
                  </span>
                  <button
                    onClick={() => handleCancel(req.requestId)}
                    disabled={processingId === req.requestId}
                    className="text-xs text-zinc-400 hover:text-red-400 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-zinc-900/30 border border-zinc-800/60 rounded-2xl p-4 text-xs text-zinc-400 flex items-center gap-2">
        <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
        <span>
          Accepting a request automatically exchanges public ECDH cryptographic keys and opens an end-to-end encrypted channel.
        </span>
      </div>
    </div>
  );
};
