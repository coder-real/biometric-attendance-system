import React, { useState, useEffect, useRef } from "react";
import { db } from "../services/firebase";
import {
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { Course, AccessCardData } from "../types";
import AttendanceCard from "./AttendanceCard";
import StatusModal from "./StatusModal";
import { CheckCircle, XCircle, Fingerprint, Loader, Satellite, Wifi } from "lucide-react";

export default function FingerprintPortal() {
  const [scanState, setScanState] = useState<
    "idle" | "scanning" | "success" | "error"
  >("idle");
  const [statusMessage, setStatusMessage] = useState("Initializing...");
  const [gpsStatus, setGpsStatus] = useState<"searching" | "ready" | "offline">("offline");
  const [cardData, setCardData] = useState<AccessCardData | null>(null);
  
  // New state for Error/Status Modal
  const [statusModal, setStatusModal] = useState<{
    isOpen: boolean;
    type: 'error' | 'warning' | 'info';
    title: string;
    message: string;
  }>({ isOpen: false, type: 'info', title: '', message: '' });

  const ws = useRef<WebSocket | null>(null);
  const hasNotifiedReady = useRef(false);

  useEffect(() => {
    // Connect to the bridge server
    ws.current = new WebSocket("ws://localhost:5000");
    let isMounted = true;

    ws.current.onopen = () => {
      if (isMounted) {
          console.log("Portal connected to bridge.");
          setStatusMessage("Syncing Satellite Data...");
          setGpsStatus("searching");
      }
    };

    ws.current.onmessage = (event) => {
      if (!isMounted) return;

      let messageStr = event.data.toString();
      let status = "", data: any = "";
      
      try {
        const jsonData = JSON.parse(messageStr);
        
        // Handle GPS/Status Updates
        if (jsonData.type === "ESP32_STATUS") {
             const d = jsonData.data;
             const hasFix = d.gpsFixed === true && d.satellites > 0;
             if (hasFix) {
                 if (gpsStatus !== "ready") {
                     setGpsStatus("ready");
                     setStatusMessage("Ready to authenticate");
                     if (!hasNotifiedReady.current) {
                         hasNotifiedReady.current = true;
                     }
                 }
             } else {
                 if (gpsStatus !== "searching") {
                     setGpsStatus("searching");
                     setStatusMessage("Syncing Satellite Data...");
                 }
             }
             return;
        }

        if (jsonData.type === "ATTENDANCE") {
            setScanState("success");
            setStatusMessage("Signed In");
            setCardData({
                name: jsonData.studentName || jsonData.data?.studentName || "Student",
                studentId: jsonData.studentId || jsonData.data?.studentId || "N/A",
                department: jsonData.department || jsonData.data?.department || "N/A",
                courseName: jsonData.courseName || jsonData.data?.courseName || "Course",
                attendancePercentage: jsonData.attendancePercentage || jsonData.data?.attendancePercentage || 0,
                status: 'entry'
            });
            return;
        } else if (jsonData.type === "DUPLICATE_ATTENDANCE") {
            setStatusModal({
                isOpen: true,
                type: 'warning',
                title: 'Already Marked',
                message: `${jsonData.studentName}: Attendance has already been taken for this session.`
            });
            setScanState("idle");
            return;
        } else if (jsonData.type === "SIGNED_OUT") {
            setScanState("success");
            setStatusMessage(`${jsonData.studentName}: Signed Out`);
            setCardData({
                name: jsonData.studentName,
                studentId: jsonData.studentId,
                department: jsonData.department,
                courseName: jsonData.courseName,
                attendancePercentage: jsonData.attendancePercentage,
                status: 'exit'
            });
            return;
        } else if (jsonData.type === "SESSION_COMPLETED") {
             setStatusModal({
                 isOpen: true,
                 type: 'info',
                 title: 'Session Closed',
                 message: `${jsonData.studentName}: You have already signed out of this session.`
             });
             setScanState("idle");
             return;
        } else if (jsonData.type === "NO_ACTIVE_SESSION") {
             setStatusModal({
                 isOpen: true,
                 type: 'error',
                 title: 'No Session',
                 message: `${jsonData.studentName}: There are no active sessions available right now.`
             });
             setScanState("idle");
             return;
        } else if (jsonData.type === "NO_MATCHING_SESSION") {
             setStatusModal({
                 isOpen: true,
                 type: 'error',
                 title: 'Wrong Session',
                 message: `${jsonData.studentName}: No active session matches your Department (${jsonData.department}) and Level.`
             });
             setScanState("idle");
             return;
        } else if (jsonData.type === "ENROLL_RESPONSE") {
            status = jsonData.success ? "SUCCESS" : "ERROR";
            data = jsonData.error || jsonData.id || "Enrollment failed";
        } else if (jsonData.type === "VERIFY_RESPONSE") {
             if (jsonData.success) {
                 setScanState("success");
                 setStatusMessage("Fingerprint verified, processing...");
                 return; 
             } else {
                 setStatusModal({
                     isOpen: true,
                     type: 'error',
                     title: 'Not Recognized',
                     message: 'Fingerprint did not match any student record.'
                 });
                 setScanState("error");
                 setStatusMessage("Fingerprint not recognized");
                 return;
             }
        } else {
             status = jsonData.type || "UNKNOWN";
        }
      } catch (e) {
        const parts = messageStr.split(":", 2);
        status = parts[0];
        data = parts[1];
      }

      if (status === "SUCCESS") {
        // Legacy handling if needed
      } else if (status === "STATUS") {
        if (gpsStatus === "ready" && typeof data === 'string' && data.length < 50) {
            setStatusMessage(data);
        }
      }
    };

    ws.current.onerror = async () => {
      if (isMounted) {
        setScanState("error");
        setGpsStatus("offline");
        setStatusMessage("Bridge Offline");
      }
    };

    return () => {
      isMounted = false;
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        ws.current.close();
      }
    };
  }, []); // Only run once on mount

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    // Reset state after success or error (short delay)
    if (scanState === "error" || scanState === "success") {
      timer = setTimeout(() => {
        if (!cardData && !statusModal.isOpen) {
            setScanState("idle");
            setStatusMessage(gpsStatus === "ready" ? "Ready to authenticate" : "Syncing Satellite Data...");
        }
      }, 4000);
    }
    return () => clearTimeout(timer);
  }, [scanState, cardData, statusModal.isOpen, gpsStatus]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (cardData) {
      timer = setTimeout(() => {
        setCardData(null);
        setScanState("idle");
        setStatusMessage(gpsStatus === "ready" ? "Ready to authenticate" : "Syncing Satellite Data...");
      }, 8000);
    }
    return () => clearTimeout(timer);
  }, [cardData, gpsStatus]);

  const handleStartVerification = () => {
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
      setStatusModal({
          isOpen: true,
          type: 'error',
          title: 'Connection Error',
          message: 'The system is not connected to the bridge server.'
      });
      return;
    }
    
    if (gpsStatus !== "ready") {
        setStatusModal({
            isOpen: true,
            type: 'warning',
            title: 'GPS Offline',
            message: 'Waiting for satellite synchronization. Please wait for GPS Lock.'
        });
        return;
    }

    setScanState("scanning");
    setStatusMessage("Place your finger");
    ws.current.send("VERIFY_FINGERPRINT");
  };

  const handleCloseCard = () => {
    setCardData(null);
    setScanState("idle");
    setStatusMessage(gpsStatus === "ready" ? "Ready to authenticate" : "Syncing Satellite Data...");
  };

  return (
    <div className="min-h-screen  bg-black-800  flex flex-col items-center justify-center p-6">
      
      {cardData && <AttendanceCard data={cardData} onClose={handleCloseCard} />}
      
      <StatusModal 
        isOpen={statusModal.isOpen} 
        onClose={() => setStatusModal(prev => ({ ...prev, isOpen: false }))}
        type={statusModal.type}
        title={statusModal.title}
        message={statusModal.message}
      />

      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-12 relative">
          <div className="absolute -top-4 right-0 flex gap-2">
               {/* GPS Status Badge */}
               <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-300 shadow-md ${
                   gpsStatus === "ready" ? "bg-green-500/20 text-green-300 border border-green-400/30 shadow-lg shadow-green-500/20" : 
                   gpsStatus === "searching" ? "bg-blue-500/20 text-blue-300 border border-blue-400/30 animate-pulse" : 
                   "bg-gray-500/20 text-gray-400 border border-gray-400/20"
               }`}>
                   <Satellite className={`w-3.5 h-3.5 ${
                       gpsStatus === "ready" ? "" : gpsStatus === "searching" ? "animate-spin" : ""
                   }`} />
                   <span>{gpsStatus === "ready" ? "GPS LOCKED" : gpsStatus === "searching" ? "ACQUIRING..." : "OFFLINE"}</span>
               </div>
          </div>
          <h1 className="text-3xl font-semibold text-gray-300 mb-2">
            Biometric Login
          </h1>
          <p className="text-gray-500">
            Authenticate using your fingerprint
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-gray-800  rounded-3xl shadow-lg p-8">
          {/* Icon Container */}
          <div className="flex justify-center mb-8">
            <div className="relative">
              {/* Animated glow effect */}
              <div
                className={`absolute inset-0 rounded-full blur-2xl opacity-20 transition-all duration-500 ${
                  scanState === "scanning"
                    ? "bg-blue-500 scale-150"
                    : scanState === "success"
                    ? "bg-green-500 scale-150"
                    : scanState === "error"
                    ? "bg-red-500 scale-150"
                    : "bg-transparent"
                }`}
              />
              {/* Icon circle */}
              <div
                className={`relative w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300 ${
                  scanState === "scanning"
                    ? "bg-blue-50 border-2 border-blue-500"
                    : scanState === "success"
                    ? "bg-green-50 border-2 border-green-500"
                    : scanState === "error"
                    ? "bg-red-50 border-2 border-red-500"
                    : "bg-gray-50 border-2 border-gray-200"
                }`}
              >
                {scanState === "scanning" && (
                  <Loader className="w-12 h-12 text-blue-600 animate-spin" />
                )}
                {scanState === "success" && (
                  <CheckCircle className="w-12 h-12 text-green-600" />
                )}
                {scanState === "error" && (
                  <XCircle className="w-12 h-12 text-red-600" />
                )}
                {scanState === "idle" && (
                  <Fingerprint className="w-12 h-12 text-gray-400" />
                )}
              </div>
            </div>
          </div>

          {/* Status Message */}
          <div className="text-center mb-8">
            <p
              className={`text-lg font-semibold transition-all duration-300 ${
                scanState === "scanning"
                  ? "text-blue-600"
                  : scanState === "success"
                  ? "text-green-600"
                  : scanState === "error"
                  ? "text-red-600"
                  : gpsStatus === "searching"
                  ? "text-blue-400"
                  : "text-gray-300"
              }`}
            >
              {statusMessage}
            </p>
            {gpsStatus === "searching" && (
              <p className="text-xs text-gray-500 mt-2 animate-pulse">Waiting for satellite lock...</p>
            )}
          </div>

          {/* Action Button */}
          <button
            onClick={handleStartVerification}
            disabled={scanState === "scanning" || gpsStatus !== "ready"}
            className={`w-full py-4 rounded-xl font-medium text-base transition-all duration-200 ${
              scanState === "scanning" || gpsStatus !== "ready"
                ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                : "bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98] shadow-md hover:shadow-lg"
            }`}
          >
            {scanState === "scanning"
              ? "Scanning..."
              : gpsStatus !== "ready"
              ? "Waiting for GPS..."
              : "Start Authentication"}
          </button>
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-sm text-gray-400">
            Secured by Dern Technology
          </p>
        </div>
      </div>
    </div>
  );
}