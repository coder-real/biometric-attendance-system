import React from 'react';
import { XCircle, AlertTriangle, Info } from 'lucide-react';

interface StatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'error' | 'warning' | 'info';
  title: string;
  message: string;
}

export default function StatusModal({ isOpen, onClose, type, title, message }: StatusModalProps) {
  if (!isOpen) return null;

  const bgColors = {
    error: 'bg-red-50',
    warning: 'bg-yellow-50',
    info: 'bg-blue-50'
  };

  const textColors = {
    error: 'text-red-800',
    warning: 'text-yellow-800',
    info: 'text-blue-800'
  };

  const borderColors = {
    error: 'border-red-200',
    warning: 'border-yellow-200',
    info: 'border-blue-200'
  };

  const Icon = {
    error: XCircle,
    warning: AlertTriangle,
    info: Info
  }[type];

  // Auto-close after 5 seconds
  React.useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className={`relative w-full max-w-sm transform transition-all duration-300 animate-scale-in bg-white rounded-2xl shadow-2xl overflow-hidden border ${borderColors[type]}`}>
        <div className={`p-6 text-center ${bgColors[type]}`}>
          <div className="flex justify-center mb-4">
            <div className={`p-3 rounded-full bg-white shadow-sm ${textColors[type]}`}>
              <Icon size={48} strokeWidth={1.5} />
            </div>
          </div>
          
          <h3 className={`text-xl font-bold mb-2 ${textColors[type]}`}>
            {title}
          </h3>
          
          <p className="text-gray-600 font-medium">
            {message}
          </p>
        </div>

        <div className="bg-white p-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className={`w-full py-3 rounded-xl font-semibold transition-colors ${
              type === 'error' ? 'bg-red-600 hover:bg-red-700 text-white' :
              type === 'warning' ? 'bg-yellow-500 hover:bg-yellow-600 text-white' :
              'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
