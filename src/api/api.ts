const API_BASE_URL = 'http://localhost:5000/api';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
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
