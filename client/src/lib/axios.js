import axios from "axios";
import { sessionGeneration } from "./session";
let unauthorizedHandler;
export const setUnauthorizedHandler = (handler) => {
  unauthorizedHandler = handler;
};
export const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  withCredentials: true,
  timeout: 20000,
});
axiosInstance.interceptors.request.use((config) => {
  config.sessionGeneration = sessionGeneration();
  return config;
});
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error.response?.status === 401 &&
      error.config?.sessionGeneration === sessionGeneration() &&
      !/\/auth\/(login|signup|me)/.test(error.config?.url || "")
    )
      unauthorizedHandler?.();
    return Promise.reject(error);
  },
);
