const BASE_URL = '/api';

export const getAuthToken = () => localStorage.getItem('gu_auth_token');
export const setAuthToken = (token) => localStorage.setItem('gu_auth_token', token);
export const removeAuthToken = () => localStorage.removeItem('gu_auth_token');

export const request = async (endpoint, options = {}) => {
  const token = getAuthToken();
  const headers = {
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // If payload is not FormData, default to application/json
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  // Handle expired/invalid sessions gracefully (Point 23)
  if (response.status === 401 && token) {
    console.warn('Session expired or unauthorized. Clearing stored token.');
    // Only remove token if not logging in/registering
    if (!endpoint.includes('/auth/login') && !endpoint.includes('/auth/register')) {
      removeAuthToken();
    }
  }

  if (!response.ok) {
    const errorMsg = data.message || data.error?.message || `Request failed with status ${response.status}`;
    const error = new Error(errorMsg);
    error.status = response.status;
    error.code = data.error?.code || 'ERROR';
    error.data = data;
    throw error;
  }

  return data;
};

const buildQueryString = (params = {}) => {
  const cleanParams = Object.fromEntries(
    Object.entries(params).filter(
      ([_, v]) => v !== undefined && v !== null && v !== '' && v !== 'undefined' && v !== 'null'
    )
  );
  const query = new URLSearchParams(cleanParams).toString();
  return query ? `?${query}` : '';
};

// API Services
export const authApi = {
  login: (email, password) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (payload) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
  verifyEmail: (email, token) =>
    request('/auth/verify-email', { method: 'POST', body: JSON.stringify({ email, token }) }),
  resendVerificationEmail: (email) =>
    request('/auth/resend-verification', { method: 'POST', body: JSON.stringify({ email }) }),
  getMe: () => request('/auth/me'),
};

export const communitiesApi = {
  getAll: (params = {}) => {
    return request(`/communities${buildQueryString(params)}`);
  },
  create: (payload) =>
    request('/communities', { method: 'POST', body: JSON.stringify(payload) }),
  getById: (id) => request(`/communities/${id}`),
  updateSettings: (id, payload) =>
    request(`/communities/${id}/settings`, { method: 'PATCH', body: JSON.stringify(payload) }),
  join: (id) => request(`/communities/${id}/join`, { method: 'POST' }),
  leave: (id) => request(`/communities/${id}/leave`, { method: 'POST' }),
  getMembers: (id) => request(`/communities/${id}/members`),
  getAuditLogs: (id) => request(`/communities/${id}/audit-logs`),
  requestToPost: (communityId, payload) =>
    request(`/communities/${communityId}/post-requests`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getPostRequests: (communityId) => request(`/communities/${communityId}/post-requests`),
  reviewPostRequest: (requestId, payload) =>
    request(`/post-requests/${requestId}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  getJoinRequests: (communityId) => request(`/communities/${communityId}/join-requests`),
  reviewJoinRequest: (communityId, userId, payload) =>
    request(`/communities/${communityId}/join-requests/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
};

export const postsApi = {
  getAll: (params = {}) => {
    return request(`/posts${buildQueryString(params)}`);
  },
  getById: (id) => request(`/posts/${id}`),
  create: (payload) => request('/posts', { method: 'POST', body: JSON.stringify(payload) }),
  delete: (id) => request(`/posts/${id}`, { method: 'DELETE' }),
  pin: (id) => request(`/posts/${id}/pin`, { method: 'PUT' }),
  lock: (id) => request(`/posts/${id}/lock`, { method: 'PUT' }),
  review: (id, payload) =>
    request(`/posts/${id}/review`, { method: 'PUT', body: JSON.stringify(payload) }),
  resubmit: (id, payload) =>
    request(`/posts/${id}/resubmit`, { method: 'PUT', body: JSON.stringify(payload) }),
  like: (id) => request(`/posts/${id}/like`, { method: 'POST' }),
  save: (id) => request(`/posts/${id}/save`, { method: 'POST' }),
  helpful: (id) => request(`/posts/${id}/helpful`, { method: 'POST' }),
  report: (id, payload) =>
    request(`/posts/${id}/report`, { method: 'POST', body: JSON.stringify(payload) }),
  getComments: (id) => request(`/posts/${id}/comments`),
  addComment: (id, payload) =>
    request(`/posts/${id}/comments`, { method: 'POST', body: JSON.stringify(payload) }),
  share: (id, payload) =>
    request(`/posts/${id}/share`, { method: 'POST', body: JSON.stringify(payload) }),
};

export const commentsApi = {
  like: (id) => request(`/comments/${id}/like`, { method: 'POST' }),
  acceptAnswer: (id) => request(`/comments/${id}/accept`, { method: 'POST' }),
  update: (id, payload) =>
    request(`/comments/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  delete: (id) => request(`/comments/${id}`, { method: 'DELETE' }),
};

export const pollsApi = {
  vote: (pollId, optionIndex) =>
    request(`/polls/${pollId}/vote`, {
      method: 'POST',
      body: JSON.stringify({ option: optionIndex }),
    }),
};

export const uploadsApi = {
  uploadMultiple: (formData) => request('/uploads', { method: 'POST', body: formData }),
};

export const eventsApi = {
  getAll: () => request('/events'),
  create: (payload) => request('/events', { method: 'POST', body: JSON.stringify(payload) }),
  rsvp: (id) => request(`/events/${id}/rsvp`, { method: 'POST' }),
};

export const notificationsApi = {
  getAll: () => request('/notifications'),
  markRead: (id) => request(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllRead: () => request('/notifications/read-all', { method: 'PATCH' }),
};

export const searchApi = {
  search: (query) => request(`/search?q=${encodeURIComponent(query)}`),
};

export const messagesApi = {
  getConversations: () => request('/messages/conversations'),
  getWithUser: (userId) => request(`/messages/with/${userId}`),
  sendMessage: (payload) =>
    request('/messages', { method: 'POST', body: JSON.stringify(payload) }),
  deleteForMe: (id) => request(`/messages/${id}/me`, { method: 'DELETE' }),
  deleteForEveryone: (id) => request(`/messages/${id}/everyone`, { method: 'DELETE' }),
};

export const usersApi = {
  getAll: (params = {}) => request(`/users${buildQueryString(params)}`),
  getProfile: (id) => request(`/users/${id}`),
  updateProfile: (payload) =>
    request('/users/profile', { method: 'PATCH', body: JSON.stringify(payload) }),
  getSaved: () => request('/users/saved'),
  toggleFollow: (targetType, targetId) =>
    request('/users/follow', {
      method: 'POST',
      body: JSON.stringify({ targetType, targetId }),
    }),
  block: (id) => request(`/users/${id}/block`, { method: 'POST' }),
  unblock: (id) => request(`/users/${id}/block`, { method: 'DELETE' }),
  mute: (id) => request(`/users/${id}/mute`, { method: 'POST' }),
  unmute: (id) => request(`/users/${id}/mute`, { method: 'DELETE' }),
  getRestrictions: () => request('/users/me/restrictions'),
  deleteAccount: () => request('/users/me', { method: 'DELETE' }),
};

export const adminApi = {
  getOverview: () => request('/admin/overview'),
  getUsers: (params = {}) => request(`/admin/users${buildQueryString(params)}`),
  updateUserRole: (id, role) => request(`/admin/users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }),
  updateUserStatus: (id, isActive) => request(`/admin/users/${id}/status`, { method: 'PATCH', body: JSON.stringify({ isActive }) }),
  getReports: (params = {}) => request(`/admin/reports${buildQueryString(params)}`),
  updateReport: (id, status) => request(`/admin/reports/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  getAuditLogs: (params = {}) => request(`/admin/audit-logs${buildQueryString(params)}`),
};
