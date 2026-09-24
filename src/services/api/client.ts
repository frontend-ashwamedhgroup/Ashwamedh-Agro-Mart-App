import axios, { InternalAxiosRequestConfig } from "axios";
import { authStorage } from "../storage/authStorage";

const API_URL = 'https://api.aubizo.com';

if (__DEV__) {
    console.log("🌐 API URL:", API_URL);
}

const apiClient = axios.create({
    baseURL: API_URL,
    headers: {
        "Content-Type": "application/json",
    },
});

// ✅ Request interceptor (JSON token aware)
apiClient.interceptors.request.use(
    async (config: InternalAxiosRequestConfig) => {
        const tokenData = await authStorage.getToken();

        if (tokenData?.access) {
            config.headers = config.headers ?? {};
            config.headers.Authorization = `Bearer ${tokenData.access}`;
        }

        return config;
    },
    (error) => Promise.reject(error)
);

export default apiClient;
