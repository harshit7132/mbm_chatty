import axios from "axios";

export const axiosInstance = axios.create({
  // Use environment variable in production, relative URL in development
  baseURL: import.meta.env.VITE_API_URL || "/api",
  withCredentials: true,
});
