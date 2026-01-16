import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@mui/material";

const LogoutButton = () => {
  const navigate = useNavigate();

  const handleLogout = () => {
    // Clear user session data
    localStorage.removeItem("userInfo");
    // Redirect to login page
    navigate("/");
  };

  return (
    <Button
      variant="contained"
      color="secondary"
      onClick={handleLogout}
      style={{ margin: "10px" }}
    >
      Logout
    </Button>
  );
};

export default LogoutButton;
