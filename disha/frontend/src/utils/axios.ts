import axios from "axios";

const axiosInstance = axios.create({
  baseURL: "http://199.199.50.128:8000", // Replace with your backend's base URL
});

// Intercept all requests to add the Authorization header
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token"); // Retrieve the token from localStorage
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default axiosInstance;
