import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import { AttendanceRecord, Attendance, Student, Course } from '../types';
import Spinner from './Spinner';
import LocationModal from './LocationModal';
import { Download, CheckCircle, XCircle } from 'lucide-react';

export default function AttendanceLog() {
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [students, setStudents] = useState<Map<string, Student>>(new Map());
  const [courses, setCourses] = useState<Map<string, Course>>(new Map());
  const [loading, setLoading] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState<{lat: number, lon: number} | null>(null);

  useEffect(() => {
    const fetchStudentsAndCourses = async () => {
        try {
            const studentsSnapshot = await getDocs(collection(db, "students"));
            const studentsMap = new Map<string, Student>(studentsSnapshot.docs.map(doc => [doc.id, { id: doc.id, ...doc.data() } as Student]));
            setStudents(studentsMap);

            const coursesSnapshot = await getDocs(collection(db, "courses"));
            const coursesMap = new Map<string, Course>(coursesSnapshot.docs.map(doc => [doc.id, { id: doc.id, ...doc.data() } as Course]));
            setCourses(coursesMap);
        } catch (error) {
            console.error("Error fetching students and courses:", error);
        }
    };

    fetchStudentsAndCourses();

    const q = query(collection(db, "attendance"), orderBy("joinTime", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const attendanceData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as Attendance));
        setAttendance(attendanceData);
        setLoading(false);
    }, (error) => {
        console.error("Error fetching attendance:", error);
        setLoading(false);
    });

    return () => unsubscribe();
    return () => unsubscribe();
  }, []);

  const exportToCSV = () => {
    const headers = ["Student Name", "Course Name", "Join Time", "Sign Out Time", "Status", "Latitude", "Longitude", "Location"];
    const rows = enrichedAttendance.map(record => [
        record.studentName,
        record.courseName,
        record.joinTime.toDate().toLocaleString(),
        record.signOutTime ? record.signOutTime.toDate().toLocaleString() : "-",
        record.signOutTime ? "Signed Out" : "Signed In",
        record.latitude || "",
        record.longitude || "",
        record.locationName || ""
    ]);

    const csvContent = [
        headers.join(","),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", "attendance_log.csv");
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
  };

  const enrichedAttendance = useMemo<AttendanceRecord[]>(() => {
    return attendance.map(att => ({
        ...att,
        studentName: students.get(att.studentId)?.name || 'Unknown Student',
        courseName: courses.get(att.courseId)?.name || 'Unknown Course',
    }));
  }, [attendance, students, courses]);

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="bg-white shadow-xl rounded-lg p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Live Attendance Log</h1>
        <button 
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
            <Download size={18} />
            Export CSV
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student Name</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Course Name</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Join Time</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Coordinates</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Map</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {enrichedAttendance.length > 0 ? enrichedAttendance.map((record) => (
              <tr key={record.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{record.studentName}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{record.courseName}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {record.joinTime.toDate().toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                        {/* Sign In Indicator */}
                        <div className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold ${
                            !record.signOutTime 
                                ? "bg-green-100 text-green-700 border border-green-200"
                                : "bg-gray-100 text-gray-400 border border-gray-200"
                        }`}>
                            <div className={`w-2 h-2 rounded-full ${!record.signOutTime ? "bg-green-500" : "bg-gray-400"}`} />
                            IN
                        </div>

                        {/* Sign Out Indicator */}
                        <div className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold ${
                            record.signOutTime 
                                ? "bg-red-100 text-red-700 border border-red-200"
                                : "bg-gray-100 text-gray-400 border border-gray-200"
                        }`}>
                            <div className={`w-2 h-2 rounded-full ${record.signOutTime ? "bg-red-500" : "bg-gray-400"}`} />
                            OUT
                        </div>
                    </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {record.latitude && record.longitude ? (
                        <span className="font-mono text-xs">
                            {record.latitude.toFixed(6)}, {record.longitude.toFixed(6)}
                        </span>
                    ) : (
                        <span className="text-gray-400">No Data</span>
                    )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {record.latitude && record.longitude ? (
                        <button 
                            onClick={() => setSelectedLocation({ lat: record.latitude!, lon: record.longitude! })}
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
            )) : (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">No attendance records yet.</td>
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