import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import "./index.css";
import HomePage from "./pages/HomePage.jsx";
import SignupPage from "./pages/signup.tsx";
import LoginPage from "./pages/login.tsx";
import ProfilePage from "./pages/Profile.jsx";
import AllCoursesPage from "./pages/AllCourses.jsx";
import InstructorCoursesPage from "./pages/InstructorCourses.jsx";
import InstructorCourseDetailPage from "./pages/InstructorCourseDetail.jsx";
import ResetPasswordPage from "./pages/ResetPassword";
import CourseLearningPage from "./pages/CourseLearning.jsx";
import Lesson from "./pages/lesson.jsx";


// Router setup
const router = createBrowserRouter([
  { path: "/", element: <HomePage /> },
  { path: "/signup", element: <SignupPage /> },
  { path: "/login", element: <LoginPage /> },
  { path: "/profile", element: <ProfilePage /> },
  { path: "/courses", element: <AllCoursesPage /> },
  { path: "/all-courses", element: <AllCoursesPage /> },
  { path: "/instructor-courses", element: <InstructorCoursesPage /> },
  { path: "/instructor-courses/:courseId", element: <InstructorCourseDetailPage /> },
  { path: "/reset-password", element: <ResetPasswordPage />},
  { path: "/course/:courseId", element: <CourseLearningPage /> },
  { path: "/courses/:courseId/lessons/:lessonId", element: <Lesson /> },
]);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AnimatePresence mode="wait">
      <RouterProvider router={router} />
    </AnimatePresence>
  </React.StrictMode>
);
