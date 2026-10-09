import React from 'react';
import { Room } from '../../types';
import { Users, Lock, Unlock, PlayCircle, ArrowRight } from 'lucide-react';
import { Button } from './Button';

export interface RoomCardProps {
  room: Room;
  onJoin: (room: Room) => void;
}

export const RoomCard: React.FC<RoomCardProps> = ({ room, onJoin }) => {
  return (
    <div className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-5 flex flex-col justify-between transition group">
      <div className="space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
              <PlayCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100 group-hover:text-indigo-400 transition line-clamp-1">
                {room.title}
              </h3>
              <p className="text-xs text-slate-400">Code: <span className="font-mono text-slate-300">{room.code}</span></p>
            </div>
          </div>
          <span className="text-slate-500" title={room.isPrivate ? 'Private Room' : 'Public Room'}>
            {room.isPrivate ? <Lock className="w-4 h-4 text-amber-400" /> : <Unlock className="w-4 h-4 text-emerald-400" />}
          </span>
        </div>

        {room.description && <p className="text-xs text-slate-400 line-clamp-2">{room.description}</p>}

        <div className="flex items-center justify-between pt-2 text-xs text-slate-400 border-t border-slate-800/80">
          <div className="flex items-center space-x-1.5">
            <Users className="w-3.5 h-3.5 text-slate-400" />
            <span>{room._count?.participants ?? 1} participant(s)</span>
          </div>
          <span>Host: {room.host?.username || 'User'}</span>
        </div>
      </div>

      <div className="pt-4">
        <Button
          variant="secondary"
          size="sm"
          className="w-full justify-center group-hover:bg-indigo-600 group-hover:text-white transition"
          onClick={() => onJoin(room)}
          rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
        >
          Join Room
        </Button>
      </div>
    </div>
  );
};
