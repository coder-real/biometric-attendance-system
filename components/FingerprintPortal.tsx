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
import { CheckCircle, XCircle, Fingerprint, Loader, Satellite, Wifi } from "lucide-react";

export default function FingerprintPortal() {
  const [scanState, setScanState] = useState<
    "idle" | "scanning" | "success" | "error"
  >("idle");
  const [statusMessage, setStatusMessage] = useState("Initializing...");
  const [gpsStatus, setGpsStatus] = useState<"searching" | "ready" | "offline">("offline");
  const [cardData, setCardData] = useState<AccessCardData | null>(null);
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
             
             // Check if GPS has a fix
             const hasFix = d.gpsFixed === true && d.satellites > 0;
             
             if (hasFix) {
                 if (gpsStatus !== "ready") {
                     console.log("🛰️ GPS Ready:", d.satellites, "satellites");
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
            handleSuccessfulVerification(jsonData.data.id, jsonData.data);
            return;
        } else if (jsonData.type === "DUPLICATE_ATTENDANCE") {
            setScanState("error");
            setStatusMessage(`${jsonData.studentName}: Attendance already taken`);
            return;
        } else if (jsonData.type === "SIGNED_OUT") {
            setScanState("success");
            setStatusMessage(`${jsonData.studentName}: Signed Out`);
            // Show the card in "exit" mode
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
            setScanState("error");
            setStatusMessage(`${jsonData.studentName}: Session Closed`);
            return;
        } else if (jsonData.type === "ENROLL_RESPONSE") {
            status = jsonData.success ? "SUCCESS" : "ERROR";
            data = jsonData.error || jsonData.id || "Enrollment failed";
        } else if (jsonData.type === "VERIFY_RESPONSE") {
             if (jsonData.success) {
                 handleSuccessfulVerification(jsonData.id.toString());
                 return; 
             } else {
                 status = "ERROR";
                 data = "No match found";
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
        handleSuccessfulVerification(data);
      } else if (status === "STATUS") {
        // Only update status if it's a meaningful user message and NOT during GPS sync
        // We prioritize GPS sync messaging until ready
        if (gpsStatus === "ready" && typeof data === 'string' && data.length < 50) {
            setStatusMessage(data);
        }
      } else {
        if (status !== "ATTENDANCE") {
            setScanState("error");
            setStatusMessage(typeof data === 'string' ? data : "Verification failed");
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
    // Reset state after success or error, but wait a bit if it was success/error
    if (scanState === "error" || scanState === "success") {
      timer = setTimeout(() => {
        // Only reset if no card is showing (card handles its own close or timeout)
        if (!cardData) {
            setScanState("idle");
            // restore appropriate message
            setStatusMessage(gpsStatus === "ready" ? "Ready to authenticate" : "Syncing Satellite Data...");
        }
      }, 4000);
    }
    return () => clearTimeout(timer);
  }, [scanState, cardData, gpsStatus]);

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

  const handleSuccessfulVerification = async (fingerprintId: string, gpsData?: any) => {
    try {
      const studentsRef = collection(db, "students");
      const q = query(
        studentsRef,
        where("fingerprintTemplate", "==", fingerprintId.toString())
      );
      const studentSnapshot = await getDocs(q);

      if (studentSnapshot.empty) {
        setScanState("error");
        setStatusMessage("Unknown Identity");
        return;
      }

      interface Student {
        id: string;
        name: string;
        studentId: string;
        department: string;
        level: string;
        fingerprintTemplate: string;
      }

      const studentDoc = studentSnapshot.docs[0];
      const studentData = {
        id: studentDoc.id,
        ...(studentDoc.data() as Omit<Student, "id">),
      };

      interface Session {
        id: string;
        courseId: string;
        active: boolean;
      }

      const sessionsRef = collection(db, "sessions");
      const activeSessionsQuery = query(
        sessionsRef,
        where("active", "==", true)
      );
      const activeSessionsSnapshot = await getDocs(activeSessionsQuery);

      let matchedSession: Session | null = null;
      let courseName = "Common Entry";

      if (!activeSessionsSnapshot.empty) {
        const coursesRef = collection(db, "courses");
        const coursesSnapshot = await getDocs(coursesRef);
        const coursesMap = new Map<string, Omit<Course, "id">>(
            coursesSnapshot.docs.map((doc) => [
            doc.id,
            doc.data() as Omit<Course, "id">,
            ])
        );

        for (const sessionDoc of activeSessionsSnapshot.docs) {
            const sessionData = {
            id: sessionDoc.id,
            ...(sessionDoc.data() as Omit<Session, "id">),
            };
            const courseData = coursesMap.get(sessionData.courseId);
            if (
            courseData &&
            courseData.department === studentData.department &&
            courseData.level === studentData.level
            ) {
            matchedSession = sessionData;
            courseName = courseData.name;
            break;
            }
        }
      }

      setStatusMessage("Verified");
      setScanState("success");

      let attendancePercentage = 0;
      if (matchedSession) {
          const courseSessionsQuery = query(
            collection(db, "sessions"),
            where("courseId", "==", matchedSession.courseId)
          );
          const courseSessionsSnap = await getDocs(courseSessionsQuery);
          const totalClasses = courseSessionsSnap.size;

          const studentAttendanceQuery = query(
            collection(db, "attendance"),
            where("studentId", "==", studentData.id),
            where("courseId", "==", matchedSession.courseId)
          );
          const studentAttendanceSnap = await getDocs(studentAttendanceQuery);
          const attendedClasses = studentAttendanceSnap.size;

          attendancePercentage =
            totalClasses > 0
              ? Math.round((attendedClasses / totalClasses) * 100)
              : 0;
      }

      setCardData({
        name: studentData.name,
        studentId: studentData.studentId,
        department: studentData.department,
        courseName: courseName,
        attendancePercentage,
      });
    } catch (error) {
      console.error("Portal Display Error:", error);
      setScanState("error");
      setStatusMessage("System Error");
    }
  };

  const handleStartVerification = () => {
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
      setScanState("error");
      setStatusMessage("Not connected");
      return;
    }
    
    if (gpsStatus !== "ready") {
        // Warn user but allow override if they really want to (or just block)
        // For now, let's block to enforce "wait for calibration"
        setScanState("error");
        setStatusMessage("Wait for GPS Sync...");
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