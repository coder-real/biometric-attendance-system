import React from "react";

interface LocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  latitude: number | undefined;
  longitude: number | undefined;
  title?: string;
}

export default function LocationModal({
  isOpen,
  onClose,
  latitude,
  longitude,
  title = "Attendance Location",
}: LocationModalProps) {
  if (!isOpen || latitude === undefined || longitude === undefined) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl overflow-hidden animate-fade-in-scale">
        <div className="flex justify-between items-center p-4 border-b border-gray-200 bg-gray-50">
          <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        
        <div className="p-0 h-96 bg-gray-100 relative">
          <iframe
            title="Location Map"
            width="100%"
            height="100%"
            frameBorder="0"
            style={{ border: 0 }}
            src={`https://maps.google.com/maps?q=${latitude},${longitude}&z=15&output=embed`}
            allowFullScreen
          ></iframe>
        </div>
        
        <div className="p-4 bg-gray-50 flex justify-between items-center text-sm text-gray-500">
          <span>
            Lat: {latitude.toFixed(6)}, Lon: {longitude.toFixed(6)}
          </span>
          <a 
            href={`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            Open in Google Maps
          </a>
        </div>
      </div>
    </div>
  );
}
