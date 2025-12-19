import React, { useRef } from "react";
import type { AccessCardData } from "../types";

interface AttendanceCardProps {
  data: AccessCardData;
  onClose: () => void;
}

export default function AttendanceCard({ data, onClose }: AttendanceCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const isExit = data.status === 'exit';
  const isEntry = data.status === 'entry' || !data.status; // Default to entry if no status

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div
        ref={cardRef}
        className="relative w-full max-w-md transform transition-all duration-500 ease-out animate-slide-up"
      >
        {/* Card Container */ }
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-200">
            {/* Top Security Header */}
            <div className="bg-gray-100 px-6 py-3 border-b border-gray-200 flex justify-between items-center">
                <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full animate-pulse ${
                        isExit ? 'bg-orange-500' : 'bg-green-500' 
                    }`}></div>
                    <span className="text-xs font-bold text-gray-500 tracking-widest uppercase">
                        ATTENDANCE LOG
                    </span>
                </div>
                <div className="flex items-center space-x-1">
                     <span className="text-[10px] text-gray-400 font-mono">{new Date().toLocaleTimeString()}</span>
                </div>
            </div>

            {/* Main Content */}
            <div className="p-8 relative overflow-hidden">
                {/* Background Pattern */}
                <div className="absolute top-0 right-0 -mr-16 -mt-16 w-32 h-32 bg-blue-50 rounded-full"></div>
                <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-32 h-32 bg-purple-50 rounded-full"></div>

                <div className="relative z-10 text-center">
                    <div className={`inline-block p-1 rounded-full bg-gradient-to-br mb-4 shadow-lg ${
                        isExit ? 'from-orange-500 to-red-600' : 'from-blue-500 to-indigo-600'
                    }`}>
                         <div className="bg-white p-3 rounded-full">
                            <svg className={`w-10 h-10 ${isExit ? 'text-orange-600' : 'text-indigo-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                {isExit ? (
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                ) : (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                                )}
                            </svg>
                         </div>
                    </div>
                    
                    <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">{data.name}</h2>
                    <p className="text-sm font-medium text-gray-400 mt-1 uppercase tracking-wide">ID: {data.studentId}</p>

                    <div className="my-6 border-t border-gray-100"></div>

                    <div className="space-y-4">
                        <div className={`p-4 rounded-xl border ${
                            isExit ? 'bg-orange-50 border-orange-100 text-orange-800' : 'bg-blue-50 border-blue-100 text-blue-800'
                        }`}>
                            <p className="font-medium text-lg">
                                {isExit ? "Just signed out of" : "Just signed in to"}
                            </p>
                            <p className="font-bold text-xl mt-1">{data.courseName}</p>
                        </div>
                    </div>

                </div>
            </div>

            {/* Close Button Footer */}
            <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 text-center">
                <button 
                    onClick={onClose}
                    className="text-gray-500 hover:text-gray-800 font-medium text-sm transition-colors"
                >
                    Close
                </button>
            </div>
        </div>
      </div>
    </div>
  );
}
