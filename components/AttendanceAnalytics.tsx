import React, { useState, useEffect, useMemo } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../services/firebase";
import {
  Course,
  Student,
  Session,
  Attendance,
  StudentAnalytics,
} from "../types";
import Spinner from "./Spinner";
import LocationModal from "./LocationModal";

export default function AttendanceAnalytics() {
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<Course[]>([]);
  const [students, setStudents] = useState<Map<string, Student>>(new Map());
  const [sessions, setSessions] = useState<Session[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<Attendance[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [selectedLocation, setSelectedLocation] = useState<{lat: number, lon: number} | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [coursesSnap, studentsSnap, sessionsSnap, attendanceSnap] =
          await Promise.all([
            getDocs(collection(db, "courses")),
            getDocs(collection(db, "students")),
            getDocs(collection(db, "sessions")),
            getDocs(collection(db, "attendance")),
          ]);

        const coursesData = coursesSnap.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() } as Course)
        );
        const studentsMap = new Map<string, Student>(
          studentsSnap.docs.map((doc) => [
            doc.id,
            { id: doc.id, ...doc.data() } as Student,
          ])
        );
        const sessionsData = sessionsSnap.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() } as Session)
        );
        const attendanceData = attendanceSnap.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() } as Attendance)
        );

        setCourses(coursesData);
        setStudents(studentsMap);
        setSessions(sessionsData);
        setAttendanceRecords(attendanceData);

        if (coursesData.length > 0) {
          setSelectedCourseId(coursesData[0].id);
        }
      } catch (error) {
        console.error("Error fetching analytics data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const analyticsData = useMemo<StudentAnalytics[]>(() => {
    if (!selectedCourseId || students.size === 0) return [];

    const selectedCourse = courses.find((c) => c.id === selectedCourseId);
    if (!selectedCourse) return [];

    const totalClasses = sessions.filter(
      (s) => s.courseId === selectedCourseId
    ).length;

    // Dynamically find enrolled students by matching department and level
    // FIX: Explicitly type the 'student' parameter to resolve type inference issues.
    const enrolledStudents = Array.from(students.values()).filter(
      (student: Student) =>
        student.department === selectedCourse.department &&
        student.level === selectedCourse.level
    );

    if (enrolledStudents.length === 0) return [];

    // FIX: Explicitly type the 'student' parameter to resolve type inference issues.
    return enrolledStudents.map((student: Student) => {
      const studentAttendanceRecords = attendanceRecords.filter(
        (ar) => ar.studentId === student.id && ar.courseId === selectedCourseId
      );

      const attendedClasses = studentAttendanceRecords.length;
      const attendancePercentage =
        totalClasses > 0 ? (attendedClasses / totalClasses) * 100 : 0;

      // Get latest GPS coordinates from attendance records if available
      let latitude: number | undefined = undefined;
      let longitude: number | undefined = undefined;
      if (studentAttendanceRecords.length > 0) {
        const latestRecord =
          studentAttendanceRecords[studentAttendanceRecords.length - 1];
        latitude = latestRecord.latitude;
        longitude = latestRecord.longitude;
      }

      return {
        studentDocId: student.id,
        studentId: student.studentId,
        studentName: student.name,
        totalClasses,
        attendedClasses,
        attendancePercentage: Math.round(attendancePercentage),
        latitude,
        longitude,
      };
    });
  }, [selectedCourseId, courses, students, sessions, attendanceRecords]);

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="bg-white shadow-xl rounded-lg p-6 md:p-8">
      <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold text-gray-900">
          Attendance Analytics
        </h1>
        {courses.length > 0 && (
          <div>
            <label htmlFor="course-select" className="sr-only">
              Select a course
            </label>
            <select
              id="course-select"
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              className="block w-full md:w-auto pl-3 pr-10 py-2 text-base bg-white border-gray-300 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            >
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name} ({course.code})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Student Name
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Student ID
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Total Classes
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Classes Attended
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Attendance %
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Coordinates
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Map
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {analyticsData.length > 0 ? (
              analyticsData.map((data) => (
                <tr key={data.studentDocId} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {data.studentName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {data.studentId}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {data.totalClasses}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {data.attendedClasses}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex items-center">
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div
                          className="bg-indigo-600 h-2.5 rounded-full"
                          style={{ width: `${data.attendancePercentage}%` }}
                        ></div>
                      </div>
                      <span className="ml-3 font-medium w-12 text-right">
                        {data.attendancePercentage}%
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {data.latitude && data.longitude ? (
                        <span className="font-mono text-xs">
                            {data.latitude.toFixed(6)}, {data.longitude.toFixed(6)}
                        </span>
                    ) : (
                        <span className="text-gray-400">No Data</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {data.latitude && data.longitude ? (
                        <button 
                            onClick={() => setSelectedLocation({lat: data.latitude!, lon: data.longitude!})}
                            className="text-blue-600 hover:text-blue-900 flex items-center text-xs font-medium"
                        >
                           <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                           </svg>
                           View Map
                        </button>
                    ) : (
                        <span className="text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={7}
                  className="px-6 py-4 text-center text-sm text-gray-500"
                >
                  {courses.length === 0
                    ? "No courses found."
                    : "No analytics to display. Ensure students are enrolled and sessions have been conducted."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <LocationModal 
        isOpen={!!selectedLocation}
        onClose={() => setSelectedLocation(null)}
        latitude={selectedLocation?.lat}
        longitude={selectedLocation?.lon}
      />
    </div>
  );
}
