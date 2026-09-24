import React, { useState } from 'react';
import {
  Lock,
  Mail,
  User,
  KeyRound,
  Shield,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Info,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const AuthModal: React.FC = () => {
  const {
    loginWithEmail,
    signUpWithEmail,
    loginWithGoogle,
    loginWithFacebook,
    resetPassword,
    authError,
    clearAuthError,
  } = useAuth();

  const [mode, setMode] = useState<'login' | 'signup' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resetSuccessMessage, setResetSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAuthError();
    setResetSuccessMessage(null);

    if (!email.trim()) return;

    setIsSubmitting(true);
    try {
      if (mode === 'login') {
        await loginWithEmail(email, password);
      } else if (mode === 'signup') {
        await signUpWithEmail(email, password, displayName);
      } else if (mode === 'reset') {
        await resetPassword(email);
        setResetSuccessMessage('Password reset link sent! Please check your email inbox.');
      }
    } catch {
      // Error handled in AuthContext
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleAuth = async () => {
    clearAuthError();
    setIsSubmitting(true);
    try {
      await loginWithGoogle();
    } catch {
      // Handled in AuthContext
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFacebookAuth = async () => {
    clearAuthError();
    setIsSubmitting(true);
    try {
      await loginWithFacebook();
    } catch {
      // Handled in AuthContext
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-zinc-950 p-4 font-sans text-zinc-100">
      <div className="w-full max-w-md bg-zinc-900/90 border border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-md relative overflow-hidden">
        {/* Glow accent */}
        <div className="absolute -top-24 -left-24 w-52 h-52 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-52 h-52 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Brand header */}
        <div className="flex flex-col items-center text-center mb-8 relative">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 p-0.5 shadow-lg shadow-emerald-500/20 mb-3">
            <div className="w-full h-full bg-zinc-900 rounded-[14px] flex items-center justify-center text-emerald-400">
              <Shield className="w-7 h-7" />
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            CipherWire
            <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              E2EE
            </span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1 max-w-xs">
            Zero-knowledge, real-time messaging with client-side ECDH P-256 and AES-GCM cryptography.
          </p>
        </div>

        {/* Auth error notification */}
        {authError && (
          <div className="mb-5 p-4 rounded-2xl bg-red-950/40 border border-red-800/60 text-red-200 text-xs space-y-2">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium leading-relaxed">{authError}</div>
            </div>
            {authError.includes('Firebase Console') && (
              <div className="pt-2 border-t border-red-900/40 text-[11px] text-zinc-300 space-y-1">
                <p>
                  To enable Email/Password or Facebook login:
                </p>
                <ol className="list-decimal list-inside text-zinc-400 space-y-0.5 pl-1">
                  <li>Visit your Firebase Console &rarr; Authentication &rarr; Sign-in method</li>
                  <li>Click on <span className="text-white font-medium">Email/Password</span> and turn on <span className="text-white font-medium">Enable</span></li>
                  <li>Click Save</li>
                </ol>
                <p className="pt-1 text-emerald-400 font-medium">
                  Tip: &quot;Continue with Google&quot; is already enabled and works immediately!
                </p>
              </div>
            )}
          </div>
        )}

        {/* Primary 1-Click Google Sign-In (Pre-configured in AI Studio) */}
        <div className="mb-6 space-y-2">
          <button
            type="button"
            onClick={handleGoogleAuth}
            disabled={isSubmitting}
            className="w-full py-3 px-4 bg-zinc-950 hover:bg-zinc-800 border border-zinc-700/80 rounded-2xl text-xs font-semibold text-white transition-all shadow-md flex items-center justify-center gap-3 cursor-pointer group disabled:opacity-50"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Continue with Google (Pre-Enabled)</span>
          </button>
        </div>

        {/* Divider */}
        <div className="relative mb-6 flex items-center justify-center">
          <div className="w-full border-t border-zinc-800" />
          <span className="bg-zinc-900 px-3 text-[11px] uppercase tracking-wider text-zinc-500 font-mono absolute">
            Or with email
          </span>
        </div>

        {/* Reset success notification */}
        {resetSuccessMessage && (
          <div className="mb-5 p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-emerald-200 text-xs flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="flex-1 leading-relaxed">{resetSuccessMessage}</div>
          </div>
        )}

        {/* Tabs */}
        {mode !== 'reset' && (
          <div className="grid grid-cols-2 p-1 bg-zinc-950/80 border border-zinc-800/80 rounded-xl mb-6">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                clearAuthError();
              }}
              className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                mode === 'login'
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                clearAuthError();
              }}
              className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                mode === 'signup'
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Create Account
            </button>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Full Display Name
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Alice Walker"
                  className="w-full bg-zinc-950/60 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="alice@example.com"
                className="w-full bg-zinc-950/60 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
              />
            </div>
          </div>

          {mode !== 'reset' && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-zinc-300">
                  Password
                </label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('reset');
                      clearAuthError();
                    }}
                    className="text-[11px] text-emerald-400 hover:text-emerald-300 transition-colors"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-zinc-950/60 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium py-2.5 px-4 rounded-xl text-sm transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/30 disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? (
              <span className="inline-block w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                {mode === 'login' && 'Sign In'}
                {mode === 'signup' && 'Create Free Account'}
                {mode === 'reset' && 'Send Reset Link'}
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {mode === 'reset' && (
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                clearAuthError();
              }}
              className="text-xs text-zinc-400 hover:text-white transition-colors"
            >
              ← Back to Sign In
            </button>
          </div>
        )}

        {/* Other Providers */}
        <div className="mt-6 pt-4 border-t border-zinc-800/80">
          <button
            type="button"
            onClick={handleFacebookAuth}
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-3 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-xs font-medium text-zinc-300 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <svg className="w-4 h-4 fill-[#1877F2]" viewBox="0 0 24 24">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
            <span>Continue with Facebook</span>
          </button>
        </div>

        {/* Security badge footer */}
        <div className="mt-6 pt-4 border-t border-zinc-800/60 flex items-center justify-center gap-2 text-[11px] text-zinc-500">
          <Lock className="w-3 h-3 text-emerald-400" />
          <span>Device-generated ECDH keypair is never uploaded</span>
        </div>
      </div>
    </div>
  );
};
