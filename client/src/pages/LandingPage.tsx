import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Play,
  MessageSquare,
  Zap,
  ArrowRight,
  Tv,
  Crown,
  Smile,
  Server,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useHealthCheck } from '../hooks/useHealthCheck';
import { useSocket } from '../hooks/useSocket';
import { RoleBadge } from '../components/ui/RoleBadge';

export const LandingPage: React.FC = () => {
  const { health, loading: healthLoading, error: healthError, refetch } = useHealthCheck();
  const { isConnected } = useSocket();
  const navigate = useNavigate();

  return (
    <div className="space-y-20 py-8">
      {/* Hero Section */}
      <section className="text-center space-y-6 max-w-4xl mx-auto pt-4">
        <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold">
          <Zap className="w-3.5 h-3.5 text-indigo-400" />
          <span>Real-time YouTube Synchronized Playback</span>
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-tight text-slate-100">
          Watch YouTube Videos Together with Friends in Perfect <span className="text-indigo-400">Sync</span>
        </h1>

        <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
          Create custom watch party rooms, share unique invite links, enforce role-based playback permissions, and chat in real-time.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Button
            variant="primary"
            size="lg"
            onClick={() => navigate('/signup')}
            rightIcon={<ArrowRight className="w-4 h-4" />}
          >
            Create a Watch Party
          </Button>
          <Button
            variant="secondary"
            size="lg"
            onClick={() => navigate('/dashboard')}
          >
            Join Existing Room
          </Button>
        </div>
      </section>

      {/* Visual Product Preview */}
      <section className="max-w-5xl mx-auto rounded-2xl bg-slate-900 border border-slate-800 p-4 sm:p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block"></span>
            <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block"></span>
            <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block"></span>
            <span className="text-xs font-mono text-slate-400 ml-2">syncstream.party/room/demo-party</span>
          </div>
          <div className="flex items-center space-x-2 text-xs text-slate-400">
            <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
              LIVE SYNC
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Main Player Mockup */}
          <div className="lg:col-span-2 space-y-3">
            <div className="aspect-video bg-slate-950 rounded-xl border border-slate-800 relative flex items-center justify-center overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent"></div>
              <div className="text-center space-y-2 z-10">
                <div className="p-4 bg-indigo-600/90 text-white rounded-full mx-auto w-fit shadow-lg shadow-indigo-600/40">
                  <Play className="w-8 h-8 fill-current ml-0.5" />
                </div>
                <p className="text-xs font-semibold text-slate-300">Synchronized YouTube Player</p>
                <p className="text-[11px] text-slate-500">Host control enabled • 03:42 / 12:15</p>
              </div>
            </div>

            {/* Playback Controls Bar Mockup */}
            <div className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-xl flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center space-x-3">
                <Button variant="ghost" size="sm" className="px-2">⏸</Button>
                <div className="w-36 sm:w-64 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-indigo-500 h-full w-1/3"></div>
                </div>
                <span className="font-mono text-[11px]">03:42</span>
              </div>
              <RoleBadge role="HOST" size="sm" />
            </div>
          </div>

          {/* Participants & Chat Mockup */}
          <div className="space-y-3 flex flex-col h-full justify-between">
            {/* Participants */}
            <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 space-y-2">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                <span>Participants</span>
                <span className="text-indigo-400 font-normal">3 online</span>
              </h4>
              <ul className="space-y-1.5 text-xs">
                <li className="flex items-center justify-between p-1.5 rounded bg-slate-900/80">
                  <span className="font-medium text-slate-200">Alex (You)</span>
                  <RoleBadge role="HOST" size="sm" />
                </li>
                <li className="flex items-center justify-between p-1.5 rounded bg-slate-900/40">
                  <span className="text-slate-300">Sarah_M</span>
                  <RoleBadge role="MODERATOR" size="sm" />
                </li>
                <li className="flex items-center justify-between p-1.5 rounded bg-slate-900/40">
                  <span className="text-slate-400">David_K</span>
                  <RoleBadge role="PARTICIPANT" size="sm" />
                </li>
              </ul>
            </div>

            {/* Chat preview */}
            <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 space-y-2 flex-1 flex flex-col justify-between">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Live Chat</h4>
              <div className="space-y-1.5 text-xs">
                <p className="text-slate-400"><span className="font-semibold text-slate-200">Sarah_M:</span> Loved this scene! 🎉</p>
                <p className="text-slate-400"><span className="font-semibold text-slate-200">Alex:</span> Pausing for a sec to fetch popcorn</p>
              </div>
              <div className="pt-2 border-t border-slate-800 flex items-center space-x-2">
                <input
                  type="text"
                  placeholder="Type a message..."
                  disabled
                  className="w-full bg-slate-900 border border-slate-800 rounded text-xs px-2.5 py-1 text-slate-400 cursor-not-allowed"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="space-y-10 max-w-6xl mx-auto pt-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-100">Powerful Features for Watch Parties</h2>
          <p className="text-sm text-slate-400 max-w-xl mx-auto">
            Everything you need for seamless synchronized playback and room governance.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-3">
            <div className="p-3 bg-indigo-500/10 w-fit rounded-lg text-indigo-400">
              <Tv className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-100">Synchronized Playback</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Every pause, play, seek, and video swap happens in real-time across all connected party members.
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-3">
            <div className="p-3 bg-purple-500/10 w-fit rounded-lg text-purple-400">
              <Crown className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-100">Role-Based Controls</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Assign Host, Moderator, and Participant roles to manage room controls and playback authorization.
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-3">
            <div className="p-3 bg-emerald-500/10 w-fit rounded-lg text-emerald-400">
              <MessageSquare className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-100">Live Room Chat</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Discuss videos as they play with persistent room chat, user tags, and timestamps.
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-3">
            <div className="p-3 bg-amber-500/10 w-fit rounded-lg text-amber-400">
              <Smile className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-100">Emoji Reactions & Requests</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Send floating emoji reactions and submit approval requests for video controls.
            </p>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="space-y-10 max-w-5xl mx-auto pt-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-100">How It Works</h2>
          <p className="text-sm text-slate-400">Get started in three simple steps.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 text-center space-y-3 relative">
            <div className="w-8 h-8 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center mx-auto text-sm">
              1
            </div>
            <h3 className="text-base font-bold text-slate-200">Create a Room</h3>
            <p className="text-xs text-slate-400">
              Set up a public or private room from your dashboard in one click.
            </p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 text-center space-y-3 relative">
            <div className="w-8 h-8 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center mx-auto text-sm">
              2
            </div>
            <h3 className="text-base font-bold text-slate-200">Share Invite Link</h3>
            <p className="text-xs text-slate-400">
              Copy your room code or direct link and send it to your friends.
            </p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 text-center space-y-3 relative">
            <div className="w-8 h-8 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center mx-auto text-sm">
              3
            </div>
            <h3 className="text-base font-bold text-slate-200">Enjoy in Sync</h3>
            <p className="text-xs text-slate-400">
              Paste any YouTube video URL and start watching together in real time.
            </p>
          </div>
        </div>
      </section>

      {/* Backend & Socket Health Monitor */}
      <section className="max-w-3xl mx-auto bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <Server className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-semibold text-slate-200">System Gateway Monitor</h3>
          </div>
          <button
            onClick={refetch}
            disabled={healthLoading}
            className="p-1 rounded bg-slate-800 text-slate-400 hover:text-slate-200 transition"
            title="Refresh status"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${healthLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 text-xs">
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950/60 border border-slate-800">
            <span className="text-slate-400">Express API (/api/health):</span>
            {healthLoading ? (
              <span className="text-slate-500 animate-pulse">Checking...</span>
            ) : healthError ? (
              <span className="text-rose-400 font-medium">OFFLINE</span>
            ) : (
              <span className="text-emerald-400 font-semibold flex items-center space-x-1">
                <CheckCircle2 className="w-3.5 h-3.5 inline mr-1" />
                ONLINE ({health?.database})
              </span>
            )}
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950/60 border border-slate-800">
            <span className="text-slate-400">Socket.IO Gateway:</span>
            <span className={`font-semibold ${isConnected ? 'text-emerald-400' : 'text-slate-400'}`}>
              {isConnected ? 'READY' : 'STANDBY'}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
};
