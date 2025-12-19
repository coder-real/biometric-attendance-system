import React, { useEffect, useRef } from "react";
import { db } from "../services/firebase";
import { reverseGeocode } from "../services/geocoding";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  Timestamp,
  onSnapshot,
} from "firebase/firestore";
import { Attendance } from "../types";

// Global Lock Set (outside component to survive remounts)
const globalPendingAttendance = new Set<string>();

export default function GlobalAttendanceListener() {
  const ws = useRef<WebSocket | null>(null);
  const lastKnownGPS = useRef<{ latitude: number | null; longitude: number | null }>({
    latitude: null,
    longitude: null,
  });

  // Data Caches
  const [coursesCache, setCoursesCache] = React.useState<Map<string, any>>(new Map());
  const [activeSessionsCache, setActiveSessionsCache] = React.useState<any[]>([]);
  const coursesRef = useRef(new Map());
  const sessionsRef = useRef<any[]>([]);

  // Track last processed verification to prevent duplicates
  const lastProcessedVerification = useRef<{
    id: string | null;
    timestamp: number;
  }>({ id: null, timestamp: 0 });

  // Sync refs with state for use in async functions
  useEffect(() => {
      coursesRef.current = coursesCache;
  }, [coursesCache]);

  useEffect(() => {
      sessionsRef.current = activeSessionsCache;
  }, [activeSessionsCache]);

  // DATA SUBSCRIPTIONS
  useEffect(() => {
      // Cache Courses
      const unsubCourses = onSnapshot(collection(db, "courses"), (snapshot) => {
          const map = new Map();
          snapshot.docs.forEach(doc => map.set(doc.id, { id: doc.id, ...doc.data() }));
          setCoursesCache(map);
          console.log(`📦 Cached ${snapshot.size} courses`);
      });

      // Cache Active Sessions
      const qSessions = query(collection(db, "sessions"), where("active", "==", true));
      const unsubSessions = onSnapshot(qSessions, (snapshot) => {
          const sessions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setActiveSessionsCache(sessions);
          console.log(`📦 Cached ${snapshot.size} active sessions`);
      });

      return () => {
          unsubCourses();
          unsubSessions();
      };
  }, []);

  useEffect(() => {
    // Connect to the bridge server
    ws.current = new WebSocket("ws://localhost:5000");

    ws.current.onopen = () => {
      console.log("Global Listener connected to bridge.");
    };

    ws.current.onmessage = async (event) => {
      try {
        const message = JSON.parse(event.data);
        
        if (message.type === "ESP32_STATUS") {
           // Cache the latest GPS coordinates
           if (message.data && message.data.type === "STATUS") {
               if (message.data.lat && message.data.lon) {
                   lastKnownGPS.current = {
                       latitude: message.data.lat,
                       longitude: message.data.lon
                   };
               }
           }
        } else if (message.type === "VERIFY_RESPONSE" && message.success) {
           // Handle fingerprint verification
           const verificationId = message.id?.toString();
           const now = Date.now();
           const timeSinceLastProcess = now - lastProcessedVerification.current.timestamp;
           
           const isDuplicate = 
             lastProcessedVerification.current.id === verificationId && 
             timeSinceLastProcess < 5000;
           
           if (!isDuplicate) {
             lastProcessedVerification.current = {
               id: verificationId,
               timestamp: now
             };
             
             const lat = message.latitude || message.lat || lastKnownGPS.current.latitude;
             const lon = message.longitude || message.lon || lastKnownGPS.current.longitude;

             await handleAttendance({
               id: message.id,
               latitude: lat,
               longitude: lon 
             });
           } else {
             console.log(`⚠️ Skipping duplicate verification for ID ${verificationId}`);
           }
        }
      } catch (e) {
        // Ignore non-JSON
      }
    };

    ws.current.onclose = () => {
      // Reconnect handled by user refresh or simple timeout
    };

    return () => {
      if (ws.current) ws.current.close();
    };
  }, []);

  const handleAttendance = async (data: any) => {
    const { id: fingerprintId, latitude: payloadLat, longitude: payloadLon } = data;
    const latitude = payloadLat || lastKnownGPS.current.latitude;
    const longitude = payloadLon || lastKnownGPS.current.longitude;

    // 1. Find student (Try to optimize this later if needed, for now query is necessary)
      const studentsRef = collection(db, "students");
      const q = query(
        studentsRef,
        where("fingerprintTemplate", "==", fingerprintId.toString())
      );
      // This is the only critical network read now
      const studentSnapshot = await getDocs(q);

      if (studentSnapshot.empty) {
        console.warn(`⚠️ Unknown fingerprint ID: ${fingerprintId}`);
        return;
      }

      const studentDoc = studentSnapshot.docs[0];
      const studentData = studentDoc.data();
      const studentId = studentDoc.id;

      // 2. Find matching active session from CACHE (Instant)
      // Use refs to access latest data without dependency execution
      const activeSessions = sessionsRef.current;
      const coursesMap = coursesRef.current;

      if (activeSessions.length === 0) {
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
          ws.current.send(JSON.stringify({
            type: "NO_ACTIVE_SESSION",
            studentName: studentData.name,
            message: "No active sessions available"
          }));
        }
        return;
      }

      let matchedSession = null;
      let matchedCourseId = null;

      for (const sData of activeSessions) {
          const cData = coursesMap.get(sData.courseId);
          if (cData && cData.department === studentData.department && cData.level === studentData.level) {
              matchedSession = sData;
              matchedCourseId = sData.courseId;
              break;
          }
      }

      if (!matchedSession) {
           if (ws.current && ws.current.readyState === WebSocket.OPEN) {
             ws.current.send(JSON.stringify({
               type: "NO_MATCHING_SESSION",
               studentName: studentData.name,
               department: studentData.department,
               level: studentData.level,
               message: "No active session for your department and level"
             }));
           }
           return;
      }

      const sessionId = matchedSession.id;
      const courseId = matchedCourseId;

      // 4. Memory Lock to prevent race conditions
      const lockKey = `${studentId}-${sessionId}`;
      if (globalPendingAttendance.has(lockKey)) {
           console.warn(`🔒 Blocked duplicate processing for ${studentData.name} (Global Locked)`);
           // Optional: Send feedback if needed
           if (ws.current && ws.current.readyState === WebSocket.OPEN) {
             ws.current.send(JSON.stringify({
               type: "DUPLICATE_ATTENDANCE",
               studentName: studentData.name,
               message: "Processing previous request..."
             }));
           }
           return;
      }
      globalPendingAttendance.add(lockKey);

      try {
      // 3. Mark attendance
      // Check for EXISTING status (Network Read 2 - Necessary for Toggle)
      const attendanceRef = collection(db, "attendance");
      const attendanceQuery = query(
        attendanceRef,
        where("studentId", "==", studentId),
        where("sessionId", "==", sessionId)
      );
      const existingAttendance = await getDocs(attendanceQuery);

      // --- CRITICAL PATH OPTIMIZATION ---
      // Decide IN or OUT and broadast UI IMMEDIATELY
      // Do not wait for Geocoding or DB Write

      if (!existingAttendance.empty) {
        const attendanceDoc = existingAttendance.docs[0];
        const attendanceData = attendanceDoc.data();

        if (attendanceData.signOutTime) {
             if (ws.current && ws.current.readyState === WebSocket.OPEN) {
                ws.current.send(JSON.stringify({
                    type: "SESSION_COMPLETED",
                    studentName: studentData.name,
                    message: "Session already completed"
                }));
             }
             return;
        }

        // --- OPTIMISTIC UI BROADCAST: SIGN OUT ---
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({
                type: "SIGNED_OUT",
                studentName: studentData.name,
                studentId: studentData.studentId,
                department: studentData.department,
                courseName: coursesMap.get(courseId)?.name || "Unknown Course",
                attendancePercentage: 0, 
                message: "Signed Out Successfully"
            }));
        }

        // Background Write: Sign Out
        console.log(`ℹ️ Signing out ${studentData.name} (Background)`);
        updateDoc(attendanceDoc.ref, {
            signOutTime: Timestamp.now()
        })
        .then(() => globalPendingAttendance.delete(lockKey))
        .catch(err => {
            console.error("❌ SignOut Write Failed:", err);
            globalPendingAttendance.delete(lockKey);
        });
        
        return;
      }

      // --- OPTIMISTIC UI BROADCAST: SIGN IN ---
      // Calculate weak percentage or just verify
      const courseName = coursesMap.get(courseId)?.name || "Unknown Course";
      
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
          ws.current.send(JSON.stringify({
              type: "ATTENDANCE",
              studentName: studentData.name,
              studentId: studentData.studentId,
              department: studentData.department,
              courseName: courseName,
              attendancePercentage: 0, // Placeholder to be fast
              message: "Signed In Successfully"
          }));
      }

      // Background Write: Sign In
      // This happens AFTER UI is already entered
      (async () => {
          const locationName = latitude && longitude 
            ? await reverseGeocode(latitude, longitude)
            : 'No GPS';

          await addDoc(attendanceRef, {
            studentId,
            courseId,
            sessionId,
            joinTime: Timestamp.now(),
            verified: true,
            verificationMethod: "fingerprint",
            latitude: latitude || null,
            longitude: longitude || null,
            locationName: locationName,
          });

          console.log(`✅ Attendance Logged: ${studentData.name} | 📍 ${locationName}`);
      })()
      .then(() => globalPendingAttendance.delete(lockKey))
      .catch(err => {
          console.error("❌ Attendance Write Failed:", err);
          globalPendingAttendance.delete(lockKey);
      });


    } catch (error) {
      console.error("❌ Attendance error:", error);
      globalPendingAttendance.delete(lockKey);
    }
  };

  return null;
}
