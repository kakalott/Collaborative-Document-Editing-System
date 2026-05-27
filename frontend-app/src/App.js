import React from "react";
import Editor from "./components/Editor";
import { Route, Routes } from "react-router-dom";
import Login from "./components/Login";
import Register from "./components/Register";
import ViewDocument from "./components/ViewDocument";
import { ToastContainer } from "react-toastify";

function App() {
  return (
    <div className="min-h-screen gradient-text bg-gradient-to-r from-blue-400 to-blue-100">
      <ToastContainer 
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={true}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        style={{ zIndex: 9999 }}
        theme="light"
      />
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/view-documents" element={<ViewDocument />} />
        {/* Hỗ trợ cả 2 dạng: /editor (tạo mới) và /editor/:documentId (share link) */}
        <Route path="/editor" element={<Editor />} />
        <Route path="/editor/:documentId" element={<Editor />} />
      </Routes>
    </div>
  );
}

export default App;