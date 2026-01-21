import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import HomePage from "./pages/HomePage.jsx";
import AllCourses from "./pages/AllCourses";


const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <BrowserRouter>
     <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/courses" element={<AllCourses />} />
      </Routes>

    </BrowserRouter>
  </React.StrictMode>
);
