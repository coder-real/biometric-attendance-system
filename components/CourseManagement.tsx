import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, query, where, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Course } from '../types';
import CourseModal from './CourseModal';
import Spinner from './Spinner';

export default function CourseManagement() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = onSnapshot(collection(db, "courses"), (snapshot) => {
      const coursesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Course));
      setCourses(coursesData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching courses:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleFormSubmit = async (courseData: Omit<Course, 'id'>) => {
    try {
      // 1. Add the new course and get its ID
      const courseRef = await addDoc(collection(db, 'courses'), courseData);
      const newCourseId = courseRef.id;

      // 2. Find all students matching the department and level
      const studentsQuery = query(
        collection(db, "students"),
        where("department", "==", courseData.department),
        where("level", "==", courseData.level)
      );
      const querySnapshot = await getDocs(studentsQuery);

      // 3. Create a batch write to enroll all matching students
      if (!querySnapshot.empty) {
        const batch = writeBatch(db);
        querySnapshot.forEach((studentDoc) => {
          const courseStudentRef = doc(collection(db, "courseStudents")); // Create a new doc ref
          batch.set(courseStudentRef, {
            courseId: newCourseId,
            studentId: studentDoc.id,
          });
        });
        await batch.commit(); // Commit the batch
      }
      
      handleCloseModal();
    } catch (error) {
      console.error("Error saving course and enrolling students:", error);
    }
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
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Manage Courses</h1>
        <button
          onClick={handleOpenModal}
          className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-md hover:bg-indigo-700"
        >
          Add Course
        </button>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Course Name</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Course Code</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Level</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {courses.length > 0 ? courses.map((course) => (
              <tr key={course.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{course.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{course.code}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{course.department}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{course.level}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">No courses found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <CourseModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onSubmit={handleFormSubmit}
        />
      )}
    </div>
  );
}