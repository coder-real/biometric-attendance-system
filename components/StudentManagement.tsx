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
import Toast from "./Toast";
import ConfirmModal from "./ConfirmModal";

export default function StudentManagement() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [deletingStudentId, setDeletingStudentId] = useState<string | null>(
    null
  );
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [deleteAllProgress, setDeleteAllProgress] = useState({ current: 0, total: 0 });
  const [isClearingFingerprints, setIsClearingFingerprints] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    variant: 'danger' | 'warning' | 'info';
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', variant: 'warning', onConfirm: () => {} });

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

  // Auto-dismiss toast after 5 seconds
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

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
      setConfirmModal({
        isOpen: true,
        title: 'Delete Student',
        message: 'This student has no fingerprint registered. Are you sure you want to delete them from the database?',
        variant: 'danger',
        onConfirm: async () => {
          setConfirmModal({ ...confirmModal, isOpen: false });
          try {
            setDeletingStudentId(id);
            await deleteDoc(doc(db, "students", id));
            setToast({ type: 'success', message: 'Student deleted successfully!' });
          } catch (error) {
            console.error("Error deleting student from Firestore:", error);
            setToast({ type: 'error', message: 'Error deleting student from database.' });
          } finally {
            setDeletingStudentId(null);
          }
        }
      });
      return;
    }

    // Case 2: Fingerprint exists, confirm deletion from module and DB
    setConfirmModal({
      isOpen: true,
      title: 'Delete Student',
      message: 'Are you sure you want to delete this student? This will also remove their fingerprint from the scanner module.',
      variant: 'danger',
      onConfirm: () => {
        setConfirmModal({ ...confirmModal, isOpen: false });
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
                  setToast({ type: 'success', message: 'Student and fingerprint deleted successfully!' });
                } catch (error) {
                  console.error("Firestore delete error:", error);
                  setToast({ type: 'error', message: 'Fingerprint deleted, but database cleanup failed.' });
                }
             } else {
               setToast({ type: 'error', message: `Failed to delete fingerprint: ${response.error || "Unknown error"}` });
             }
             ws.close();
          }
        } catch (e) {
          console.log("Ignored non-JSON message during delete");
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket Error:", error);
        setToast({
          type: 'error',
          message: 'Could not connect to the fingerprint bridge. Please ensure it is running.'
        });
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
    });
  };

  const handleDeleteAll = async () => {
    if (students.length === 0) {
      setToast({ type: 'info', message: 'No students to delete.' });
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Delete All Students',
      message: `Are you sure you want to delete ALL ${students.length} students? This will:\n\n` +
        `1. Delete all fingerprint templates from the scanner module\n` +
        `2. Remove all students from the database\n\n` +
        `This action CANNOT be undone!`,
      variant: 'danger',
      onConfirm: () => {
        setConfirmModal({ ...confirmModal, isOpen: false });
        performBulkDelete();
      }
    });
  };

  const performBulkDelete = async () => {

    setIsDeletingAll(true);
    setDeleteAllProgress({ current: 0, total: students.length });

    const ws = new WebSocket("ws://localhost:5000");
    let currentIndex = 0;
    const studentsToDelete = [...students];
    const deletionResults: { success: number; failed: number } = { success: 0, failed: 0 };

    ws.onopen = () => {
      console.log("Connected to bridge for bulk deletion.");
      processNextStudent();
    };

    const processNextStudent = async () => {
      if (currentIndex >= studentsToDelete.length) {
        // All done
        ws.close();
        setIsDeletingAll(false);
        setToast({
          type: deletionResults.failed === 0 ? 'success' : 'info',
          message: `Deletion complete! ✅ ${deletionResults.success} deleted, ❌ ${deletionResults.failed} failed`
        });
        return;
      }

      const student = studentsToDelete[currentIndex];
      setDeleteAllProgress({ current: currentIndex + 1, total: studentsToDelete.length });

      // If no fingerprint, just delete from DB
      if (!student.fingerprintTemplate) {
        try {
          await deleteDoc(doc(db, "students", student.id));
          deletionResults.success++;
          console.log(`✅ Deleted student (no fingerprint): ${student.name}`);
        } catch (error) {
          console.error(`❌ Failed to delete ${student.name}:`, error);
          deletionResults.failed++;
        }
        currentIndex++;
        processNextStudent();
        return;
      }

      // Has fingerprint - send delete command to hardware
      console.log(`Deleting fingerprint ${student.fingerprintTemplate} for ${student.name}...`);
      ws.send(`DELETE_FINGERPRINT:${student.fingerprintTemplate}`);
    };

    ws.onmessage = async (event) => {
      try {
        const response = JSON.parse(event.data);
        
        if (response.type === "DELETE_RESPONSE") {
          const student = studentsToDelete[currentIndex];
          
          if (response.success) {
            // Delete from database after hardware confirms
            try {
              await deleteDoc(doc(db, "students", student.id));
              deletionResults.success++;
              console.log(`✅ Deleted: ${student.name}`);
            } catch (error) {
              console.error(`❌ Hardware deleted but DB failed for ${student.name}:`, error);
              deletionResults.failed++;
            }
          } else {
            console.error(`❌ Hardware delete failed for ${student.name}`);
            deletionResults.failed++;
          }
          
          currentIndex++;
          // Process next immediately for faster deletion
          processNextStudent();
        }
      } catch (e) {
        console.log("Non-JSON message during bulk delete");
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error during bulk delete:", error);
      setToast({
        type: 'error',
        message: `Connection error after deleting ${deletionResults.success} students. Please check the bridge.`
      });
      setIsDeletingAll(false);
      ws.close();
    };

    ws.onclose = () => {
      console.log("Bulk deletion connection closed.");
      setIsDeletingAll(false);
    };
  };

  const handleClearAllFingerprints = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Clear All Fingerprints',
      message: 'Are you sure you want to clear ALL fingerprints from the sensor module?\n\n' +
        'This will:\n' +
        '1. Erase all fingerprint templates from the hardware\n' +
        '2. Students will need to re-enroll their fingerprints\n\n' +
        'This action CANNOT be undone!',
      variant: 'danger',
      onConfirm: () => {
        setConfirmModal({ ...confirmModal, isOpen: false });
        performClearAllFingerprints();
      }
    });
  };

  const performClearAllFingerprints = () => {
    setIsClearingFingerprints(true);

    const ws = new WebSocket("ws://localhost:5000");
    let responseReceived = false;

    ws.onopen = () => {
      console.log("Connected to bridge for clearing fingerprints.");
      ws.send("CLEAR_ALL_FINGERPRINTS");
    };

    ws.onmessage = (event) => {
      try {
        const response = JSON.parse(event.data);
        
        if (response.type === "CLEAR_ALL_RESPONSE") {
          responseReceived = true;
          
          if (response.success) {
            setToast({
              type: 'success',
              message: 'All fingerprints cleared from sensor module!'
            });
            console.log("✅ All fingerprints cleared from hardware");
          } else {
            setToast({
              type: 'error',
              message: `Failed to clear fingerprints: ${response.error || 'Unknown error'}`
            });
            console.error("❌ Clear all failed:", response.error);
          }
          
          ws.close();
          setIsClearingFingerprints(false);
        }
      } catch (e) {
        console.log("Non-JSON message:", event.data);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      setToast({
        type: 'error',
        message: 'Could not connect to fingerprint bridge. Please ensure it is running.'
      });
      setIsClearingFingerprints(false);
      ws.close();
    };

    ws.onclose = () => {
      if (!responseReceived) {
        setToast({
          type: 'error',
          message: 'Connection closed before receiving response.'
        });
        setIsClearingFingerprints(false);
      }
      console.log("Clear all fingerprints connection closed.");
    };

    // Timeout after 10 seconds
    setTimeout(() => {
      if (!responseReceived && ws.readyState === WebSocket.OPEN) {
        ws.close();
        setToast({
          type: 'error',
          message: 'Operation timed out. Please try again.'
        });
        setIsClearingFingerprints(false);
      }
    }, 10000);
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
        <div className="flex gap-3">
          <button
            onClick={handleClearAllFingerprints}
            disabled={isClearingFingerprints}
            className="px-5 py-2.5 bg-orange-600 text-white font-semibold rounded-lg hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200 flex items-center gap-2"
          >
            {isClearingFingerprints ? (
              <>
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Clearing...
              </>
            ) : (
              "Clear All Fingerprints"
            )}
          </button>
          <button
            onClick={handleDeleteAll}
            disabled={isDeletingAll || students.length === 0}
            className="px-5 py-2.5 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200 flex items-center gap-2"
          >
            {isDeletingAll ? (
              <>
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Deleting {deleteAllProgress.current}/{deleteAllProgress.total}
              </>
            ) : (
              "Delete All Students"
            )}
          </button>
          <button
            onClick={() => handleOpenModal()}
            className="px-5 py-2.5 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors duration-200"
          >
            Add Student
          </button>
        </div>
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
        variant={confirmModal.variant}
        confirmText="Delete"
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal({ ...confirmModal, isOpen: false })}
      />
    </div>
  );
}
