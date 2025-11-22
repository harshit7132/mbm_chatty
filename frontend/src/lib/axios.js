import axios from "axios";

export const axiosInstance = axios.create({
  // Use relative URL - Vite proxy will forward to backend in development
  // In production, this will be handled by the web server
  baseURL: "/api",
  withCredentials: true,
});
