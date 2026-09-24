import React, { useEffect, useState } from 'react';
import { ShieldCheck, Copy, Check, Lock, X } from 'lucide-react';
import { computeSafetyFingerprint } from '../crypto/e2ee';

interface SecurityFingerprintModalProps {
  isOpen: boolean;
  onClose: () => void;
  myPublicKey: string;
  peerPublicKey: string;
  peerName: string;
}

export const SecurityFingerprintModal: React.FC<SecurityFingerprintModalProps> = ({
  isOpen,
  onClose,
  myPublicKey,
  peerPublicKey,
  peerName,
}) => {
  const [fingerprint, setFingerprint] = useState<string>('Computing verification code...');
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen || !myPublicKey || !peerPublicKey) return;
    computeSafetyFingerprint(myPublicKey, peerPublicKey).then(setFingerprint);
  }, [isOpen, myPublicKey, peerPublicKey]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(fingerprint);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl text-zinc-100">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white rounded-lg transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-semibold text-lg text-white">E2EE Security Code</h3>
            <p className="text-xs text-zinc-400">Verified conversation with {peerName}</p>
          </div>
        </div>

        <div className="bg-zinc-950 border border-zinc-800/80 rounded-xl p-4 mb-4">
          <p className="text-xs text-zinc-400 mb-2 font-mono uppercase tracking-wider">
            Safety Fingerprint (SHA-256)
          </p>
          <div className="font-mono text-sm sm:text-base text-emerald-300 font-medium tracking-widest break-all select-all text-center py-2 bg-emerald-950/20 rounded-lg border border-emerald-900/40">
            {fingerprint}
          </div>
          <div className="mt-3 flex justify-end">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 text-xs text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-lg transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy Code'}
            </button>
          </div>
        </div>

        <div className="space-y-2 text-xs text-zinc-400 leading-relaxed border-t border-zinc-800/80 pt-4">
          <div className="flex items-start gap-2">
            <Lock className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <p>
              Messages between you and <span className="text-white font-medium">{peerName}</span> are encrypted end-to-end using Elliptic Curve Diffie-Hellman (P-256) and 256-bit AES-GCM.
            </p>
          </div>
          <p className="text-zinc-500 text-[11px] pl-6">
            Compare this code with {peerName} over a phone call or in person to verify that no man-in-the-middle has intercepted your cryptographic keys.
          </p>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-medium transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
