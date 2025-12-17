import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../services/firebase";
import { useAuth } from "../context/AuthContext";
import Spinner from "./Spinner";
import StudentManagement from "./StudentManagement";
import CourseManagement from "./CourseManagement";
import SessionManagement from "./SessionManagement";
import AttendanceLog from "./AttendanceLog";
import AttendanceAnalytics from "./AttendanceAnalytics";
import ServerStatus from "./ServerStatus";


const navItems = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: (p: any) => (
      <svg
        {...p}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
        />
      </svg>
    ),
  },
  {
    id: "studentManagement",
    label: "Students",
    icon: (p: any) => (
      <svg
        {...p}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M15 21v-1a6 6 0 00-5.176-5.97M15 21h6m-6-1a6 6 0 00-5.176-5.97M12 12a4 4 0 100-8 4 4 0 000 8z"
        />
      </svg>
    ),
  },
  {
    id: "courseManagement",
    label: "Courses",
    icon: (p: any) => (
      <svg
        {...p}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 6.253v11.494m-9-5.747h18"
        />
      </svg>
    ),
  },
  {
    id: "sessionManagement",
    label: "Sessions",
    icon: (p: any) => (
      <svg
        {...p}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
  },
  {
    id: "attendanceLog",
    label: "Attendance Log",
    icon: (p: any) => (
      <svg
        {...p}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
        />
      </svg>
    ),
  },
  {
    id: "attendanceAnalytics",
    label: "Analytics",
    icon: (p: any) => (
      <svg
        {...p}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z"
        />
      </svg>
    ),
  },
];

export default function Dashboard() {
  const { adminData, loading } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      navigate("/login");
    } catch (error) {
      console.error("Failed to sign out:", error);
    }
  };

  if (loading || !adminData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <Spinner />
      </div>
    );
  }

  const renderContent = () => {
    const components: { [key: string]: React.ReactNode } = {
      studentManagement: <StudentManagement />,
      courseManagement: <CourseManagement />,
      sessionManagement: <SessionManagement />,
      attendanceLog: <AttendanceLog />,
      attendanceAnalytics: <AttendanceAnalytics />,
      dashboard: (
        <div className="bg-white shadow-xl rounded-lg p-8 text-gray-800">
          <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
          
          <ServerStatus />

          <p className="text-lg text-gray-500">
            Welcome back, {adminData.name}.
          </p>
          <div className="mt-8 border-t border-gray-200 pt-8">
            <dl className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2">
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">Full Name</dt>
                <dd className="mt-1 text-lg text-gray-800">{adminData.name}</dd>
              </div>
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">
                  Email address
                </dt>
                <dd className="mt-1 text-lg text-gray-800">
                  {adminData.email}
                </dd>
              </div>
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">Role</dt>
                <dd className="mt-1 text-lg text-gray-800">{adminData.role}</dd>
              </div>
            </dl>
          </div>
        </div>
      ),
    };
    return components[activeTab] || components.dashboard;
  };

  const getTabClass = (tabId: string) =>
    `w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-colors duration-200 ${
      activeTab === tabId
        ? "bg-blue-600 text-white font-semibold"
        : "text-gray-400 hover:bg-gray-700 hover:text-white"
    }`;

  const SidebarContent = () => (
    <>
      <div>
        <div className="flex items-center space-x-3 mb-10 px-2">
          <div className="p-2 bg-blue-600 rounded-lg">
            <svg
              className="w-6 h-6 text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 11c0 3.517-1.009 6.789-2.75 9.566l-2.75-2.75a2.25 2.25 0 01-3.182 0l-2.75 2.75A18.003 18.003 0 0112 11z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 11c0-3.517 1.009-6.789 2.75-9.566l2.75 2.75a2.25 2.25 0 013.182 0l2.75-2.75A18.003 18.003 0 0112 11z"
              />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white">Admin Panel</h1>
        </div>
        <nav className="space-y-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                setIsSidebarOpen(false);
              }}
              className={getTabClass(item.id)}
            >
              {item.icon({ className: "w-6 h-6 flex-shrink-0" })}
              <span className="truncate">{item.label}</span>
            </button>
          ))}
        </nav>
      </div>
      <div className="border-t border-gray-700 pt-4">
        <div className="flex items-center space-x-3 px-2 mb-4">
          <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center text-blue-400 font-bold">
            {adminData.name.charAt(0)}
          </div>
          <div>
            <p className="text-sm font-semibold text-white truncate">
              {adminData.name}
            </p>
            <p className="text-xs text-gray-400 truncate">{adminData.email}</p>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-red-400 hover:bg-red-500 hover:text-white transition-colors duration-200"
        >
          <svg
            className="w-6 h-6"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
            />
          </svg>
          <span>Sign Out</span>
        </button>
      </div>
    </>
  );

  return (
    <div className="relative min-h-screen md:flex">
      {/* Mobile Sidebar & Backdrop */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
          aria-hidden="true"
        ></div>
      )}
      <aside
        className={`fixed inset-y-0 left-0 w-64 bg-gray-800 p-4 flex flex-col justify-between transform ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        } md:relative md:translate-x-0 transition-transform duration-300 ease-in-out z-40`}
      >
        <SidebarContent />
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Mobile Header */}
        <header className="md:hidden flex justify-between items-center bg-white p-4 shadow-md sticky top-0 z-20">
          <h1 className="text-lg font-semibold text-gray-800">
            {navItems.find((item) => item.id === activeTab)?.label ||
              "Dashboard"}
          </h1>
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="text-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500 rounded"
          >
            <span className="sr-only">Open sidebar</span>
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 6h16M4 12h16M4 18h16"
              ></path>
            </svg>
          </button>
        </header>

        <main className="flex-1 p-6 lg:p-10 overflow-y-auto">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}
