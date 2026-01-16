// src/Components/PrivateRoute.tsx
import React from "react";
import { Navigate, Outlet } from "react-router-dom";

const PrivateRoute = () => {
  // Check if user is logged in
  const userInfo = localStorage.getItem("userInfo");

  if (!userInfo) {
    // Redirect to login page if not logged in
    return <Navigate to="/" />;
  }

  // If user is authenticated, render the nested routes
  return <Outlet />;
};

export default PrivateRoute;
