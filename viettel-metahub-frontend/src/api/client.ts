import axios from 'axios';

// All requests use relative paths so the Vite dev proxy routes them to the
// Play Framework (port 9002), which handles auth cookies and proxies to GMS.
export const apiClient = axios.create({
    headers: { 'Content-Type': 'application/json' },
    withCredentials: true,
    timeout: 30000,
});

apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            window.location.href = '/login';
        }
        return Promise.reject(error);
    },
);

export const graphqlQuery = async <T>(
    query: string,
    variables?: Record<string, unknown>,
): Promise<T> => {
    const response = await apiClient.post<{
        data: T;
        errors?: Array<{ message: string }>;
    }>('/api/v2/graphql', { query, variables });

    if (response.data.errors?.length) {
        throw new Error(response.data.errors[0].message);
    }
    return response.data.data;
};

export const login = async (username: string, password: string): Promise<void> => {
    await apiClient.post('/logIn', { username, password });
};

export const logout = async (): Promise<void> => {
    await apiClient.get('/logOut');
    window.location.href = '/login';
};
