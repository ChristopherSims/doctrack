const API_BASE_URL = 'http://localhost:5000/api';

// --- Auth token helpers ---
const AUTH_TOKEN_KEY = 'doctrack_auth_token';

export function getAuthToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setAuthToken(token: string | null) {
  if (token) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(AUTH_TOKEN_KEY);
  }
}

function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// --- Auth API ---
export async function login(username: string, password: string): Promise<ApiResponse<{ token: string; user: { id: number; username: string; role: string } }>> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const json = await response.json();
  if (json.success && json.data?.token) {
    setAuthToken(json.data.token);
  }
  return json;
}

export async function getMe(): Promise<ApiResponse<{ id: number; username: string; role: string }>> {
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    headers: authHeaders(),
  });
  return response.json();
}

export async function logout(): Promise<ApiResponse<null>> {
  const response = await fetch(`${API_BASE_URL}/auth/logout`, {
    method: 'POST',
    headers: authHeaders(),
  });
  setAuthToken(null);
  return response.json();
}

export async function getUsers(): Promise<ApiResponse<any[]>> {
  const response = await fetch(`${API_BASE_URL}/users`, {
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
  });
  return response.json();
}

export async function createUser(payload: { username: string; password: string; role?: string }): Promise<ApiResponse<any>> {
  const response = await fetch(`${API_BASE_URL}/users`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return response.json();
}

// Document API
export async function getDocuments(): Promise<ApiResponse<any[]>> {
  const response = await fetch(`${API_BASE_URL}/documents`);
  return response.json();
}

export async function getDocument(id: string): Promise<ApiResponse<any>> {
  const response = await fetch(`${API_BASE_URL}/documents/${id}`);
  return response.json();
}

export async function createDocument(payload: {
  title: string;
  description: string;
  owner: string;
}): Promise<ApiResponse<any>> {
  const response = await fetch(`${API_BASE_URL}/documents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return response.json();
}

export async function updateDocument(
  id: string,
  updates: Partial<any>
): Promise<ApiResponse<any>> {
  const response = await fetch(`${API_BASE_URL}/documents/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  return response.json();
}

export async function deleteDocument(id: string): Promise<ApiResponse<any>> {
  const response = await fetch(`${API_BASE_URL}/documents/${id}`, {
    method: 'DELETE',
  });
  return response.json();
}

// Requirement API
export async function getRequirements(documentId: string): Promise<ApiResponse<any[]>> {
  const response = await fetch(`${API_BASE_URL}/documents/${documentId}/requirements`);
  return response.json();
}

export async function getRequirement(id: string): Promise<ApiResponse<any>> {
  const response = await fetch(`${API_BASE_URL}/requirements/${id}`);
  return response.json();
}

export async function createRequirement(payload: {
  documentId: string;
  title: string;
  description: string;
  priority?: string;
  changeRequestId?: string;
  changeRequestLink?: string;
  testPlan?: string;
  testPlanLink?: string;
  verificationMethod?: string;
  level?: string;
  rationale?: string;
  createdBy?: string;
  [key: string]: any;
}): Promise<ApiResponse<any>> {
  const response = await fetch(`${API_BASE_URL}/requirements`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return response.json();
}

export async function updateRequirement(
  id: string,
  updates: Partial<any>
): Promise<ApiResponse<any>> {
  const response = await fetch(`${API_BASE_URL}/requirements/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  return response.json();
}

export async function deleteRequirement(id: string): Promise<ApiResponse<any>> {
  const response = await fetch(`${API_BASE_URL}/requirements/${id}`, {
    method: 'DELETE',
  });
  return response.json();
}

export async function searchRequirements(
  documentId: string,
  query: string
): Promise<ApiResponse<any[]>> {
  const response = await fetch(
    `${API_BASE_URL}/documents/${documentId}/requirements/search?q=${encodeURIComponent(query)}`
  );
  return response.json();
}

// Requirement Batch & Search API
export async function batchUpdateRequirements(
  updates: Array<{ id: string; [key: string]: any }>
): Promise<ApiResponse<string[]>> {
  const response = await fetch(`${API_BASE_URL}/requirements/batch`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ updates }),
  });
  return response.json();
}

export async function globalSearchRequirements(
  query: string
): Promise<ApiResponse<any[]>> {
  const response = await fetch(
    `${API_BASE_URL}/requirements/search?q=${encodeURIComponent(query)}`
  );
  return response.json();
}

// Document Stats API
export async function getDocumentStats(
  docId: string
): Promise<ApiResponse<any>> {
  const response = await fetch(`${API_BASE_URL}/documents/${docId}/stats`);
  return response.json();
}

// Unique Tags API
export async function getUniqueTags(
  docId: string
): Promise<ApiResponse<string[]>> {
  const response = await fetch(`${API_BASE_URL}/documents/${docId}/unique-tags`);
  return response.json();
}

// Version Control — Commits
export async function createCommit(
  docId: string,
  data: { message: string; author: string }
): Promise<ApiResponse<any>> {
  const response = await fetch(`${API_BASE_URL}/documents/${docId}/commits`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return response.json();
}

export async function getCommits(
  docId: string
): Promise<ApiResponse<any[]>> {
  const response = await fetch(`${API_BASE_URL}/documents/${docId}/commits`);
  return response.json();
}

export async function getCommit(
  commitId: string
): Promise<ApiResponse<any>> {
  const response = await fetch(`${API_BASE_URL}/commits/${commitId}`);
  return response.json();
}

export async function diffCommits(
  commitId1: string,
  commitId2: string
): Promise<ApiResponse<any>> {
  const response = await fetch(
    `${API_BASE_URL}/commits/${commitId1}/${commitId2}/diff`
  );
  return response.json();
}

// Version Control — Branches
export async function createBranch(
  docId: string,
  data: { name: string; description?: string; createdBy: string }
): Promise<ApiResponse<any>> {
  const response = await fetch(`${API_BASE_URL}/documents/${docId}/branches`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return response.json();
}

export async function getBranches(
  docId: string
): Promise<ApiResponse<any[]>> {
  const response = await fetch(`${API_BASE_URL}/documents/${docId}/branches`);
  return response.json();
}

export async function checkoutBranch(
  docId: string,
  branchName: string
): Promise<ApiResponse<any>> {
  const response = await fetch(
    `${API_BASE_URL}/documents/${docId}/branches/${encodeURIComponent(branchName)}/checkout`,
    { method: 'POST' }
  );
  return response.json();
}

export async function mergeBranch(
  docId: string,
  data: { sourceBranch: string; targetBranch: string; author: string }
): Promise<ApiResponse<any>> {
  const response = await fetch(`${API_BASE_URL}/documents/${docId}/merge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return response.json();
}

export async function revertBranch(
  docId: string,
  data: { branchName: string; commitId: string; author: string }
): Promise<ApiResponse<any>> {
  const response = await fetch(`${API_BASE_URL}/documents/${docId}/revert`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return response.json();
}

export async function getCommitGraph(
  docId: string
): Promise<ApiResponse<{ nodes: any[]; branches: any[]; edges: any[] }>> {
  const response = await fetch(`${API_BASE_URL}/documents/${docId}/commit-graph`);
  return response.json();
}

// Version Control — Tags
export async function createTag(
  docId: string,
  data: { name: string; commitId: string; message?: string; createdBy: string }
): Promise<ApiResponse<any>> {
  const response = await fetch(`${API_BASE_URL}/documents/${docId}/tags`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return response.json();
}

export async function getTags(
  docId: string
): Promise<ApiResponse<any[]>> {
  const response = await fetch(`${API_BASE_URL}/documents/${docId}/tags`);
  return response.json();
}

// Export API
export async function exportDocument(
  docId: string,
  format: 'csv' | 'word' | 'pdf',
  options?: Record<string, any>
): Promise<Blob> {
  const response = await fetch(
    `${API_BASE_URL}/documents/${docId}/export/${format}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      ...(options ? { body: JSON.stringify(options) } : {}),
    }
  );
  return response.blob();
}

// Traceability API
export async function createTraceabilityLink(data: {
  sourceRequirementId: string;
  targetRequirementId: string;
  targetDocumentId: string;
  linkType: string;
}): Promise<ApiResponse<any>> {
  const response = await fetch(`${API_BASE_URL}/traceability`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return response.json();
}

export async function getTraceabilityLinks(
  reqId: string
): Promise<ApiResponse<any[]>> {
  const response = await fetch(`${API_BASE_URL}/traceability/${reqId}`);
  return response.json();
}

export async function deleteTraceabilityLink(
  linkId: string
): Promise<ApiResponse<any>> {
  const response = await fetch(`${API_BASE_URL}/traceability/${linkId}`, {
    method: 'DELETE',
  });
  return response.json();
}

// Audit Log API
export async function getAuditLog(
  resourceId?: string
): Promise<ApiResponse<any[]>> {
  const url = resourceId
    ? `${API_BASE_URL}/audit-log?resource_id=${encodeURIComponent(resourceId)}`
    : `${API_BASE_URL}/audit-log`;
  const response = await fetch(url);
  return response.json();
}

// Edit History API
export async function getRequirementHistory(
  reqId: string
): Promise<ApiResponse<any[]>> {
  const response = await fetch(`${API_BASE_URL}/requirements/${encodeURIComponent(reqId)}/history`);
  return response.json();
}

export async function getRequirementHistorySnapshot(
  reqId: string,
  historyId: string
): Promise<ApiResponse<any>> {
  const response = await fetch(
    `${API_BASE_URL}/requirements/${encodeURIComponent(reqId)}/history/${encodeURIComponent(historyId)}/snapshot`
  );
  return response.json();
}

export async function getDocumentHistory(
  docId: string
): Promise<ApiResponse<any[]>> {
  const response = await fetch(`${API_BASE_URL}/documents/${encodeURIComponent(docId)}/history`);
  return response.json();
}

// CSV Import / Template API
export async function downloadCSVTemplate(docId: string): Promise<Blob> {
  const response = await fetch(`${API_BASE_URL}/documents/${docId}/csv-template`);
  return response.blob();
}

export async function importCSVRequirements(
  docId: string,
  requirements: Record<string, any>[],
  createdBy?: string
): Promise<ApiResponse<{ imported: number; errors: Array<{ row: number; title?: string; error: string }> }>> {
  const response = await fetch(`${API_BASE_URL}/documents/${docId}/import-csv`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requirements, createdBy: createdBy || 'system' }),
  });
  return response.json();
}

// Requirement Comments API
export async function getComments(
  reqId: string
): Promise<ApiResponse<any[]>> {
  const response = await fetch(`${API_BASE_URL}/requirements/${encodeURIComponent(reqId)}/comments`);
  return response.json();
}

export async function createComment(
  data: { requirementId: string; content: string; authorType: string }
): Promise<ApiResponse<any>> {
  const response = await fetch(`${API_BASE_URL}/requirements/${encodeURIComponent(data.requirementId)}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: data.content, authorType: data.authorType }),
  });
  return response.json();
}

export async function deleteComment(
  commentId: string
): Promise<ApiResponse<any>> {
  const response = await fetch(`${API_BASE_URL}/comments/${encodeURIComponent(commentId)}`, {
    method: 'DELETE',
  });
  return response.json();
}

// Dashboard API
export async function getDashboard(): Promise<ApiResponse<any>> {
  const response = await fetch(`${API_BASE_URL}/dashboard`);
  return response.json();
}

// Lint API
export async function lintDocument(docId: string): Promise<ApiResponse<any[]>> {
  const response = await fetch(`${API_BASE_URL}/documents/${encodeURIComponent(docId)}/lint`);
  return response.json();
}

// Requirement Reviews API
export async function getReviews(reqId: string): Promise<ApiResponse<any[]>> {
  const response = await fetch(`${API_BASE_URL}/requirements/${encodeURIComponent(reqId)}/reviews`);
  return response.json();
}

export async function createReview(reqId: string, data: { reviewerName: string; comment?: string }): Promise<ApiResponse<any>> {
  const response = await fetch(`${API_BASE_URL}/requirements/${encodeURIComponent(reqId)}/reviews`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return response.json();
}

export async function updateReview(reviewId: string, data: { status: string; comment?: string }): Promise<ApiResponse<any>> {
  const response = await fetch(`${API_BASE_URL}/reviews/${encodeURIComponent(reviewId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return response.json();
}

export async function deleteReview(reviewId: string): Promise<ApiResponse<any>> {
  const response = await fetch(`${API_BASE_URL}/reviews/${encodeURIComponent(reviewId)}`, {
    method: 'DELETE',
  });
  return response.json();
}

// Baselines API
export async function getBaselines(docId: string): Promise<ApiResponse<any[]>> {
  const response = await fetch(`${API_BASE_URL}/documents/${encodeURIComponent(docId)}/baselines`);
  return response.json();
}

export async function createBaseline(docId: string, data: { name: string; commitId: string; description?: string; createdBy?: string }): Promise<ApiResponse<any>> {
  const response = await fetch(`${API_BASE_URL}/documents/${encodeURIComponent(docId)}/baselines`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return response.json();
}

export async function deleteBaseline(baselineId: string): Promise<ApiResponse<any>> {
  const response = await fetch(`${API_BASE_URL}/baselines/${encodeURIComponent(baselineId)}`, {
    method: 'DELETE',
  });
  return response.json();
}

// Cross-doc traceability tree
export async function getCrossDocTraceTree(
  docId: string
): Promise<ApiResponse<any[]>> {
  const response = await fetch(`${API_BASE_URL}/documents/${encodeURIComponent(docId)}/traceability-tree`);
  const json = await response.json();
  // Backend returns { success, data: { nodes: [...] } }, flatten to { success, data: [...] }
  if (json.success && json.data?.nodes) {
    return { success: true, data: json.data.nodes };
  }
  return json;
}

// Change Proposal API
export async function getChangeProposals(docId: string): Promise<ApiResponse<any[]>> {
  const response = await fetch(`${API_BASE_URL}/documents/${encodeURIComponent(docId)}/change-proposals`);
  return response.json();
}

export async function createChangeProposal(docId: string, data: { title: string; description?: string; createdBy?: string }): Promise<ApiResponse<any>> {
  const response = await fetch(`${API_BASE_URL}/documents/${encodeURIComponent(docId)}/change-proposals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return response.json();
}

export async function getChangeProposal(cpId: string): Promise<ApiResponse<any>> {
  const response = await fetch(`${API_BASE_URL}/change-proposals/${encodeURIComponent(cpId)}`);
  return response.json();
}

export async function updateChangeProposal(cpId: string, data: Partial<any>): Promise<ApiResponse<any>> {
  const response = await fetch(`${API_BASE_URL}/change-proposals/${encodeURIComponent(cpId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return response.json();
}

export async function deleteChangeProposal(cpId: string): Promise<ApiResponse<any>> {
  const response = await fetch(`${API_BASE_URL}/change-proposals/${encodeURIComponent(cpId)}`, {
    method: 'DELETE',
  });
  return response.json();
}

export async function getChangeProposalHistory(cpId: string): Promise<ApiResponse<any[]>> {
  const response = await fetch(`${API_BASE_URL}/change-proposals/${encodeURIComponent(cpId)}/history`);
  return response.json();
}

// --- OneDev Integration API ---

export async function getOneDevConfig(): Promise<ApiResponse<{ url: string; project: string; token: string }>> {
  const response = await fetch(`${API_BASE_URL}/integrations/onedev/config`, {
    headers: authHeaders(),
  });
  return response.json();
}

export async function updateOneDevConfig(payload: { url?: string; project?: string; token?: string }): Promise<ApiResponse<null>> {
  const response = await fetch(`${API_BASE_URL}/integrations/onedev/config`, {
    method: 'PUT',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return response.json();
}

export async function deleteOneDevConfig(): Promise<ApiResponse<null>> {
  const response = await fetch(`${API_BASE_URL}/integrations/onedev/config`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  return response.json();
}

export async function testOneDevConnection(): Promise<ApiResponse<any>> {
  const response = await fetch(`${API_BASE_URL}/integrations/onedev/test`, {
    method: 'POST',
    headers: authHeaders(),
  });
  return response.json();
}

export async function getOneDevProjects(q?: string): Promise<ApiResponse<any[]>> {
  const url = new URL(`${API_BASE_URL}/integrations/onedev/projects`);
  if (q) url.searchParams.set('q', q);
  const response = await fetch(url.toString(), { headers: authHeaders() });
  return response.json();
}

export async function getOneDevProject(projectId: number): Promise<ApiResponse<any>> {
  const response = await fetch(`${API_BASE_URL}/integrations/onedev/projects/${projectId}`, {
    headers: authHeaders(),
  });
  return response.json();
}

export async function getOneDevIssues(projectId: number, q?: string, offset = 0, count = 50): Promise<ApiResponse<any[]>> {
  const url = new URL(`${API_BASE_URL}/integrations/onedev/issues`);
  url.searchParams.set('projectId', String(projectId));
  if (q) url.searchParams.set('q', q);
  url.searchParams.set('offset', String(offset));
  url.searchParams.set('count', String(count));
  const response = await fetch(url.toString(), { headers: authHeaders() });
  return response.json();
}

export async function getOneDevIssue(issueId: number): Promise<ApiResponse<any>> {
  const response = await fetch(`${API_BASE_URL}/integrations/onedev/issues/${issueId}`, {
    headers: authHeaders(),
  });
  return response.json();
}

export async function getOneDevBuilds(projectId: number, job?: string, offset = 0, count = 50): Promise<ApiResponse<any[]>> {
  const url = new URL(`${API_BASE_URL}/integrations/onedev/builds`);
  url.searchParams.set('projectId', String(projectId));
  if (job) url.searchParams.set('job', job);
  url.searchParams.set('offset', String(offset));
  url.searchParams.set('count', String(count));
  const response = await fetch(url.toString(), { headers: authHeaders() });
  return response.json();
}

export async function getOneDevBuild(buildId: number): Promise<ApiResponse<any>> {
  const response = await fetch(`${API_BASE_URL}/integrations/onedev/builds/${buildId}`, {
    headers: authHeaders(),
  });
  return response.json();
}

export async function getOneDevCommits(projectId: number, branch?: string, offset = 0, count = 50): Promise<ApiResponse<any[]>> {
  const url = new URL(`${API_BASE_URL}/integrations/onedev/commits`);
  url.searchParams.set('projectId', String(projectId));
  if (branch) url.searchParams.set('branch', branch);
  url.searchParams.set('offset', String(offset));
  url.searchParams.set('count', String(count));
  const response = await fetch(url.toString(), { headers: authHeaders() });
  return response.json();
}

export async function getOneDevPullRequests(projectId: number, q?: string, offset = 0, count = 50): Promise<ApiResponse<any[]>> {
  const url = new URL(`${API_BASE_URL}/integrations/onedev/pull-requests`);
  url.searchParams.set('projectId', String(projectId));
  if (q) url.searchParams.set('q', q);
  url.searchParams.set('offset', String(offset));
  url.searchParams.set('count', String(count));
  const response = await fetch(url.toString(), { headers: authHeaders() });
  return response.json();
}
