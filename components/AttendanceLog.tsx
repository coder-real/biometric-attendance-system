import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import { AttendanceRecord, Attendance, Student, Course } from '../types';
import Spinner from './Spinner';
import LocationModal from './LocationModal';
import { Download, CheckCircle, XCircle, Trash2, Filter } from 'lucide-react';
import Toast from './Toast';
import ConfirmModal from './ConfirmModal';
import { deleteDoc, doc, writeBatch } from 'firebase/firestore';

export default function AttendanceLog() {
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [students, setStudents] = useState<Map<string, Student>>(new Map());
  const [courses, setCourses] = useState<Map<string, Course>>(new Map());
  const [loading, setLoading] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState<{lat: number, lon: number} | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<string>('all'); // 'all' or courseId
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [deletingLogId, setDeletingLogId] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

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
  }, []);

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const exportToCSV = () => {
    const dataToExport = selectedCourse === 'all' ? enrichedAttendance : filteredAttendance;
    const courseName = selectedCourse === 'all' ? 'All_Courses' : courses.get(selectedCourse)?.name?.replace(/\s+/g, '_') || 'Unknown';
    
    const headers = ["Student Name", "Course Name", "Join Time", "Sign Out Time", "Status", "Latitude", "Longitude", "Location"];
    const rows = dataToExport.map(record => [
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
        link.setAttribute("download", `attendance_${courseName}.csv`);
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

  const filteredAttendance = useMemo<AttendanceRecord[]>(() => {
    if (selectedCourse === 'all') {
      return enrichedAttendance;
    }
    return enrichedAttendance.filter(att => att.courseId === selectedCourse);
  }, [enrichedAttendance, selectedCourse]);

  const handleClearHistory = () => {
    if (attendance.length === 0) return;

    setConfirmModal({
        isOpen: true,
        title: 'Clear All History',
        message: `Are you sure you want to delete ALL ${attendance.length} attendance records?\n\nThis action CANNOT be undone.`,
        onConfirm: async () => {
            setConfirmModal({ ...confirmModal, isOpen: false });
            setLoading(true);

            try {
                // Determine which records to delete (filtered or all? User asked for "all csv logs", likely implies all visible or all globally)
                // Let's stick to "All logs currently loaded" (which is global attendance based on the query)
                // If filtering is applied, we should probably ask if they delete ALL or just Filtered.
                // For simplicity/safety, let's delete ALL records found in the `attendance` state.
                
                const batchSize = 500;
                const recordsToDelete = attendance; // All records
                
                for (let i = 0; i < recordsToDelete.length; i += batchSize) {
                    const batch = writeBatch(db);
                    const chunk = recordsToDelete.slice(i, i + batchSize);
                    
                    chunk.forEach(record => {
                        const ref = doc(db, "attendance", record.id);
                        batch.delete(ref);
                    });
                    
                    await batch.commit();
                }

                setToast({
                    type: 'success',
                    message: 'All attendance history cleared successfully.'
                });
            } catch (error) {
                console.error("Error clearing history:", error);
                setToast({
                    type: 'error',
                    message: 'Failed to clear history.'
                });
            } finally {
                setLoading(false);
            }
        }
    });
  };

  const handleDeleteLog = (record: AttendanceRecord) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Attendance Record',
      message: `Are you sure you want to delete this attendance record?\n\n` +
        `Student: ${record.studentName}\n` +
        `Course: ${record.courseName}\n` +
        `Time: ${record.joinTime.toDate().toLocaleString()}\n\n` +
        `This action cannot be undone!`,
      onConfirm: async () => {
        setConfirmModal({ ...confirmModal, isOpen: false });
        setDeletingLogId(record.id);
        
        try {
          await deleteDoc(doc(db, "attendance", record.id));
          setToast({
            type: 'success',
            message: 'Attendance record deleted successfully!'
          });
        } catch (error) {
          console.error("Error deleting attendance:", error);
          setToast({
            type: 'error',
            message: 'Failed to delete attendance record.'
          });
        } finally {
          setDeletingLogId(null);
        }
      }
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="bg-white shadow-xl rounded-lg p-8">
      <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Live Attendance Log</h1>
          <p className="text-sm text-gray-500 mt-1">
            {filteredAttendance.length} {filteredAttendance.length === 1 ? 'record' : 'records'}
            {selectedCourse !== 'all' && ` for ${courses.get(selectedCourse)?.name}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg">
            <Filter size={16} className="text-gray-500" />
            <select
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              className="bg-transparent border-none text-sm text-gray-900 focus:ring-0 focus:outline-none cursor-pointer"
            >
              <option value="all">All Courses</option>
              {Array.from(courses.values()).map((course: Course) => (
                <option key={course.id} value={course.id}>
                  {course.name}
                </option>
              ))}
            </select>
          </div>
          <button 
              onClick={exportToCSV}
              disabled={filteredAttendance.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
              <Download size={18} />
              Export CSV
          </button>
          
          <button 
              onClick={handleClearHistory}
              disabled={loading || attendance.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 border border-red-200 rounded-lg hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
              <Trash2 size={18} />
              Clear History
          </button>
        </div>
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
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredAttendance.length > 0 ? filteredAttendance.map((record) => (
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
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <button
                    onClick={() => handleDeleteLog(record)}
                    disabled={deletingLogId === record.id}
                    className="text-red-600 hover:text-red-800 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                    title="Delete record"
                  >
                    <Trash2 size={16} />
                    {deletingLogId === record.id && <span className="text-xs">Deleting...</span>}
                  </button>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={8} className="px-6 py-4 text-center text-sm text-gray-500">No attendance records yet.</td>
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

      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        variant="danger"
        confirmText="Delete"
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal({ ...confirmModal, isOpen: false })}
      />
    </div>
  );
}