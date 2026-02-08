
import React from 'react';
import { SecurityEvent } from '../types';

interface SecurityOverlayProps {
  events: SecurityEvent[];
  onClear: () => void;
}

const SecurityOverlay: React.FC<SecurityOverlayProps> = ({ events, onClear }) => {
  if (events.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
      {events.map((event, idx) => (
        <div 
          key={`${event.timestamp}-${idx}`}
          className="bg-red-900/90 border border-red-500 text-red-100 p-4 rounded-lg shadow-xl animate-bounce-short pointer-events-auto"
        >
          <div className="flex justify-between items-start">
            <span className="font-bold uppercase text-[10px] tracking-widest">Alerta de Seguridad</span>
            <button 
              onClick={onClear}
              className="text-red-300 hover:text-white"
            >
              ✕
            </button>
          </div>
          <p className="text-sm mt-1 leading-tight">{event.message}</p>
        </div>
      ))}
    </div>
  );
};

export default SecurityOverlay;
