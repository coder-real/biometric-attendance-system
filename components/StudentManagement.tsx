import React, { useState, useEffect } from "react";
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { db } from "../services/firebase";
import { Student } from "../types";
import StudentModal from "./StudentModal";
import Spinner from "./Spinner";

export default function StudentManagement() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [deletingStudentId, setDeletingStudentId] = useState<string | null>(
    null
  );

  useEffect(() => {
    setLoading(true);
    const unsubscribe = onSnapshot(
      collection(db, "students"),
      (snapshot) => {
        const studentsData = snapshot.docs.map(
          (doc) =>
            ({
              id: doc.id,
              ...doc.data(),
            } as Student)
        );
        setStudents(studentsData);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching students:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const handleOpenModal = (student: Student | null = null) => {
    setEditingStudent(student);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingStudent(null);
  };

  const handleFormSubmit = async (studentData: Omit<Student, "id">) => {
    try {
      if (editingStudent) {
        const studentDoc = doc(db, "students", editingStudent.id);
        await updateDoc(studentDoc, studentData);
      } else {
        await addDoc(collection(db, "students"), studentData);
      }
      handleCloseModal();
    } catch (error) {
      console.error("Error saving student:", error);
    }
  };

  const handleDeleteStudent = async (id: string) => {
    const studentToDelete = students.find((s) => s.id === id);
    if (!studentToDelete) {
      console.error("Student not found for deletion.");
      return;
    }

    // Case 1: No fingerprint registered, just delete from DB
    if (!studentToDelete.fingerprintTemplate) {
      if (
        window.confirm(
          "This student has no fingerprint registered. Are you sure you want to delete them from the database?"
        )
      ) {
        try {
          setDeletingStudentId(id);
          await deleteDoc(doc(db, "students", id));
        } catch (error) {
          console.error("Error deleting student from Firestore:", error);
          alert("Error deleting student from database.");
        } finally {
          setDeletingStudentId(null);
        }
      }
      return;
    }

    // Case 2: Fingerprint exists, confirm deletion from module and DB
    if (
      window.confirm(
        "Are you sure you want to delete this student? This will also remove their fingerprint from the scanner module."
      )
    ) {
      setDeletingStudentId(id);

      const ws = new WebSocket("ws://localhost:5000");

      ws.onopen = () => {
        console.log("Connected to fingerprint bridge for deletion.");
        ws.send(`DELETE_FINGERPRINT:${studentToDelete.fingerprintTemplate}`);
      };

      ws.onmessage = async (event) => {
        try {
          const response = JSON.parse(event.data);
          
          if (response.type === "DELETE_RESPONSE") {
             if (response.success) {
                try {
                  await deleteDoc(doc(db, "students", id));
                  alert("Student and fingerprint deleted successfully.");
                } catch (error) {
                  console.error("Firestore delete error:", error);
                  alert("Fingerprint deleted, but database cleanup failed.");
                }
             } else {
               alert(`Failed to delete fingerprint: ${response.error || "Unknown error"}`);
             }
             ws.close();
          }
        } catch (e) {
          console.log("Ignored non-JSON message during delete");
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket Error:", error);
        alert(
          "Could not connect to the fingerprint bridge. Please ensure it is running and refresh the page."
        );
        setDeletingStudentId(null);
        if (
          ws.readyState === WebSocket.OPEN ||
          ws.readyState === WebSocket.CONNECTING
        ) {
          ws.close();
        }
      };

      ws.onclose = () => {
        console.log("Disconnected from fingerprint bridge.");
        setDeletingStudentId(null);
      };
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
    <div className="bg-white shadow-xl rounded-lg p-6 md:p-8">
      <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Manage Students</h1>
        <button
          onClick={() => handleOpenModal()}
          className="px-5 py-2.5 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors duration-200"
        >
          Add Student
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Name
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
                Department
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Level
              </th>
              <th scope="col" className="relative px-6 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {students.length > 0 ? (
              students.map((student) => (
                <tr key={student.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {student.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {student.studentId}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {student.department}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {student.level}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-4">
                    <button
                      onClick={() => handleOpenModal(student)}
                      className="text-indigo-600 hover:text-indigo-900"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteStudent(student.id)}
                      disabled={deletingStudentId === student.id}
                      className="text-red-600 hover:text-red-900 disabled:text-gray-400 disabled:cursor-wait"
                    >
                      {deletingStudentId === student.id
                        ? "Deleting..."
                        : "Delete"}
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={5}
                  className="px-6 py-4 text-center text-sm text-gray-500"
                >
                  No students found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <StudentModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onSubmit={handleFormSubmit}
          studentData={editingStudent}
        />
      )}
    </div>
  );
}
