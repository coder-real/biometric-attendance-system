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
} from "firebase/firestore";
import { Attendance } from "../types";

export default function GlobalAttendanceListener() {
  const ws = useRef<WebSocket | null>(null);
  const lastKnownGPS = useRef<{ latitude: number | null; longitude: number | null }>({
    latitude: null,
    longitude: null,
  });

  useEffect(() => {
    // Connect to the bridge server
    ws.current = new WebSocket("ws://localhost:5000");

    ws.current.onopen = () => {
      console.log("Global Listener connected to bridge.");
    };

    ws.current.onmessage = async (event) => {
      try {
        const message = JSON.parse(event.data);
        
        if (message.type === "ATTENDANCE") {
          await handleAttendance(message.data);
        } else if (message.type === "ESP32_STATUS") {
           // Cache the latest GPS coordinates from status updates
           if (message.data && message.data.type === "STATUS") {
               if (message.data.lat && message.data.lon) {
                   lastKnownGPS.current = {
                       latitude: message.data.lat,
                       longitude: message.data.lon
                   };
               }
           }
        } else if (message.type === "VERIFY_RESPONSE" && message.success) {
           // Use provided coords or fallback to cached last known GPS
           const lat = message.latitude || message.lat || lastKnownGPS.current.latitude;
           const lon = message.longitude || message.lon || lastKnownGPS.current.longitude;

           await handleAttendance({
             id: message.id,
             latitude: lat,
             longitude: lon 
           });
        }
      } catch (e) {
        // Ignore non-JSON or other message types
      }
    };

    // Reconnect logic on close
    ws.current.onclose = () => {
      setTimeout(() => {
        // Simple reconnect attempt
        if (ws.current?.readyState === WebSocket.CLOSED) {
            // Trigger re-render or let the effect run again if dependency changes
            // For now, simpler to just let the user refresh or rely on component remount
        }
      }, 5000);
    };

    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, []);

  const handleAttendance = async (data: any) => {
    const { id: fingerprintId, latitude: payloadLat, longitude: payloadLon } = data;
    
    // Use payload coords or fallback to cached
    const latitude = payloadLat || lastKnownGPS.current.latitude;
    const longitude = payloadLon || lastKnownGPS.current.longitude;

    try {
      // 1. Find student by fingerprint template ID
      const studentsRef = collection(db, "students");
      const q = query(
        studentsRef,
        where("fingerprintTemplate", "==", fingerprintId.toString())
      );
      const studentSnapshot = await getDocs(q);

      if (studentSnapshot.empty) {
        console.warn(`⚠️ Unknown fingerprint ID: ${fingerprintId}`);
        return;
      }

      const studentDoc = studentSnapshot.docs[0];
      const studentData = studentDoc.data();
      const studentId = studentDoc.id; // Firestore ID

      // 2. Find matching active session logic
      interface Session {
        id: string;
        courseId: string;
        active: boolean;
      }

      const sessionsRef = collection(db, "sessions");
      const activeSessionsQuery = query(sessionsRef, where("active", "==", true));
      const activeSessionsSnapshot = await getDocs(activeSessionsQuery);

      if (activeSessionsSnapshot.empty) {
        console.warn("⚠️ No active sessions found");
        return;
      }

      // Fetch all courses to match against
      const coursesRef = collection(db, "courses");
      const coursesSnapshot = await getDocs(coursesRef);
      // Create a map for quick lookup
      const coursesMap = new Map();
      coursesSnapshot.docs.forEach(doc => {
          coursesMap.set(doc.id, { id: doc.id, ...doc.data() });
      });

      let matchedSession = null;
      let matchedCourseId = null;

      // Iterate to find the session that matches student's criteria
      for (const doc of activeSessionsSnapshot.docs) {
          const sData = doc.data();
          const cData = coursesMap.get(sData.courseId);

          if (cData && cData.department === studentData.department && cData.level === studentData.level) {
              matchedSession = doc;
              matchedCourseId = sData.courseId;
              break; // Found the right session
          }
      }

      if (!matchedSession) {
          console.warn(`⚠️ No matching session for ${studentData.name}`);
          return;
      }

      const sessionId = matchedSession.id;
      const courseId = matchedCourseId;

      // 3. Mark attendance
      // Check if already marked for this session
      const attendanceRef = collection(db, "attendance");
      const attendanceQuery = query(
        attendanceRef,
        where("studentId", "==", studentId),
        where("sessionId", "==", sessionId)
      );
      const existingAttendance = await getDocs(attendanceQuery);

      if (!existingAttendance.empty) {
        const attendanceDoc = existingAttendance.docs[0];
        const attendanceData = attendanceDoc.data();

        // Check if already signed out
        if (attendanceData.signOutTime) {
             console.log(`ℹ️ Session completed for ${studentData.name}`);
             if (ws.current && ws.current.readyState === WebSocket.OPEN) {
                ws.current.send(JSON.stringify({
                    type: "SESSION_COMPLETED",
                    studentName: studentData.name,
                    message: "Session already completed"
                }));
             }
             return;
        }

        // Perform Sign Out
        console.log(`ℹ️ Signing out ${studentData.name}`);
        await updateDoc(attendanceDoc.ref, {
            signOutTime: Timestamp.now()
        });

        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({
                type: "SIGNED_OUT",
                studentName: studentData.name,
                message: "Signed Out Successfully"
            }));
        }
        return;
      }

      // Create new attendance record
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

      console.log(`✅ Attendance: ${studentData.name} | 📍 ${locationName}`);

    } catch (error) {
      console.error("❌ Attendance error:", error);
    }
  };

  return null; // Headless component, renders nothing
}
