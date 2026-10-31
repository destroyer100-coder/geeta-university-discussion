import React, { useCallback, useEffect, useState } from 'react';
import { adminApi } from '../services/api';

const panel = { background: 'var(--surface, #fff)', border: '1px solid var(--border, #e5e7eb)', borderRadius: 14, padding: 18 };
const button = { border: '1px solid var(--border, #d1d5db)', borderRadius: 8, padding: '8px 12px', background: 'var(--surface, #fff)', cursor: 'pointer', fontWeight: 600 };
const input = { border: '1px solid var(--border, #d1d5db)', borderRadius: 8, padding: '10px 12px', minWidth: 0, background: 'var(--surface, #fff)', color: 'inherit' };

export const AdminPage = () => {
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [reports, setReports] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditAction, setAuditAction] = useState('');
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [reportStatus, setReportStatus] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [summary, people, reportList, auditList] = await Promise.all([
        adminApi.getOverview(),
        adminApi.getUsers({ search, role, limit: 50 }),
        adminApi.getReports({ status: reportStatus, limit: 50 }),
        adminApi.getAuditLogs({ action: auditAction, limit: 50 }),
      ]);
      setOverview(summary.data);
      setUsers(people.data || []);
      setReports(reportList.data || []);
      setAuditLogs(auditList.data || []);
    } catch (err) {
      setError(err.message || 'Could not load administration data.');
    } finally {
      setLoading(false);
    }
  }, [search, role, reportStatus, auditAction]);

  useEffect(() => { load(); }, [load]);

  const changeRole = async (person, nextRole) => {
    if (!window.confirm(`Change ${person.name}'s platform role to ${nextRole}?`)) return;
    setBusyId(person._id);
    setNotice('');
    try {
      await adminApi.updateUserRole(person._id, nextRole);
      setNotice(`Updated ${person.name} to ${nextRole}.`);
      await load();
    } catch (err) {
      setError(err.message || 'Role update failed.');
    } finally { setBusyId(''); }
  };

  const changeAccountStatus = async (person) => {
    const nextActive = person.isActive === false;
    const action = nextActive ? 'reactivate' : 'deactivate';
    if (!window.confirm('Confirm ' + action + ' for ' + person.name + '? Existing sessions will be revoked.')) return;
    setBusyId(person._id);
    setNotice('');
    setError('');
    try {
      await adminApi.updateUserStatus(person._id, nextActive);
      setNotice('Account status updated for ' + person.name + '.');
      await load();
    } catch (err) {
      setError(err.message || 'Account status update failed.');
    } finally { setBusyId(''); }
  };

  const reviewReport = async (report, nextStatus) => {
    setBusyId(report._id);
    setNotice('');
    try {
      await adminApi.updateReport(report._id, nextStatus);
      setNotice(`Report moved to ${nextStatus}.`);
      await load();
    } catch (err) {
      setError(err.message || 'Report update failed.');
    } finally { setBusyId(''); }
  };

  const metrics = [
    ['Total users', overview?.users ?? '—'],
    ['Students', overview?.students ?? '—'],
    ['Faculty', overview?.faculty ?? '—'],
    ['Pending reports', overview?.pendingReports ?? '—'],
  ];

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', padding: '24px 18px 48px', display: 'grid', gap: 20 }}>
      <header>
        <div style={{ color: 'var(--text-muted, #64748b)', fontSize: 12, fontWeight: 700, letterSpacing: 1.2 }}>PLATFORM CONTROL</div>
        <h1 style={{ margin: '6px 0', fontSize: 28 }}>Administration</h1>
        <p style={{ margin: 0, color: 'var(--text-muted, #64748b)' }}>Manage platform users, faculty access and reported content.</p>
      </header>

      {error && <div role="alert" style={{ ...panel, borderColor: '#dc6b6b', color: '#b42318' }}>{error}</div>}
      {notice && <div role="status" style={{ ...panel, borderColor: '#26976b', color: '#16794f' }}>{notice}</div>}

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        {metrics.map(([label, value]) => <div key={label} style={panel}><div style={{ color: 'var(--text-muted, #64748b)', fontSize: 13 }}>{label}</div><div style={{ fontSize: 28, fontWeight: 750, marginTop: 6 }}>{value}</div></div>)}
      </section>

      <section style={{ ...panel, display: 'grid', gap: 14 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div><h2 style={{ margin: 0, fontSize: 19 }}>User management</h2><p style={{ margin: '4px 0 0', color: 'var(--text-muted, #64748b)', fontSize: 13 }}>Assign Student or Faculty. Platform Admin access is managed out-of-band.</p></div>
          <button style={button} onClick={load} disabled={loading}>Refresh</button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <input aria-label="Search users" placeholder="Search name, email or department" value={search} onChange={e => setSearch(e.target.value)} style={{ ...input, flex: '1 1 240px' }} />
          <select aria-label="Filter user role" value={role} onChange={e => setRole(e.target.value)} style={input}>
            <option value="">All roles</option><option value="student">Students</option><option value="faculty">Faculty</option><option value="admin">Admins</option>
          </select>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 620, textAlign: 'left' }}>
            <thead><tr>{['User', 'Department', 'Platform role', 'Account status', 'Actions'].map(x => <th key={x} style={{ padding: 10, borderBottom: '1px solid var(--border, #e5e7eb)', fontSize: 12, color: 'var(--text-muted, #64748b)' }}>{x}</th>)}</tr></thead>
            <tbody>
              {users.map(person => <tr key={person._id}>
                <td style={{ padding: 10, borderBottom: '1px solid var(--border, #e5e7eb)' }}><strong>{person.name}</strong><div style={{ fontSize: 12, color: 'var(--text-muted, #64748b)' }}>{person.email}</div></td>
                <td style={{ padding: 10, borderBottom: '1px solid var(--border, #e5e7eb)' }}>{person.department || '—'}</td>
                <td style={{ padding: 10, borderBottom: '1px solid var(--border, #e5e7eb)', textTransform: 'capitalize' }}>{person.role}</td>
                <td style={{ padding: 10, borderBottom: '1px solid var(--border, #e5e7eb)' }}>{person.isActive === false ? 'Deactivated' : 'Active'}</td>
                <td style={{ padding: 10, borderBottom: '1px solid var(--border, #e5e7eb)' }}>
                  {person.role === 'admin' ? <span style={{ color: 'var(--text-muted, #64748b)', fontSize: 12 }}>Protected</span> : (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <select aria-label={`Change role for ${person.name}`} value={person.role} disabled={busyId === person._id} onChange={e => changeRole(person, e.target.value)} style={input}>
                        <option value="student">Student</option><option value="faculty">Faculty</option>
                      </select>
                      <button style={button} disabled={busyId === person._id} onClick={() => changeAccountStatus(person)}>{person.isActive === false ? 'Reactivate' : 'Deactivate'}</button>
                    </div>
                  )}
                </td>
              </tr>)}
              {!loading && users.length === 0 && <tr><td colSpan="5" style={{ padding: 18, textAlign: 'center', color: 'var(--text-muted, #64748b)' }}>No matching users.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section style={{ ...panel, display: 'grid', gap: 14 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div><h2 style={{ margin: 0, fontSize: 19 }}>Report moderation</h2><p style={{ margin: '4px 0 0', color: 'var(--text-muted, #64748b)', fontSize: 13 }}>Review platform reports. Community moderator scope remains separate.</p></div>
          <select aria-label="Filter reports" value={reportStatus} onChange={e => setReportStatus(e.target.value)} style={input}>
            <option value="pending">Pending</option><option value="reviewed">Reviewed</option><option value="resolved">Resolved</option><option value="dismissed">Dismissed</option>
          </select>
        </div>
        {reports.map(report => <article key={report._id} style={{ border: '1px solid var(--border, #e5e7eb)', borderRadius: 10, padding: 14, display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}><strong style={{ textTransform: 'capitalize' }}>{report.targetType} · {report.reason}</strong><span style={{ fontSize: 12, color: 'var(--text-muted, #64748b)' }}>{report.status}</span></div>
          <div style={{ fontSize: 13, color: 'var(--text-muted, #64748b)' }}>Reported by {report.reporter?.name || 'Unknown'} · {new Date(report.createdAt).toLocaleString()}</div>
          {report.details && <p style={{ margin: 0 }}>{report.details}</p>}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {report.status !== 'reviewed' && <button style={button} disabled={busyId === report._id} onClick={() => reviewReport(report, 'reviewed')}>Mark reviewed</button>}
            {report.status !== 'resolved' && <button style={button} disabled={busyId === report._id} onClick={() => reviewReport(report, 'resolved')}>Resolve</button>}
            {report.status !== 'dismissed' && <button style={button} disabled={busyId === report._id} onClick={() => reviewReport(report, 'dismissed')}>Dismiss</button>}
          </div>
        </article>)}
        {!loading && reports.length === 0 && <p style={{ color: 'var(--text-muted, #64748b)', textAlign: 'center' }}>No reports in this status.</p>}
      </section>

      <section style={{ ...panel, display: 'grid', gap: 14 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 19 }}>Audit log</h2>
            <p style={{ margin: '4px 0 0', color: 'var(--text-muted, #64748b)', fontSize: 13 }}>Recent administrative and moderation actions. Logs are read-only.</p>
          </div>
          <select aria-label="Filter audit action" value={auditAction} onChange={e => setAuditAction(e.target.value)} style={input}>
            <option value="">All actions</option>
            <option value="change_role">Role changes</option>
            <option value="create_report">Report created</option>
            <option value="review_report">Report reviewed</option>
            <option value="delete_post">Post deleted</option>
            <option value="approve_post">Post approved</option>
            <option value="reject_post">Post rejected</option>
            <option value="ban_member">Member banned</option>
            <option value="unban_member">Member unbanned</option>
          </select>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 620, textAlign: 'left' }}>
            <thead><tr>{['Action', 'Actor', 'Target', 'Date'].map(label => <th key={label} style={{ padding: 10, borderBottom: '1px solid var(--border, #e5e7eb)', fontSize: 12, color: 'var(--text-muted, #64748b)' }}>{label}</th>)}</tr></thead>
            <tbody>
              {auditLogs.map(log => <tr key={log._id}>
                <td style={{ padding: 10, borderBottom: '1px solid var(--border, #e5e7eb)', textTransform: 'capitalize' }}>{String(log.action || '').replaceAll('_', ' ')}</td>
                <td style={{ padding: 10, borderBottom: '1px solid var(--border, #e5e7eb)' }}>{log.actor?.name || 'System'}<div style={{ fontSize: 12, color: 'var(--text-muted, #64748b)' }}>{log.actor?.email || ''}</div></td>
                <td style={{ padding: 10, borderBottom: '1px solid var(--border, #e5e7eb)' }}>{log.targetType} · {log.targetId}</td>
                <td style={{ padding: 10, borderBottom: '1px solid var(--border, #e5e7eb)', whiteSpace: 'nowrap' }}>{log.createdAt ? new Date(log.createdAt).toLocaleString() : '—'}</td>
              </tr>)}
              {!loading && auditLogs.length === 0 && <tr><td colSpan="4" style={{ padding: 18, textAlign: 'center', color: 'var(--text-muted, #64748b)' }}>No audit entries found.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      {loading && <p role="status" style={{ color: 'var(--text-muted, #64748b)' }}>Loading administration data…</p>}
    </div>
  );
};
