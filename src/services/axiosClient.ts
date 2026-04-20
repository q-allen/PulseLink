import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { getBaseUrl } from "./api";

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

const baseURL = getBaseUrl();

const axiosClient = axios.create({
  baseURL,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

const refreshClient = axios.create({
  baseURL,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

let isRefreshing = false;
let refreshPromise: Promise<void> | null = null;

async function refreshToken(): Promise<void> {
  if (isRefreshing && refreshPromise) return refreshPromise;
  isRefreshing = true;
  refreshPromise = refreshClient
    .post("/api/auth/refresh", {})
    .then(() => undefined)
    .finally(() => {
      isRefreshing = false;
      refreshPromise = null;
    });
  return refreshPromise;
}

axiosClient.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined;
    const status = error.response?.status;
    const url = original?.url ?? "";
    const isAuth = url.includes("/api/auth/");

    if (status === 401 && original && !original._retry && !isAuth) {
      original._retry = true;
      try {
        await refreshToken();
        return axiosClient(original);
      } catch {
        // fall through to rejection
      }
    }
    return Promise.reject(error);
  }
);

export default axiosClient;
