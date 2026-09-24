import React from 'react';
import {
  MessageSquare,
  Users,
  Search,
  UserPlus,
  ShieldCheck,
  User,
  LogOut,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export type NavTab = 'chats' | 'friends' | 'find' | 'requests' | 'security' | 'profile';

interface NavigationProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  pendingRequestsCount: number;
  totalFriendsCount: number;
}

export const Navigation: React.FC<NavigationProps> = ({
  currentTab,
  onTabChange,
  pendingRequestsCount,
  totalFriendsCount,
}) => {
  const { profile, logout, networkOnline } = useAuth();

  const navItems: { id: NavTab; label: string; icon: React.ComponentType<{ className?: string }>; badge?: number }[] = [
    { id: 'chats', label: 'Chats', icon: MessageSquare },
    { id: 'friends', label: 'Friends', icon: Users, badge: totalFriendsCount > 0 ? totalFriendsCount : undefined },
    { id: 'find', label: 'Find Friends', icon: Search },
    { id: 'requests', label: 'Requests', icon: UserPlus, badge: pendingRequestsCount > 0 ? pendingRequestsCount : undefined },
    { id: 'security', label: 'Security & E2EE', icon: ShieldCheck },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  return (
    <aside className="w-full md:w-64 bg-zinc-900 border-r border-zinc-800 flex md:flex-col justify-between shrink-0 select-none">
      {/* Brand Header */}
      <div className="hidden md:block p-5 border-b border-zinc-800">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 p-0.5 shadow-md shadow-emerald-500/10">
            <div className="w-full h-full bg-zinc-950 rounded-[10px] flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
          <div>
            <h1 className="font-bold text-sm text-white tracking-tight leading-none">
              CipherWire
            </h1>
            <p className="text-[10px] text-zinc-400 mt-1 leading-none font-mono">
              E2EE Real-Time
            </p>
          </div>
        </div>

        {/* Network status */}
        <div className="mt-3 flex items-center justify-between text-[11px] px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800/80">
          <div className="flex items-center gap-1.5">
            {networkOnline ? (
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <WifiOff className="w-3.5 h-3.5 text-amber-400" />
            )}
            <span className={networkOnline ? 'text-zinc-300' : 'text-amber-400'}>
              {networkOnline ? 'Network Live' : 'Reconnecting...'}
            </span>
          </div>
          <span
            className={`w-2 h-2 rounded-full ${
              networkOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
            }`}
          />
        </div>
      </div>

      {/* Nav Links */}
      <nav className="flex-1 flex md:flex-col justify-around md:justify-start p-2 sm:p-3 gap-1 overflow-x-auto md:overflow-x-visible">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                isActive
                  ? 'bg-emerald-600/10 text-emerald-400 border border-emerald-500/20'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="hidden md:inline">{item.label}</span>

              {item.badge !== undefined && item.badge > 0 && (
                <span
                  className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    item.id === 'requests'
                      ? 'bg-emerald-500 text-zinc-950 font-bold'
                      : 'bg-zinc-800 text-zinc-300'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* User Footer (Desktop) */}
      <div className="hidden md:block p-3 border-t border-zinc-800">
        <div className="p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative shrink-0">
              {profile?.photoURL ? (
                <img
                  src={profile.photoURL}
                  alt={profile.displayName}
                  className="w-8 h-8 rounded-lg object-cover border border-zinc-700"
                />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-emerald-600 to-teal-700 flex items-center justify-center text-white font-bold text-xs">
                  {(profile?.displayName || 'U').charAt(0).toUpperCase()}
                </div>
              )}
              <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 border border-zinc-950" />
            </div>

            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate leading-none">
                {profile?.displayName}
              </p>
              <p className="text-[10px] text-zinc-500 truncate mt-1 font-mono">
                {profile?.email}
              </p>
            </div>
          </div>

          <button
            onClick={logout}
            className="p-1.5 text-zinc-400 hover:text-red-400 rounded-lg transition-colors cursor-pointer"
            title="Log Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
