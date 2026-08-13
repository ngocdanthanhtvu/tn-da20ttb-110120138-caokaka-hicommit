import axios from "axios";

const axiosInstance = axios.create({
    withCredentials: true,
    baseURL: "/api"
});

export { axiosInstance }