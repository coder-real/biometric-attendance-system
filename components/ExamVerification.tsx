import React, { useState, useEffect, useRef } from "react";
import { db } from "../services/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { Course, Student, AccessCardData } from "../types";
import ExamCard from "./ExamCard";
import { CheckCircle, XCircle, Fingerprint, Loader } from "lucide-react";

type ScanState = "idle" | "scanning" | "success" | "error";

export default function ExamVerification() {
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [statusMessage, setStatusMessage] = useState(
    "Click button to begin verification"
  );
  const [verifiedData, setVerifiedData] = useState<AccessCardData | null>(null);
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    ws.current = new WebSocket("ws://localhost:5000"); // Using port 5000 based on FingerprintPortal
    let isMounted = true;

    ws.current.onopen = () => {
      if (isMounted) console.log("Verification portal connected to bridge.");
    };
    ws.current.onerror = () => {
      if (isMounted) {
        setScanState("error");
        setStatusMessage("Bridge connection failed.");
      }
    };
    ws.current.onmessage = (event) => {
      if (!isMounted) return;
      
      let messageStr = event.data.toString();
      let status = "", data: any = "";
      
      try {
        const jsonData = JSON.parse(messageStr);
        if (jsonData.type === "VERIFY_RESPONSE") {
             if (jsonData.success) {
                 handleSuccessfulVerification(jsonData.id.toString());
                 return; 
             } else {
                 status = "ERROR";
                 data = "No match found";
             }
        } else if (jsonData.type === "SIGNED_OUT") {
             setScanState("success");
             setStatusMessage(`${jsonData.studentName}: Signed Out`);
             setVerifiedData({
                name: jsonData.studentName,
                studentId: jsonData.studentId,
                department: jsonData.department,
                courseName: jsonData.courseName,
                attendancePercentage: jsonData.attendancePercentage,
                status: 'exit'
             });
             return;
        } else if (jsonData.type === "ESP32_STATUS") {
            // Ignore status updates here for now
            return;
        } else {
             status = jsonData.type || "UNKNOWN";
             data = jsonData.data || "";
        }
      } catch (e) {
        const parts = messageStr.split(":", 2);
        status = parts[0];
        data = parts[1];
      }

      if (status === "SUCCESS") handleSuccessfulVerification(data);
      else if (status === "STATUS") setStatusMessage(data);
      else if (status !== "ATTENDANCE") {
        setScanState("error");
        setStatusMessage(typeof data === 'string' ? data : "Verification failed");
      }
    };

    return () => {
      isMounted = false;
      if (ws.current?.readyState === WebSocket.OPEN) ws.current.close();
    };
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (scanState === "error") {
      timer = setTimeout(() => {
        setScanState("idle");
        setStatusMessage("Click button to begin verification");
        setVerifiedData(null);
      }, 5000);
    }
    return () => clearTimeout(timer);
  }, [scanState]);

  const handleSuccessfulVerification = async (fingerprintId: string) => {
    try {
      // 1. Find student by fingerprint
      const studentQuery = query(
        collection(db, "students"),
        where("fingerprintTemplate", "==", fingerprintId)
      );
      const studentSnapshot = await getDocs(studentQuery);

      if (studentSnapshot.empty) {
        setScanState("error");
        setStatusMessage(
          "Fingerprint not recognized. Please contact the exam officer."
        );
        return;
      }
      const studentDoc = studentSnapshot.docs[0];
      const studentData = {
        id: studentDoc.id,
        ...studentDoc.data(),
      } as Student;

      // 2. Find an active session for the student's course
      const activeSessionsQuery = query(
        collection(db, "sessions"),
        where("active", "==", true)
      );
      const activeSessionsSnapshot = await getDocs(activeSessionsQuery);
      if (activeSessionsSnapshot.empty) {
        setScanState("error");
        setStatusMessage("No active exam session found.");
        return;
      }

      const coursesSnap = await getDocs(collection(db, "courses"));
      const coursesMap = new Map<string, Omit<Course, "id">>(
        coursesSnap.docs.map((doc) => [
          doc.id,
          doc.data() as Omit<Course, "id">,
        ])
      );

      let matchedSessionDoc = null;
      let matchedCourseData: (Omit<Course, "id"> & { id: string }) | null =
        null;
      for (const sessionDoc of activeSessionsSnapshot.docs) {
        const sessionData = sessionDoc.data();
        const courseData = coursesMap.get(sessionData.courseId);
        if (
          courseData &&
          courseData.department === studentData.department &&
          courseData.level === studentData.level
        ) {
          matchedSessionDoc = sessionDoc;
          matchedCourseData = { id: sessionData.courseId, ...courseData };
          break;
        }
      }

      if (!matchedSessionDoc || !matchedCourseData) {
        setScanState("error");
        setStatusMessage(`No active exam for your department/level.`);
        return;
      }
      const courseId = matchedCourseData.id;

      // 3. Calculate attendance percentage
      const allSessionsSnap = await getDocs(
        query(collection(db, "sessions"), where("courseId", "==", courseId))
      );
      const totalClasses = allSessionsSnap.docs.length;

      const attendanceSnap = await getDocs(
        query(
          collection(db, "attendance"),
          where("studentId", "==", studentData.id),
          where("courseId", "==", courseId)
        )
      );
      const attendedClasses = attendanceSnap.docs.length;

      const attendancePercentage =
        totalClasses > 0
          ? Math.round((attendedClasses / totalClasses) * 100)
          : 0;

      // 4. Check attendance threshold
      if (attendancePercentage < 70) {
        setScanState("error");
        setStatusMessage(
          `Access Denied: Minimum 70% attendance required. Yours is ${attendancePercentage}%.`
        );
        return;
      }

      // 5. Grant Access
      setScanState("success");
      setStatusMessage("Verified");
      setVerifiedData({
        name: studentData.name,
        studentId: studentData.studentId,
        department: studentData.department,
        courseName: `${matchedCourseData.name} (${matchedCourseData.code})`,
        attendancePercentage: attendancePercentage,
      });

    } catch (error) {
      console.error("Verification Error:", error);
      setScanState("error");
      setStatusMessage("An unexpected server error occurred.");
    }
  };

  const handleStartVerification = () => {
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
      setScanState("error");
      setStatusMessage("Bridge not connected. Please refresh.");
      return;
    }
    setScanState("scanning");
    setStatusMessage("Place your finger on the scanner...");
    ws.current.send("VERIFY_FINGERPRINT");
  };

  const handleCloseCard = () => {
    setVerifiedData(null);
    setScanState("idle");
    setStatusMessage("Click button to begin verification");
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-6">
      
      {verifiedData && <ExamCard data={verifiedData} onClose={handleCloseCard} />}

      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-12 relative">
          <h1 className="text-3xl font-semibold text-gray-300 mb-2">
            Exam Verification
          </h1>
          <p className="text-gray-500">
            Verify eligibility for exam entry
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-gray-800 rounded-3xl shadow-lg p-8">
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
                  : "text-gray-300"
              }`}
            >
              {statusMessage}
            </p>
          </div>

          {/* Action Button */}
          <button
            onClick={handleStartVerification}
            disabled={scanState === "scanning"}
            className={`w-full py-4 rounded-xl font-medium text-base transition-all duration-200 ${
              scanState === "scanning"
                ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                : "bg-indigo-600 text-white hover:bg-indigo-700 active:scale-[0.98] shadow-md hover:shadow-lg"
            }`}
          >
            {scanState === "scanning"
              ? "Verifying..."
              : "Start Verification"}
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
