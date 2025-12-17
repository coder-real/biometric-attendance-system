import React, { useRef } from "react";
import type { AccessCardData } from "../types";

interface AccessCardProps {
  data: AccessCardData;
  onClose: () => void;
}

export default function AccessCard({ data, onClose }: AccessCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleDownload = () => {
      // Keep existing download logic for now
  };

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
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-xs font-bold text-gray-500 tracking-widest uppercase">Biometric Verified</span>
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
                    <div className="inline-block p-1 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 mb-4 shadow-lg">
                         <div className="bg-white p-3 rounded-full">
                            <svg className="w-10 h-10 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                         </div>
                    </div>
                    
                    <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">{data.name}</h2>
                    <p className="text-sm font-medium text-gray-400 mt-1 uppercase tracking-wide">ID: {data.studentId}</p>

                    <div className="my-6 border-t border-gray-100"></div>

                    <div className="grid grid-cols-2 gap-4 text-left">
                        <div>
                             <p className="text-xs text-gray-400 uppercase font-semibold">Department</p>
                             <p className="text-sm font-bold text-gray-800">{data.department}</p>
                        </div>
                        <div>
                             <p className="text-xs text-gray-400 uppercase font-semibold">Course</p>
                             <p className="text-sm font-bold text-gray-800 truncate">{data.courseName}</p>
                        </div>
                    </div>

                    <div className="mt-6 bg-gray-50 rounded-xl p-4 border border-gray-100">
                        <div className="flex justify-between items-end mb-2">
                             <span className="text-sm font-medium text-gray-600">Attendance Rate</span>
                             <span className="text-2xl font-bold text-indigo-600">{data.attendancePercentage}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                                className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2 rounded-full transition-all duration-1000" 
                                style={{ width: `${data.attendancePercentage}%` }}
                            ></div>
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
                    Close Verification
                </button>
            </div>
        </div>
      </div>
    </div>
  );
}
