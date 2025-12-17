import React, { useState, useEffect, FormEvent, useRef } from "react";
import { Student } from "../types";

interface StudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (studentData: Omit<Student, "id">) => void;
  studentData: Student | null;
}

const departments = [
  "Computer Science",
  "Software Engineering",
  "Information Technology",
  "Cyber Security",
  "Electrical Electronics",
];
const levels = ["100", "200", "300", "400", "500"];

type FingerprintStatus = "idle" | "capturing" | "success" | "error";

export default function StudentModal({
  isOpen,
  onClose,
  onSubmit,
  studentData,
}: StudentModalProps) {
  const [name, setName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [department, setDepartment] = useState(departments[0]);
  const [level, setLevel] = useState(levels[0]);

  // State for the new fingerprint capture flow
  const [fingerprintTemplate, setFingerprintTemplate] = useState("");
  const [fingerprintStatus, setFingerprintStatus] =
    useState<FingerprintStatus>("idle");
  const [fingerprintMessage, setFingerprintMessage] = useState("Not Captured");

  const [error, setError] = useState("");
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (studentData) {
      setName(studentData.name);
      setStudentId(studentData.studentId || "");
      setDepartment(studentData.department);
      setLevel(studentData.level);

      if (studentData.fingerprintTemplate) {
        setFingerprintTemplate(studentData.fingerprintTemplate);
        setFingerprintStatus("success");
        setFingerprintMessage(`Template captured`);
      } else {
        setFingerprintTemplate("");
        setFingerprintStatus("idle");
        setFingerprintMessage("Not Captured");
      }
    } else {
      // Reset form for new student
      setName("");
      setStudentId("");
      setDepartment(departments[0]);
      setLevel(levels[0]);
      setFingerprintTemplate("");
      setFingerprintStatus("idle");
      setFingerprintMessage("Not Captured");
    }
    setError("");
  }, [studentData, isOpen]);

  // WebSocket connection logic
  useEffect(() => {
    if (isOpen) {
      ws.current = new WebSocket("ws://localhost:5000");
      let isMounted = true;

      ws.current.onopen = () => {
        if (isMounted) {
          console.log("Successfully connected to fingerprint bridge.");
          setFingerprintStatus("idle");
          setFingerprintMessage("Ready to capture");
        }
      };

      // Section 5: Process real-time messages from the server
        ws.current.onmessage = (event) => {
          if (isMounted) {
            try {
              const response = JSON.parse(event.data);
              
              if (response.type === "ENROLL_RESPONSE") {
                if (response.success) {
                  setFingerprintTemplate(response.id.toString());
                  setFingerprintStatus("success");
                  setFingerprintMessage(`Template captured successfully! (ID: ${response.id})`);
                } else {
                  setFingerprintStatus("error");
                  setFingerprintMessage(response.error || "Capture failed.");
                }
              } else if (response.type === "ESP32_STATUS") {
                // Just status updates, don't interfere with capture flow unless erroneous
              }
            } catch (e) {
              // Fallback or ignore non-JSON
              console.log("Non-JSON message:", event.data);
            }
          }
        };

      ws.current.onerror = (error) => {
        if (isMounted) {
          console.error("WebSocket Error:", error);
          setFingerprintStatus("error");
          setFingerprintMessage("Bridge connection failed.");
        }
      };

      ws.current.onclose = () => {
        if (isMounted) {
          console.log("Disconnected from fingerprint bridge.");
          // Only update message if the status wasn't a final one
          if (
            fingerprintStatus !== "success" &&
            fingerprintStatus !== "error"
          ) {
            setFingerprintStatus("idle");
            setFingerprintMessage("Bridge disconnected.");
          }
        }
      };

      return () => {
        isMounted = false;
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
          ws.current.close();
        }
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCaptureFingerprint = () => {
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
      setFingerprintStatus("error");
      setFingerprintMessage("Bridge not connected. Re-open form.");
      return;
    }

    setFingerprintStatus("capturing");
    setFingerprintMessage("Sending capture command...");
    ws.current.send("CAPTURE_FINGERPRINT");
  };

  const getStatusIndicatorClasses = () => {
    switch (fingerprintStatus) {
      case "success":
        return "bg-green-100 text-green-800";
      case "capturing":
        return "bg-blue-100 text-blue-800 animate-pulse";
      case "error":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name || !studentId || !department || !level) {
      setError("All fields except fingerprint are required.");
      return;
    }
    if (!fingerprintTemplate || fingerprintStatus !== "success") {
      setError("A fingerprint must be successfully captured.");
      return;
    }
    onSubmit({ name, studentId, department, level, fingerprintTemplate });
  };

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
        <h2 className="text-2xl font-bold mb-6 text-gray-900">
          {studentData ? "Edit Student" : "Add Student"}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div
              className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative"
              role="alert"
            >
              <span className="block sm:inline">{error}</span>
            </div>
          )}
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-700"
            >
              Name
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>
          <div>
            <label
              htmlFor="studentId"
              className="block text-sm font-medium text-gray-700"
            >
              Student ID
            </label>
            <input
              type="text"
              id="studentId"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>
          <div>
            <label
              htmlFor="department"
              className="block text-sm font-medium text-gray-700"
            >
              Department
            </label>
            <select
              id="department"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            >
              {departments.map((dep) => (
                <option key={dep} value={dep}>
                  {dep}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="level"
              className="block text-sm font-medium text-gray-700"
            >
              Level
            </label>
            <select
              id="level"
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            >
              {levels.map((lvl) => (
                <option key={lvl} value={lvl}>
                  {lvl}
                </option>
              ))}
            </select>
          </div>

          {/* New Fingerprint Section */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Fingerprint
            </label>
            <div className="mt-1 flex items-center space-x-4 p-2 border border-gray-300 rounded-md">
              <button
                type="button"
                onClick={handleCaptureFingerprint}
                disabled={fingerprintStatus === "capturing"}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-wait"
              >
                {fingerprintStatus === "capturing" ? "Capturing..." : "Capture"}
              </button>
              <div className="flex-1 text-center">
                <span
                  className={`px-3 py-1 text-sm font-medium rounded-full transition-colors duration-300 ${getStatusIndicatorClasses()}`}
                >
                  {fingerprintMessage}
                </span>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={fingerprintStatus !== "success"}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-gray-400"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
