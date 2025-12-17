import React, { useState, useEffect, useRef } from "react";
import { db } from "../services/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { Course, Student } from "../types";

type ScanState = "idle" | "scanning" | "success" | "error";

interface VerifiedStudentData {
  name: string;
  matricNumber: string;
  department: string;
  level: string;
  course: string;
  attendance: string;
}

const VerificationScanner = ({
  state,
  message,
}: {
  state: ScanState;
  message: string;
}) => {
  const stateClasses = {
    idle: "text-gray-400",
    scanning: "text-blue-400",
    success: "text-green-400",
    error: "text-red-400",
  };

  return (
    <div className="relative w-40 h-40 flex flex-col items-center justify-center">
      {state === "scanning" && (
        <div className="absolute top-0 left-0 w-full h-full">
          <div className="absolute top-0 left-0 w-full h-1 bg-blue-500 rounded-full animate-scan"></div>
        </div>
      )}
      <svg
        className={`w-32 h-32 transition-colors duration-300 ${stateClasses[state]}`}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M50 25C44.4772 25 40 29.4772 40 35V40"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M50 75C52.7614 75 55 72.7614 55 70V55"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M50 75C47.2386 75 45 72.7614 45 70V65"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M50 25C55.5228 25 60 29.4772 60 35V45C60 47.7614 57.7614 50 55 50"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M30 55V45C30 36.7157 36.7157 30 45 30"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M70 55V45C70 36.7157 63.2843 30 55 30"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M30 55C30 63.2843 36.7157 70 45 70"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M70 55C70 63.2843 63.2843 70 55 70"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
      {state === "success" && (
        <svg
          className="absolute w-16 h-16 text-green-400"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
      )}
      {state === "error" && (
        <svg
          className="absolute w-16 h-16 text-red-400"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      )}
      <p
        className={`absolute -bottom-2 text-sm font-medium text-center transition-colors duration-300 ${stateClasses[state]}`}
      >
        {message}
      </p>
    </div>
  );
};

export default function ExamVerification() {
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [statusMessage, setStatusMessage] = useState(
    "Click button to begin verification"
  );
  const [verifiedStudentData, setVerifiedStudentData] =
    useState<VerifiedStudentData | null>(null);
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    ws.current = new WebSocket("ws://localhost:8080");
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
      const message = event.data.toString();
      const [status, data] = message.split(":", 2);
      if (status === "SUCCESS") handleSuccessfulVerification(data);
      else if (status === "STATUS") setStatusMessage(data);
      else {
        setScanState("error");
        setStatusMessage(data || "Verification failed.");
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
        setVerifiedStudentData(null);
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
      // FIX: Explicitly typing the Map generic to prevent TypeScript from inferring it as Map<unknown, unknown>,
      // which caused errors when accessing properties on `courseData`.
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
      setVerifiedStudentData({
        name: studentData.name,
        matricNumber: studentData.studentId,
        department: studentData.department,
        level: studentData.level,
        course: `${matchedCourseData.name} (${matchedCourseData.code})`,
        attendance: `${attendancePercentage}%`,
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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 p-4 text-white">
      <style>{`.animate-scan { animation: scan 1.5s ease-in-out infinite; } @keyframes scan { 0% { top: 0; } 100% { top: 100%; } } .animate-fade-in { animation: fadeIn 0.5s ease-in-out; } @keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }`}</style>

      <div className="w-full max-w-md text-center">
        {scanState !== "success" && (
          <>
            <h1 className="text-3xl font-bold">Exam Verification</h1>
            <p className="text-gray-400 mt-2 mb-8">
              Place your finger on the scanner to continue
            </p>
            <div className="flex justify-center mb-10">
              <VerificationScanner state={scanState} message={statusMessage} />
            </div>
          </>
        )}

        {scanState === "success" && verifiedStudentData ? (
          <div className="bg-gray-800 border border-gray-700 shadow-2xl rounded-lg p-6 w-full max-w-md animate-fade-in">
            <h2 className="text-xl font-bold text-center mb-4 border-b border-gray-600 pb-2">
              EXAM VERIFICATION
            </h2>
            <div className="space-y-2 text-left text-lg">
              <div className="flex justify-between">
                <strong>Name:</strong> <span>{verifiedStudentData.name}</span>
              </div>
              <div className="flex justify-between">
                <strong>Matric Number:</strong>{" "}
                <span>{verifiedStudentData.matricNumber}</span>
              </div>
              <div className="flex justify-between">
                <strong>Department:</strong>{" "}
                <span>{verifiedStudentData.department}</span>
              </div>
              <div className="flex justify-between">
                <strong>Level:</strong> <span>{verifiedStudentData.level}</span>
              </div>
              <div className="flex justify-between">
                <strong>Course:</strong>{" "}
                <span>{verifiedStudentData.course}</span>
              </div>
              <div className="flex justify-between">
                <strong>Attendance:</strong>{" "}
                <span>{verifiedStudentData.attendance}</span>
              </div>
            </div>
            <div className="text-center mt-4 pt-4 border-t border-gray-600">
              <p className="text-2xl font-bold text-green-400">
                Status: Access Granted ✅
              </p>
              <button
                onClick={() => {
                  setScanState("idle");
                  setStatusMessage("Click button to begin verification");
                  setVerifiedStudentData(null);
                }}
                className="mt-6 w-full flex justify-center py-3 px-4 border border-transparent text-sm font-semibold rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 focus:ring-offset-gray-800"
              >
                Proceed to Exam
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={handleStartVerification}
            disabled={scanState === "scanning"}
            className="w-full max-w-sm flex justify-center py-3 px-4 border border-transparent text-sm font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {scanState === "scanning" ? "Verifying..." : "Start Verification"}
          </button>
        )}
      </div>
    </div>
  );
}
