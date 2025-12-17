import React, { useState, FormEvent } from "react";
import { Course } from "../types";

interface CourseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (courseData: Omit<Course, "id">) => void;
}

const departments = [
  "Computer Science",
  "Software Engineering",
  "Information Technology",
  "Cyber Security",
  "Electrical Electronics",
];
const levels = ["100", "200", "300", "400", "500"];

export default function CourseModal({
  isOpen,
  onClose,
  onSubmit,
}: CourseModalProps) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [department, setDepartment] = useState(departments[0]);
  const [level, setLevel] = useState(levels[0]);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name || !code || !department || !level) {
      setError("All fields are required.");
      return;
    }
    onSubmit({ name, code, department, level });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
      <div className="bg-gray-800 rounded-lg shadow-xl p-8 w-full max-w-md">
        <h2 className="text-2xl font-bold mb-6">Add Course</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div
              className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative"
              role="alert"
            >
              <span className="block sm:inline">{error}</span>
            </div>
          )}
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-white"
            >
              Course Name
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm  text-black focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>
          <div>
            <label
              htmlFor="code"
              className="block text-sm font-medium text-white"
            >
              Course Code
            </label>
            <input
              type="text"
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-black focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>
          <div>
            <label
              htmlFor="department"
              className="block text-sm font-medium text-white"
            >
              Department
            </label>
            <select
              id="department"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-indigo-500 bg-gray-800 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            >
              {departments.map((dep) => (
                <option key={dep} value={dep}>
                  {dep}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="level"
              className="block text-sm font-medium text-white"
            >
              Level
            </label>
            <select
              id="level"
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-indigo-500 bg-gray-800 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            >
              {levels.map((lvl) => (
                <option key={lvl} value={lvl}>
                  {lvl}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end space-x-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
