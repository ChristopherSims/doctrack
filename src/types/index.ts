export interface Document {
  id: string;
  title: string;
  description: string;
  version: string;
  status: 'draft' | 'review' | 'approved' | 'released';
  owner: string;
  createdAt: string;
  updatedAt: string;
  currentBranch: string;
  parentDocumentId?: string;
}

export interface Requirement {
  id: string; // REQ-XXX-XXX format
  documentId: string;
  title: string;
  description: string;
  status: 'draft' | 'review' | 'approved' | 'implemented' | 'verified';
  priority: 'high' | 'medium' | 'low';
  level?: string; // Hierarchical level like 1.1.1
  sequenceNumber?: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  parentRequirementId?: string;
  changeRequestId?: string;
  changeRequestLink?: string;
  testPlan?: string;
  testPlanLink?: string;
  verificationMethod?: string;
  rationale?: string;
  tags: string[];
  customFields?: Record<string, string>;
  relatedRequirements?: string[];
}

export interface User {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: 'viewer' | 'editor' | 'reviewer' | 'admin';
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface CreateDocumentPayload {
  title: string;
  description: string;
  owner: string;
}

export interface CreateRequirementPayload {
  documentId: string;
  title: string;
  description: string;
  status?: string;
  priority: 'high' | 'medium' | 'low';
  level?: string;
  rationale?: string;
  changeRequestId?: string;
  changeRequestLink?: string;
  testPlan?: string;
  testPlanLink?: string;
  verificationMethod?: string;
  parentRequirementId?: string;
  tags?: string[];
  customFields?: Record<string, string>;
  relatedRequirements?: string[];
  createdBy?: string;
}

export interface UpdateRequirementPayload {
  id: string;
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  level?: string;
  rationale?: string;
  changeRequestId?: string;
  changeRequestLink?: string;
  testPlan?: string;
  testPlanLink?: string;
  verificationMethod?: string;
  parentRequirementId?: string;
  tags?: string[];
  customFields?: Record<string, string>;
  relatedRequirements?: string[];
}

export interface Commit {
  id: string;
  documentId: string;
  branchName: string;
  message: string;
  author: string;
  createdAt: string;
  parentCommitId: string;
  snapshot: any;
}

export interface Branch {
  id: string;
  documentId: string;
  name: string;
  headCommitId: string;
  createdAt: string;
  createdBy: string;
  description: string;
}

export interface Tag {
  id: string;
  documentId: string;
  name: string;
  commitId: string;
  createdAt: string;
  createdBy: string;
  message: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: string;
  actorType: string;
  actorName: string;
  resourceType: string;
  resourceId: string;
  changeDetails: any;
  approvalStatus: string;
  approvedBy: string;
  reason: string;
  aiAgentModel: string;
}

export interface TraceabilityLink {
  id: string;
  sourceRequirementId: string;
  targetRequirementId: string;
  targetDocumentId: string;
  linkType: string;
  createdAt: string;
  // Enriched fields from backend
  sourceReqTitle?: string;
  sourceReqLevel?: string;
  sourceDocumentId?: string;
  sourceDocTitle?: string;
  targetReqTitle?: string;
  targetReqLevel?: string;
  targetDocTitle?: string;
}

export interface DocumentStats {
  total: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
}

export interface BatchUpdateResponse {
  success: boolean;
  data: string[];
  errors: { id: string; error: string }[];
  updated: number;
  failed: number;
}

export interface EditHistoryEntry {
  id: string;
  requirementId: string;
  userId: string;
  userName: string;
  timestamp: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  branchName: string;
}

/** Shared filter state for requirements — persisted per document session */
export interface RequirementFilter {
  title: string;        // substring match
  description: string;  // substring match
  status: string;       // substring match, e.g. 'draft'
  priority: string;     // substring match, e.g. 'high'
  verification: string; // substring match, e.g. 'unit_test'
  tags: string;         // substring match, e.g. 'safety'
}
