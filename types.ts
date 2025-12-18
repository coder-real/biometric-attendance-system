import type { User } from "firebase/auth";
import type { Timestamp } from "firebase/firestore";

export interface AdminData {
  name: string;
  role: string;
  email: string;
}

export interface AuthContextType {
  currentUser: User | null;
  adminData: AdminData | null;
  loading: boolean;
}

export interface Student {
  id: string;
  studentId: string;
  name: string;
  department: string;
  level: string;
  fingerprintTemplate: string;
}

export interface Course {
  id: string;
  name: string;
  code: string;
  department: string;
  level: string;
}

export interface CourseStudent {
  id: string;
  courseId: string;
  studentId: string;
}

export interface Session {
  id: string;
  courseId: string;
  startTime: Timestamp;
  endTime: Timestamp | null;
  active: boolean;
}

export interface Attendance {
  id: string;
  studentId: string;
  courseId: string;
  sessionId: string;
  joinTime: Timestamp;
  verified: boolean;
  latitude?: number;
  longitude?: number;
  locationName?: string;
  signOutTime?: Timestamp | null;
}

export interface AttendanceRecord extends Attendance {
  studentName: string;
  courseName: string;
}

export interface StudentAnalytics {
  studentDocId: string;
  studentId: string;
  studentName: string;
  totalClasses: number;
  attendedClasses: number;
  attendancePercentage: number;
  latitude?: number; // new
  longitude?: number; // new
}
export interface AccessCardData {
  name: string;
  studentId: string;
  department: string;
  courseName: string;
  attendancePercentage: number;
  status?: "entry" | "exit";
}

export interface BridgeStatus {
  esp32Connected: boolean;
  webClients: number;
  uptime: number;
  timestamp: string;
  esp32Status?: {
    wifi: boolean;
    fingerprint: boolean;
    gps: boolean;
    gpsFixed: boolean;
    satellites: number;
    ip: string;
  };
}
