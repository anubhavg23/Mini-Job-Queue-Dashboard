import React, { useState, useEffect } from 'react';
import { Job, JobStatus } from './types';
import { api } from './api';
import './App.css';

const ALL_STATUSES: JobStatus[] = ['pending', 'running', 'completed', 'failed'];

export default function App() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(false);

  const [title, setTitle] = useState('');
  const [type, setType] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);

  const fetchJobs = async () => {
    try {
      setError(null);
      const data = await api.getJobs();
      setJobs(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch jobs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      api.getJobs()
        .then((data) => setJobs(data))
        .catch(() => {});
    }, 4000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !type.trim()) {
      setError('Title and Type are required.');
      return;
    }
    setFormSubmitting(true);
    setError(null);
    try {
      const newJob = await api.createJob({ title, type });
      setJobs((prev) => [newJob, ...prev]);
      setTitle('');
      setType('');
    } catch (err: any) {
      setError(err.message || 'Failed to create job');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: JobStatus) => {
    setActionLoadingId(id);
    setError(null);
    try {
      const updated = await api.updateJobStatus(id, newStatus);
      setJobs((prev) => prev.map((j) => (j.id === id ? updated : j)));
    } catch (err: any) {
      setError(err.message || 'Failed to update job status');
      fetchJobs();
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeleteJob = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this job?')) return;
    setActionLoadingId(id);
    setError(null);
    try {
      await api.deleteJob(id);
      setJobs((prev) => prev.filter((j) => j.id !== id));
    } catch (err: any) {
      setError(err.message || 'Failed to delete job');
    } finally {
      setActionLoadingId(null);
    }
  };

  const counts: Record<string, number> = { total: jobs.length, pending: 0, running: 0, completed: 0, failed: 0 };
  for (const j of jobs) {
    if (j.status in counts) counts[j.status]++;
  }

  const filteredJobs = filter === 'all' ? jobs : jobs.filter((j) => j.status === filter);

  return (
    <div className="container">
      <header className="header">
        <h1>Mini Job Queue Dashboard</h1>
        <div className="header-controls">
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto-refresh (4s)
          </label>
          <button className="btn btn-secondary" onClick={fetchJobs} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </header>

      {error && (
        <div className="alert alert-error">
          <span>{error}</span>
          <button className="alert-close" onClick={() => setError(null)}>✕</button>
        </div>
      )}

      <div className="stats-grid">
        <div className="stat-card" onClick={() => setFilter('all')}>
          <div className="stat-label">Total Jobs</div>
          <div className="stat-value">{counts.total}</div>
        </div>
        <div className="stat-card stat-pending" onClick={() => setFilter('pending')}>
          <div className="stat-label">Pending</div>
          <div className="stat-value">{counts.pending}</div>
        </div>
        <div className="stat-card stat-running" onClick={() => setFilter('running')}>
          <div className="stat-label">Running</div>
          <div className="stat-value">{counts.running}</div>
        </div>
        <div className="stat-card stat-completed" onClick={() => setFilter('completed')}>
          <div className="stat-label">Completed</div>
          <div className="stat-value">{counts.completed}</div>
        </div>
        <div className="stat-card stat-failed" onClick={() => setFilter('failed')}>
          <div className="stat-label">Failed</div>
          <div className="stat-value">{counts.failed}</div>
        </div>
      </div>

      <section className="card form-section">
        <h2>Create New Job</h2>
        <form onSubmit={handleCreateJob} className="job-form">
          <div className="form-group">
            <label htmlFor="title">Job Title</label>
            <input
              id="title"
              type="text"
              placeholder="e.g. Process Video Upload"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={formSubmitting}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="type">Job Type</label>
            <input
              id="type"
              type="text"
              placeholder="e.g. video-transcode or email-blast"
              value={type}
              onChange={(e) => setType(e.target.value)}
              disabled={formSubmitting}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={formSubmitting}>
            {formSubmitting ? 'Creating...' : 'Add Job'}
          </button>
        </form>
      </section>

      <section className="card list-section">
        <div className="list-header">
          <h2>Jobs ({filteredJobs.length})</h2>
          <div className="filter-group">
            <label htmlFor="status-filter">Filter:</label>
            <select
              id="status-filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">All Statuses</option>
              {ALL_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {st.charAt(0).toUpperCase() + st.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading && jobs.length === 0 ? (
          <div className="loading-state">Loading jobs...</div>
        ) : filteredJobs.length === 0 ? (
          <div className="empty-state">
            {jobs.length === 0 ? 'No jobs found. Create one above to get started!' : 'No jobs matching current filter.'}
          </div>
        ) : (
          <div className="table-responsive">
            <table className="job-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Created At</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredJobs.map((job) => {
                  const isBusy = actionLoadingId === job.id;
                  return (
                    <tr key={job.id}>
                      <td className="job-title">{job.title}</td>
                      <td><code>{job.type}</code></td>
                      <td>
                        <span className={`badge badge-${job.status}`}>
                          {job.status}
                        </span>
                      </td>
                      <td className="job-date">
                        {new Date(job.createdAt).toLocaleString()}
                      </td>
                      <td className="job-actions">
                        {job.status === 'pending' && (
                          <button
                            className="btn btn-sm btn-running"
                            onClick={() => handleStatusChange(job.id, 'running')}
                            disabled={isBusy}
                          >
                            Start
                          </button>
                        )}
                        {job.status === 'running' && (
                          <>
                            <button
                              className="btn btn-sm btn-completed"
                              onClick={() => handleStatusChange(job.id, 'completed')}
                              disabled={isBusy}
                            >
                              Complete
                            </button>
                            <button
                              className="btn btn-sm btn-failed"
                              onClick={() => handleStatusChange(job.id, 'failed')}
                              disabled={isBusy}
                            >
                              Fail
                            </button>
                          </>
                        )}
                        {(job.status === 'completed' || job.status === 'failed') && (
                          <span className="terminal-text">Terminal</span>
                        )}
                        <button
                          className="btn btn-sm btn-delete"
                          onClick={() => handleDeleteJob(job.id)}
                          disabled={isBusy}
                          title="Delete Job"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
