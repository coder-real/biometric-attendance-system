import React from 'react';
import { CheckCircle, XCircle, AlertCircle, X } from 'lucide-react';

interface ToastProps {
  type: 'success' | 'error' | 'info';
  message: string;
  onClose: () => void;
}

export default function Toast({ type, message, onClose }: ToastProps) {
  const styles = {
    success: {
      bg: 'bg-green-50',
      border: 'border-green-200',
      text: 'text-green-800',
      icon: <CheckCircle className="w-5 h-5 text-green-500" />
    },
    error: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-800',
      icon: <XCircle className="w-5 h-5 text-red-500" />
    },
    info: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      text: 'text-blue-800',
      icon: <AlertCircle className="w-5 h-5 text-blue-500" />
    }
  };

  const style = styles[type];

  return (
    <div 
      className="fixed top-4 right-4 z-50"
      style={{
        animation: 'slideInRight 0.3s ease-out'
      }}
    >
      <style>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes scaleIn {
          from {
            transform: scale(0.9);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>
      <div className={`${style.bg} ${style.border} border rounded-lg shadow-lg p-4 pr-12 max-w-md min-w-[300px]`}>
        <div className="flex items-start gap-3">
          {style.icon}
          <p className={`${style.text} text-sm font-medium flex-1`}>{message}</p>
          <button
            onClick={onClose}
            className={`${style.text} hover:opacity-70 transition-opacity absolute top-3 right-3`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
