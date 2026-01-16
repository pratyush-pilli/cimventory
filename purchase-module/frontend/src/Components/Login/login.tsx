import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Alert,
  AppBar,
  Toolbar,
} from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload"; // Import the icon for the eye
import Visibility from "@mui/icons-material/Visibility"; // Import visibility icon
import VisibilityOff from "@mui/icons-material/VisibilityOff"; // Import visibility off icon
import configuration, { syncUserInfo } from "../../configuration";

// Import clean axios without any defaults
import axios from "axios";

const Login = () => {
  const [credentials, setCredentials] = useState({
    username: "",
    password: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false); // State for password visibility
  const navigate = useNavigate();

  // Handle input change for username and password fields
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setCredentials((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    setError(null); // Clear error when user types
  };

  // Handle form submission for login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      console.log(
        "Making login request to:",
        `${configuration.api_url}api/login/`
      );
      console.log("Request data:", credentials);

      // Create completely clean axios instance just for login
      const cleanAxios = axios.create({
        baseURL: configuration.api_url,
        withCredentials: true,
        timeout: 10000,
        headers: {
          "Content-Type": "application/json",
        },
      });

      const loginResponse = await cleanAxios.post("api/login/", credentials);

      console.log("Login successful:", loginResponse.data);

      // Store user data
      const userData = JSON.stringify(loginResponse.data.user_info);
      localStorage.setItem("userInfo", userData);
      syncUserInfo();

      // Navigate to home
      window.location.href = "/home";
    } catch (error) {
      console.error("Login error:", error);
      console.error("Error response:", error.response?.data);
      console.error("Error status:", error.response?.status);

      if (error.response?.status === 403) {
        setError("Access forbidden. Please check your credentials.");
      } else if (error.response?.status === 405) {
        setError("Method not allowed. Please contact support.");
      } else if (error.response?.status === 400) {
        setError("Invalid request. Please check your input.");
      } else {
        setError(
          `Authentication failed: ${
            error.response?.data?.message || error.message
          }`
        );
      }
    } finally {
      setLoading(false);
    }
  };
  return (
    <Box
      sx={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh", // Full height of the viewport
        backgroundImage: "url('/purchase.jpg')", // Adjust the path as necessary
        backgroundPosition: "center",
        backgroundSize: "cover",
      }}
    >
      <AppBar position="fixed" className="app-bar">
        <Toolbar className="toolbar">
          <Box
            className="logo-container"
            onClick={() => navigate("/home")}
            style={{ cursor: "pointer" }}
          >
            <img src="/logo.png" alt="Logo" height="40" />
          </Box>
        </Toolbar>
      </AppBar>
      <Box
        sx={{
          marginTop: 20,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <Paper
          elevation={3}
          sx={{
            padding: 4,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            width: "100%",
            backgroundColor: "rgba(255, 255, 255, 0.8)", // Semi-transparent background
          }}
        >
          <Typography component="h1" variant="h5" sx={{ mb: 3 }}>
            Sign In
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2, width: "100%" }}>
              {error}
            </Alert>
          )}

          <Box
            component="form"
            onSubmit={handleLogin}
            sx={{ mt: 1, width: "100%" }}
          >
            <TextField
              margin="normal"
              required
              fullWidth
              id="username"
              label="Username"
              name="username"
              autoComplete="username"
              autoFocus
              value={credentials.username}
              onChange={handleInputChange}
              disabled={loading} // Disable input when loading
            />
            <TextField
              margin="normal"
              required
              fullWidth
              name="password"
              label="Password"
              type={showPassword ? "text" : "password"}
              id="password"
              autoComplete="current-password"
              value={credentials.password}
              onChange={handleInputChange}
              disabled={loading}
              InputProps={{
                endAdornment: (
                  <Button
                    onClick={() => setShowPassword((prev) => !prev)}
                    sx={{
                      position: "absolute",
                      right: 0,
                      top: "50%",
                      transform: "translateY(-50%)",
                    }}
                  >
                    {showPassword ? <Visibility /> : <VisibilityOff />}
                  </Button>
                ),
              }}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
              disabled={loading} // Disable button when loading
            >
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </Box>
        </Paper>
      </Box>
    </Box>
  );
};

export default Login;
