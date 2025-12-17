import React, { useState, useEffect } from 'react';
import { db } from '../services/firebase';
import { collection, onSnapshot, getDocs, doc, addDoc, updateDoc, query, where, Timestamp } from 'firebase/firestore';
import { Course, Session } from '../types';
import Spinner from './Spinner';

export default function SessionManagement() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCourses = async () => {
        try {
            const coursesSnapshot = await getDocs(collection(db, "courses"));
            const coursesData = coursesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course));
            setCourses(coursesData);
        } catch (error) {
            console.error("Error fetching courses:", error);
        }
    };

    const unsubscribeSessions = onSnapshot(collection(db, "sessions"), (snapshot) => {
        const sessionsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Session));
        setSessions(sessionsData);
        setLoading(false);
    }, (error) => {
        console.error("Error fetching sessions:", error);
        setLoading(false);
    });

    fetchCourses();
    return () => unsubscribeSessions();
  }, []);
  
  const handleToggleSession = async (courseId: string) => {
    const activeSessionQuery = query(collection(db, "sessions"), where("courseId", "==", courseId), where("active", "==", true));
    const activeSessionSnapshot = await getDocs(activeSessionQuery);

    if (activeSessionSnapshot.empty) {
        // No active session, so start one
        await addDoc(collection(db, "sessions"), {
            courseId: courseId,
            startTime: Timestamp.now(),
            endTime: null,
            active: true
        });
    } else {
        // Active session exists, so end it
        const sessionDoc = activeSessionSnapshot.docs[0];
        await updateDoc(doc(db, "sessions", sessionDoc.id), {
            endTime: Timestamp.now(),
            active: false
        });
    }
  };

  const getCourseName = (courseId: string) => {
    return courses.find(c => c.id === courseId)?.name || 'Unknown Course';
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
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Manage Class Sessions</h1>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Course Name</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th scope="col" className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {courses.length > 0 ? courses.map((course) => {
                const isActive = sessions.some(s => s.courseId === course.id && s.active);
                return (
                  <tr key={course.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{course.name} ({course.code})</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button 
                        onClick={() => handleToggleSession(course.id)} 
                        className={`px-4 py-2 text-white font-medium rounded-md ${isActive ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}>
                        {isActive ? 'End Session' : 'Start Session'}
                      </button>
                    </td>
                  </tr>
                )
            }) : (
              <tr>
                <td colSpan={3} className="px-6 py-4 text-center text-sm text-gray-500">No courses found. Add courses first.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}