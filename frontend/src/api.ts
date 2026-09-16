import { Job, JobStatus, CreateJobInput } from './types';

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string) || 'http://localhost:3000';

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorMsg = `Request failed with status ${res.status}`;
    try {
      const data = await res.json();
      if (data.message) {
        errorMsg = Array.isArray(data.message) ? data.message.join(', ') : data.message;
      }
    } catch {
      // keep default error message if body not JSON
    }
    throw new Error(errorMsg);
  }
  return res.json();
}

export const api = {
  getJobs: (status?: string): Promise<Job[]> => {
    const query = status && status !== 'all' ? `?status=${status}` : '';
    return fetch(`${API_BASE}/jobs${query}`).then((res) => handleResponse<Job[]>(res));
  },

  createJob: (input: CreateJobInput): Promise<Job> => {
    return fetch(`${API_BASE}/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }).then((res) => handleResponse<Job>(res));
  },

  updateJobStatus: (id: string, status: JobStatus): Promise<Job> => {
    return fetch(`${API_BASE}/jobs/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    }).then((res) => handleResponse<Job>(res));
  },

  deleteJob: (id: string): Promise<{ success: boolean }> => {
    return fetch(`${API_BASE}/jobs/${id}`, {
      method: 'DELETE',
    }).then((res) => handleResponse<{ success: boolean }>(res));
  },
};
