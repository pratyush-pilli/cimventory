// src/config.ts

const config = {
  api_url: "http://199.199.50.190:8000/", // Backend running on 199.199.50.128:8000
};

// Create a clean axios instance specifically for API calls
import axios from 'axios';

export const apiClient = axios.create({
  baseURL: config.api_url,
  withCredentials: true,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  }
});

// User info utility functions
export const getUserInfo = () => {
  try {
    const userInfoStr = localStorage.getItem("userInfo");
    if (!userInfoStr) return null;
    return JSON.parse(userInfoStr);
  } catch (e) {
    console.error("Error parsing user info:", e);
    return null;
  }
};

export const syncUserInfo = () => {
  try {
    const userInfo = getUserInfo();
    if (!userInfo) return;

    // Set individual fields for backward compatibility
    localStorage.setItem("displayName", userInfo.name || "");
    localStorage.setItem("username", userInfo.username || "");
    localStorage.setItem("firstName", userInfo.first_name || "");
    localStorage.setItem("lastName", userInfo.last_name || "");
    localStorage.setItem("division", userInfo.division || "");
    localStorage.setItem("approver_name", userInfo.approver_name || "");
    localStorage.setItem("email", userInfo.email || "");
  } catch (e) {
    console.error("Error syncing user info:", e);
  }
};

export default config;
