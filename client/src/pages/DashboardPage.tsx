import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, LogIn, Search, Tv, RefreshCw, AlertCircle } from 'lucide-react';
import { Room } from '../types';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getRooms, createRoom, joinRoom } from '../services/roomApi';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { RoomCard } from '../components/ui/RoomCard';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingIndicator } from '../components/ui/LoadingIndicator';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');

  // Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);

  // Form States
  const [createTitle, setCreateTitle] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createIsPrivate, setCreateIsPrivate] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);

  const fetchUserRooms = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getRooms();
      if (response.success && response.data) {
        setRooms(response.data);
      } else {
        setRooms([]);
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        // Safe fallback for Phase 2 pending room backend API endpoint
        setRooms([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUserRooms();
  }, [fetchUserRooms]);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    if (!createTitle.trim()) {
      setCreateError('Room title is required');
      return;
    }

    setIsCreating(true);
    try {
      const response = await createRoom({
        title: createTitle.trim(),
        description: createDescription.trim() || undefined,
        isPrivate: createIsPrivate,
      });

      if (response.success && response.data) {
        addToast('Room created successfully!', 'success');
        setIsCreateModalOpen(false);
        setCreateTitle('');
        setCreateDescription('');
        navigate(`/room/${response.data.id || response.data.code}`);
      } else {
        setCreateError(response.message || 'Failed to create room.');
      }
    } catch {
      setCreateError('Backend room creation endpoint is pending implementation');
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError(null);

    if (!joinCode.trim()) {
      setJoinError('Invite code is required');
      return;
    }

    setIsJoining(true);
    try {
      const response = await joinRoom({ code: joinCode.trim() });

      if (response.success && response.data) {
        addToast('Joined room successfully!', 'success');
        setIsJoinModalOpen(false);
        setJoinCode('');
        navigate(`/room/${response.data.id || response.data.code}`);
      } else {
        setJoinError(response.message || 'Invalid or expired room invite code');
      }
    } catch {
      // In Phase 2 frontend preview: navigate directly to target room code
      const targetCode = joinCode.trim();
      setIsJoinModalOpen(false);
      setJoinCode('');
      navigate(`/room/${targetCode}`);
    } finally {
      setIsJoining(false);
    }
  };

  const filteredRooms = rooms.filter(
    (room) =>
      room.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      room.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const createdRooms = filteredRooms.filter((r) => r.hostId === user?.id);
  const joinedRooms = filteredRooms.filter((r) => r.hostId !== user?.id);

  return (
    <div className="space-y-8 py-6">
      {/* Dashboard Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">
            Welcome back, <span className="text-indigo-400">{user?.username || 'Watcher'}</span> 👋
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage your watch parties, join rooms via invite codes, or launch a new session.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <Button
            variant="secondary"
            onClick={() => setIsJoinModalOpen(true)}
            leftIcon={<LogIn className="w-4 h-4" />}
            className="w-full md:w-auto"
          >
            Join Room
          </Button>
          <Button
            variant="primary"
            onClick={() => setIsCreateModalOpen(true)}
            leftIcon={<Plus className="w-4 h-4" />}
            className="w-full md:w-auto"
          >
            Create Room
          </Button>
        </div>
      </div>

      {/* Search & Refetch Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="w-full sm:w-72">
          <Input
            placeholder="Search by title or code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="w-4 h-4" />}
          />
        </div>

        <button
          onClick={fetchUserRooms}
          className="inline-flex items-center space-x-1.5 text-xs text-slate-400 hover:text-slate-200 transition bg-slate-900 border border-slate-800 px-3 py-2 rounded-lg self-end sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh List</span>
        </button>
      </div>

      {/* Main Content Areas */}
      {loading ? (
        <LoadingIndicator message="Loading watch rooms..." />
      ) : error ? (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-300 flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Created Rooms */}
          <section className="space-y-4">
            <h2 className="text-lg font-bold text-slate-200 flex items-center space-x-2">
              <Tv className="w-5 h-5 text-indigo-400" />
              <span>Rooms You Host</span>
              <span className="text-xs font-normal text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
                {createdRooms.length}
              </span>
            </h2>

            {createdRooms.length === 0 ? (
              <EmptyState
                title="No hosted rooms yet"
                description="You haven't created any watch rooms yet. Start a room to invite friends!"
                action={
                  <Button variant="primary" size="sm" onClick={() => setIsCreateModalOpen(true)}>
                    Create First Room
                  </Button>
                }
              />
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {createdRooms.map((room) => (
                  <RoomCard
                    key={room.id}
                    room={room}
                    onJoin={(r) => navigate(`/room/${r.id || r.code}`)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Joined Rooms */}
          <section className="space-y-4">
            <h2 className="text-lg font-bold text-slate-200 flex items-center space-x-2">
              <Tv className="w-5 h-5 text-purple-400" />
              <span>Joined Rooms</span>
              <span className="text-xs font-normal text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
                {joinedRooms.length}
              </span>
            </h2>

            {joinedRooms.length === 0 ? (
              <EmptyState
                title="No joined rooms"
                description="Enter an invite code or click a watch room link to join a party."
                action={
                  <Button variant="secondary" size="sm" onClick={() => setIsJoinModalOpen(true)}>
                    Join via Invite Code
                  </Button>
                }
              />
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {joinedRooms.map((room) => (
                  <RoomCard
                    key={room.id}
                    room={room}
                    onJoin={(r) => navigate(`/room/${r.id || r.code}`)}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Create Room Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create a Watch Room"
        description="Set up a new room to watch YouTube videos synchronously with friends."
      >
        <form onSubmit={handleCreateRoom} className="space-y-4">
          {createError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-xs text-rose-300">
              {createError}
            </div>
          )}

          <Input
            label="Room Title"
            placeholder="e.g. Weekend Movie Trailer Party"
            value={createTitle}
            onChange={(e) => setCreateTitle(e.target.value)}
            disabled={isCreating}
            required
          />

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Description (Optional)
            </label>
            <textarea
              rows={3}
              placeholder="What are you planning to watch?"
              value={createDescription}
              onChange={(e) => setCreateDescription(e.target.value)}
              disabled={isCreating}
              className="w-full bg-slate-900 border border-slate-700 hover:border-slate-600 focus:border-indigo-500 text-slate-100 placeholder-slate-500 text-sm rounded-lg p-3 transition focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
          </div>

          <div className="flex items-center space-x-2 pt-1">
            <input
              type="checkbox"
              id="isPrivate"
              checked={createIsPrivate}
              onChange={(e) => setCreateIsPrivate(e.target.checked)}
              disabled={isCreating}
              className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-950"
            />
            <label htmlFor="isPrivate" className="text-xs text-slate-300">
              Make this room private (Requires invite link/code)
            </label>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-800">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsCreateModalOpen(false)}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isCreating}>
              Create Room
            </Button>
          </div>
        </form>
      </Modal>

      {/* Join Room Modal */}
      <Modal
        isOpen={isJoinModalOpen}
        onClose={() => setIsJoinModalOpen(false)}
        title="Join a Watch Room"
        description="Enter the unique 6-character room code to enter a watch party."
      >
        <form onSubmit={handleJoinRoom} className="space-y-4">
          {joinError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-xs text-rose-300">
              {joinError}
            </div>
          )}

          <Input
            label="Invite Code"
            placeholder="e.g. PARTY1"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            disabled={isJoining}
            required
            className="uppercase tracking-widest font-mono"
          />

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-800">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsJoinModalOpen(false)}
              disabled={isJoining}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isJoining}>
              Join Room
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
