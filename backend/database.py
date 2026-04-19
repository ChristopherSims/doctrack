import sqlite3
import json
import os
from datetime import datetime
from uuid import uuid4
import time
import random

DB_PATH = os.path.join(os.path.expanduser('~'), '.doctrack', 'doctrack.db')

def ensure_db_dir():
    """Ensure the database directory exists"""
    db_dir = os.path.dirname(DB_PATH)
    os.makedirs(db_dir, exist_ok=True)

def get_connection():
    """Get SQLite connection"""
    ensure_db_dir()
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def _parse_level_for_sort(level_str):
    """Parse a level string like '1.2.3' into a tuple of ints for proper sorting.
    E.g. '1' -> (1,), '1.1' -> (1,1), '1.1.1' -> (1,1,1), '1.2' -> (1,2), '2' -> (2,)
    This ensures '1' < '1.1' < '1.1.1' < '1.2' < '2' when used as a sort key.
    """
    try:
        return tuple(int(x) for x in str(level_str).split('.'))
    except (ValueError, AttributeError):
        return (0,)

def init_db():
    """Initialize database with schema"""
    conn = get_connection()
    cursor = conn.cursor()
    
    # Create documents table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        version TEXT DEFAULT '1.0',
        status TEXT DEFAULT 'draft',
        owner TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        currentBranch TEXT DEFAULT 'main',
        parent_document_id TEXT
    )
    ''')
    
    # Create requirements table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS requirements (
        id TEXT PRIMARY KEY,
        documentId TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        status TEXT DEFAULT 'draft',
        priority TEXT DEFAULT 'medium',
        level TEXT DEFAULT '1',
        sequenceNumber INTEGER DEFAULT 1,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        createdBy TEXT NOT NULL,
        parentRequirementId TEXT,
        changeRequestId TEXT,
        changeRequestLink TEXT,
        testPlan TEXT,
        testPlanLink TEXT,
        verificationMethod TEXT,
        rationale TEXT,
        tags TEXT DEFAULT '[]',
        custom_fields TEXT DEFAULT '{}',
        related_requirements TEXT DEFAULT '[]',
        FOREIGN KEY (documentId) REFERENCES documents(id)
    )
    ''')
    
    # Create traceability table for linking requirements across documents
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS traceability (
        id TEXT PRIMARY KEY,
        sourceRequirementId TEXT NOT NULL,
        targetRequirementId TEXT NOT NULL,
        targetDocumentId TEXT NOT NULL,
        linkType TEXT DEFAULT 'implements',
        createdAt TEXT NOT NULL,
        FOREIGN KEY (sourceRequirementId) REFERENCES requirements(id),
        FOREIGN KEY (targetDocumentId) REFERENCES documents(id)
    )
    ''')
    
    # Create indexes
    cursor.execute('''
    CREATE INDEX IF NOT EXISTS idx_req_doc ON requirements(documentId)
    ''')
    cursor.execute('''
    CREATE INDEX IF NOT EXISTS idx_req_status ON requirements(status)
    ''')
    cursor.execute('''
    CREATE INDEX IF NOT EXISTS idx_req_parent ON requirements(parentRequirementId)
    ''')
    cursor.execute('''
    CREATE INDEX IF NOT EXISTS idx_req_level ON requirements(level)
    ''')
    cursor.execute('''
    CREATE INDEX IF NOT EXISTS idx_req_priority ON requirements(priority)
    ''')
    cursor.execute('''
    CREATE INDEX IF NOT EXISTS idx_trace_source ON traceability(sourceRequirementId)
    ''')
    cursor.execute('''
    CREATE INDEX IF NOT EXISTS idx_trace_target ON traceability(targetRequirementId)
    ''')
    cursor.execute('''
    CREATE INDEX IF NOT EXISTS idx_doc_parent ON documents(parent_document_id)
    ''')
    
    # --- Migrations for existing databases ---
    # Add columns to existing requirements table if they don't exist
    cursor.execute('PRAGMA table_info(requirements)')
    req_columns = [col[1] for col in cursor.fetchall()]
    
    if 'sequenceNumber' not in req_columns:
        cursor.execute('ALTER TABLE requirements ADD COLUMN sequenceNumber INTEGER DEFAULT 1')
    if 'level' not in req_columns:
        cursor.execute('ALTER TABLE requirements ADD COLUMN level TEXT DEFAULT \'1\'')
    if 'custom_fields' not in req_columns:
        cursor.execute('ALTER TABLE requirements ADD COLUMN custom_fields TEXT DEFAULT \'{}\'')
    if 'related_requirements' not in req_columns:
        cursor.execute('ALTER TABLE requirements ADD COLUMN related_requirements TEXT DEFAULT \'[]\'')
    
    # Add columns to existing documents table if they don't exist
    cursor.execute('PRAGMA table_info(documents)')
    doc_columns = [col[1] for col in cursor.fetchall()]
    
    if 'parent_document_id' not in doc_columns:
        cursor.execute('ALTER TABLE documents ADD COLUMN parent_document_id TEXT')
    
    # --- Version Control Tables ---
    # Create commits table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS commits (
        id TEXT PRIMARY KEY,
        documentId TEXT NOT NULL,
        branchName TEXT NOT NULL,
        message TEXT NOT NULL,
        author TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        parentCommitId TEXT,
        snapshot TEXT NOT NULL,
        FOREIGN KEY (documentId) REFERENCES documents(id)
    )
    ''')
    
    # Create branches table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS branches (
        id TEXT PRIMARY KEY,
        documentId TEXT NOT NULL,
        name TEXT NOT NULL,
        headCommitId TEXT,
        createdAt TEXT NOT NULL,
        createdBy TEXT NOT NULL,
        description TEXT,
        FOREIGN KEY (documentId) REFERENCES documents(id)
    )
    ''')
    
    # Create tags table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS tags (
        id TEXT PRIMARY KEY,
        documentId TEXT NOT NULL,
        name TEXT NOT NULL,
        commitId TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        createdBy TEXT NOT NULL,
        message TEXT,
        FOREIGN KEY (documentId) REFERENCES documents(id),
        FOREIGN KEY (commitId) REFERENCES commits(id)
    )
    ''')
    
    # Create audit_log table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS audit_log (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        action TEXT NOT NULL,
        actorType TEXT DEFAULT 'human',
        actorName TEXT DEFAULT 'system',
        resourceType TEXT NOT NULL,
        resourceId TEXT NOT NULL,
        changeDetails TEXT,
        approvalStatus TEXT DEFAULT 'auto_approved',
        approvedBy TEXT,
        reason TEXT,
        aiAgentModel TEXT
    )
    ''')
    
    # Version control indexes
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_commits_doc_branch ON commits(documentId, branchName)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_branches_doc_name ON branches(documentId, name)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_tags_doc ON tags(documentId)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_log(resourceId)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp)')
    
    # Create default 'main' branch for each document that doesn't have one
    cursor.execute('''
    INSERT OR IGNORE INTO branches (id, documentId, name, headCommitId, createdAt, createdBy, description)
    SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(6))),
           d.id, 'main', NULL, ?, 'system', 'Default main branch'
    FROM documents d
    WHERE NOT EXISTS (
        SELECT 1 FROM branches b WHERE b.documentId = d.id AND b.name = 'main'
    )
    ''', (datetime.utcnow().isoformat(),))
    
    conn.commit()
    conn.close()

# Document Functions
def get_all_documents():
    """Get all documents"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM documents ORDER BY createdAt DESC')
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def get_document_db(doc_id):
    """Get a specific document"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM documents WHERE id = ?', (doc_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def create_document_db(data):
    """Create a new document"""
    doc_id = str(uuid4())
    now = datetime.utcnow().isoformat()
    
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('''
    INSERT INTO documents (id, title, description, version, status, owner, createdAt, updatedAt, currentBranch, parent_document_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        doc_id,
        data.get('title'),
        data.get('description', ''),
        data.get('version', '1.0'),
        data.get('status', 'draft'),
        data.get('owner'),
        now,
        now,
        'main',
        data.get('parent_document_id')
    ))
    conn.commit()
    
    # Create default 'main' branch for the new document
    branch_id = str(uuid4())
    now_branch = datetime.utcnow().isoformat()
    cursor.execute('''
    INSERT INTO branches (id, documentId, name, headCommitId, createdAt, createdBy, description)
    VALUES (?, ?, 'main', NULL, ?, 'system', 'Default main branch')
    ''', (branch_id, doc_id, now_branch))
    conn.commit()
    
    # Fetch and return the created document
    cursor.execute('SELECT * FROM documents WHERE id = ?', (doc_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row)

def update_document_db(doc_id, data):
    """Update a document"""
    conn = get_connection()
    cursor = conn.cursor()
    
    # Check if document exists
    cursor.execute('SELECT * FROM documents WHERE id = ?', (doc_id,))
    if not cursor.fetchone():
        conn.close()
        return None
    
    now = datetime.utcnow().isoformat()
    updates = []
    params = []
    
    for field in ['title', 'description', 'version', 'status', 'owner', 'parent_document_id']:
        if field in data:
            updates.append(f"{field} = ?")
            params.append(data[field])
    
    if updates:
        updates.append("updatedAt = ?")
        params.append(now)
        params.append(doc_id)
        
        query = f"UPDATE documents SET {', '.join(updates)} WHERE id = ?"
        cursor.execute(query, params)
        conn.commit()
    
    # Fetch and return the updated document
    cursor.execute('SELECT * FROM documents WHERE id = ?', (doc_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row)

def delete_document_db(doc_id):
    """Delete a document and its requirements"""
    conn = get_connection()
    cursor = conn.cursor()
    
    # Delete requirements first
    cursor.execute('DELETE FROM requirements WHERE documentId = ?', (doc_id,))
    
    # Delete document
    cursor.execute('DELETE FROM documents WHERE id = ?', (doc_id,))
    conn.commit()
    conn.close()

# Requirement Functions
def generate_requirement_id(level, sequence_number):
    """Generate requirement ID in format level[sequenceNumber] e.g., 1.1.1[50]"""
    return f"{level}[{sequence_number}]"

def get_next_sequence_number(doc_id, level):
    """Get the next sequence number for a given level in a document"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        'SELECT MAX(sequenceNumber) FROM requirements WHERE documentId = ? AND level = ?',
        (doc_id, level)
    )
    result = cursor.fetchone()
    conn.close()
    max_seq = result[0] if result[0] else 0
    return max_seq + 1

def get_all_requirements(doc_id):
    """Get all requirements for a document, ordered by level then sequenceNumber.
    Level is parsed into integer parts so that '1' < '1.1' < '1.1.1' < '1.2' < '2'.
    """
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM requirements WHERE documentId = ?', (doc_id,))
    rows = cursor.fetchall()
    conn.close()
    
    results = [dict(row) for row in rows]
    # Sort by parsed level tuple, then by sequenceNumber
    results.sort(key=lambda r: (_parse_level_for_sort(r.get('level', '1')), r.get('sequenceNumber', 1)))
    return results

def get_all_requirements_flat():
    """Get all requirements across all documents (for global search).
    Ordered by parsed level then sequenceNumber within each document.
    """
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT r.*, d.title as documentTitle 
        FROM requirements r 
        LEFT JOIN documents d ON r.documentId = d.id
    ''')
    rows = cursor.fetchall()
    conn.close()
    
    results = [dict(row) for row in rows]
    # Sort by documentId group, then level, then sequenceNumber
    results.sort(key=lambda r: (r.get('documentId', ''), _parse_level_for_sort(r.get('level', '1')), r.get('sequenceNumber', 1)))
    return results

def get_requirement_db(req_id):
    """Get a specific requirement"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM requirements WHERE id = ?', (req_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def create_requirement_db(data):
    """Create a new requirement"""
    level = data.get('level', '1')
    doc_id = data.get('documentId')
    seq_num = get_next_sequence_number(doc_id, level)
    req_id = generate_requirement_id(level, seq_num)
    now = datetime.utcnow().isoformat()
    
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('''
    INSERT INTO requirements 
    (id, documentId, title, description, status, priority, level, sequenceNumber, createdAt, updatedAt, createdBy, 
     parentRequirementId, changeRequestId, changeRequestLink, testPlan, testPlanLink, 
     verificationMethod, rationale, tags, custom_fields, related_requirements)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        req_id,
        doc_id,
        data.get('title'),
        data.get('description'),
        data.get('status', 'draft'),
        data.get('priority', 'medium'),
        level,
        seq_num,
        now,
        now,
        data.get('createdBy', 'system'),
        data.get('parentRequirementId'),
        data.get('changeRequestId', ''),
        data.get('changeRequestLink', ''),
        data.get('testPlan', ''),
        data.get('testPlanLink', ''),
        data.get('verificationMethod', ''),
        data.get('rationale', ''),
        json.dumps(data.get('tags', [])),
        json.dumps(data.get('custom_fields', {})),
        json.dumps(data.get('related_requirements', []))
    ))
    conn.commit()
    
    # Fetch and return the created requirement
    cursor.execute('SELECT * FROM requirements WHERE id = ?', (req_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row)

def update_requirement_db(req_id, data):
    """Update a requirement"""
    conn = get_connection()
    cursor = conn.cursor()
    
    # Check if requirement exists
    cursor.execute('SELECT * FROM requirements WHERE id = ?', (req_id,))
    if not cursor.fetchone():
        conn.close()
        return None
    
    now = datetime.utcnow().isoformat()
    updates = []
    params = []
    
    fields = ['title', 'description', 'status', 'priority', 'level', 'parentRequirementId',
              'changeRequestId', 'changeRequestLink', 'testPlan', 'testPlanLink',
              'verificationMethod', 'rationale', 'sequenceNumber']
    
    for field in fields:
        if field in data:
            updates.append(f"{field} = ?")
            params.append(data[field])
    
    # JSON fields need special handling
    if 'tags' in data:
        updates.append('tags = ?')
        params.append(json.dumps(data['tags']))
    
    if 'custom_fields' in data:
        updates.append('custom_fields = ?')
        params.append(json.dumps(data['custom_fields']))
    
    if 'related_requirements' in data:
        updates.append('related_requirements = ?')
        params.append(json.dumps(data['related_requirements']))
    
    if updates:
        updates.append("updatedAt = ?")
        params.append(now)
        params.append(req_id)
        
        query = f"UPDATE requirements SET {', '.join(updates)} WHERE id = ?"
        cursor.execute(query, params)
        conn.commit()
    
    # Fetch and return the updated requirement
    cursor.execute('SELECT * FROM requirements WHERE id = ?', (req_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row)

def batch_update_requirements(updates_list):
    """Batch update multiple requirements in a single transaction.
    
    Args:
        updates_list: A list of dicts, each containing 'id' and any fields to update.
                      e.g. [{'id': '1[1]', 'status': 'approved'}, {'id': '1.1[1]', 'priority': 'high'}]
    
    Returns:
        A tuple of (updated_ids, errors) where updated_ids is a list of IDs that were
        successfully updated and errors is a list of {id, error} dicts.
    """
    if not updates_list:
        return ([], [])
    
    conn = get_connection()
    cursor = conn.cursor()
    now = datetime.utcnow().isoformat()
    
    updated_ids = []
    errors = []
    
    plain_fields = ['title', 'description', 'status', 'priority', 'level', 'parentRequirementId',
                    'changeRequestId', 'changeRequestLink', 'testPlan', 'testPlanLink',
                    'verificationMethod', 'rationale', 'sequenceNumber']
    json_fields = ['tags', 'custom_fields', 'related_requirements']
    all_updateable_fields = plain_fields + json_fields
    
    try:
        for item in updates_list:
            req_id = item.get('id')
            if not req_id:
                errors.append({'id': None, 'error': 'Missing requirement id'})
                continue
            
            # Check if requirement exists
            cursor.execute('SELECT * FROM requirements WHERE id = ?', (req_id,))
            if not cursor.fetchone():
                errors.append({'id': req_id, 'error': 'Requirement not found'})
                continue
            
            set_clauses = []
            params = []
            
            for field in all_updateable_fields:
                if field in item:
                    set_clauses.append(f"{field} = ?")
                    if field in json_fields:
                        params.append(json.dumps(item[field]))
                    else:
                        params.append(item[field])
            
            if not set_clauses:
                continue
            
            set_clauses.append("updatedAt = ?")
            params.append(now)
            params.append(req_id)
            
            query = f"UPDATE requirements SET {', '.join(set_clauses)} WHERE id = ?"
            try:
                cursor.execute(query, params)
                updated_ids.append(req_id)
            except Exception as e:
                errors.append({'id': req_id, 'error': str(e)})
        
        conn.commit()
    except Exception as e:
        conn.rollback()
        errors.append({'id': None, 'error': f'Transaction failed: {str(e)}'})
    finally:
        conn.close()
    
    return (updated_ids, errors)

def get_document_stats(doc_id):
    """Get requirement statistics for a document.
    Returns {total, byStatus: {draft: N, ...}, byPriority: {high: N, ...}} or None if document not found.
    """
    conn = get_connection()
    cursor = conn.cursor()
    
    # Check document exists
    cursor.execute('SELECT id FROM documents WHERE id = ?', (doc_id,))
    if not cursor.fetchone():
        conn.close()
        return None
    
    stats = {'total': 0, 'byStatus': {}, 'byPriority': {}}
    
    cursor.execute('SELECT COUNT(*) as total FROM requirements WHERE documentId = ?', (doc_id,))
    row = cursor.fetchone()
    stats['total'] = row[0] if row else 0
    
    cursor.execute('SELECT status, COUNT(*) as count FROM requirements WHERE documentId = ? GROUP BY status', (doc_id,))
    for row in cursor.fetchall():
        stats['byStatus'][row[0] or 'unknown'] = row[1]
    
    cursor.execute('SELECT priority, COUNT(*) as count FROM requirements WHERE documentId = ? GROUP BY priority', (doc_id,))
    for row in cursor.fetchall():
        stats['byPriority'][row[0] or 'unknown'] = row[1]
    
    conn.close()
    return stats

def delete_requirement_db(req_id):
    """Delete a requirement"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM requirements WHERE id = ?', (req_id,))
    conn.commit()
    conn.close()

# Version Control Functions

def create_commit(document_id, branch_name, message, author):
    """Create a commit on a branch for a document.
    
    Snapshots all current requirements for the document, finds the parent commit
    (latest on this branch), inserts the commit, and updates the branch head.
    
    Returns the commit dict.
    """
    commit_id = str(uuid4())
    now = datetime.utcnow().isoformat()
    
    # Get all requirements for the document as snapshot
    requirements = get_all_requirements(document_id)
    snapshot = json.dumps(requirements)
    
    conn = get_connection()
    cursor = conn.cursor()
    
    # Find parent commit (latest commit on this branch)
    cursor.execute(
        'SELECT id FROM commits WHERE documentId = ? AND branchName = ? ORDER BY createdAt DESC LIMIT 1',
        (document_id, branch_name)
    )
    parent_row = cursor.fetchone()
    parent_commit_id = parent_row['id'] if parent_row else None
    
    # Insert commit
    cursor.execute('''
    INSERT INTO commits (id, documentId, branchName, message, author, createdAt, parentCommitId, snapshot)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ''', (commit_id, document_id, branch_name, message, author, now, parent_commit_id, snapshot))
    
    # Update branch head (create branch if it doesn't exist)
    cursor.execute(
        'UPDATE branches SET headCommitId = ? WHERE documentId = ? AND name = ?',
        (commit_id, document_id, branch_name)
    )
    if cursor.rowcount == 0:
        cursor.execute('''
        INSERT INTO branches (id, documentId, name, headCommitId, createdAt, createdBy, description)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (str(uuid4()), document_id, branch_name, commit_id, now, author, f'Branch {branch_name}'))
    
    conn.commit()
    
    # Fetch and return the created commit
    cursor.execute('SELECT * FROM commits WHERE id = ?', (commit_id,))
    row = cursor.fetchone()
    conn.close()
    
    commit_dict = dict(row)
    
    # Add audit log entry
    add_audit_log(
        action='commit',
        actor_type='human',
        actor_name=author,
        resource_type='commit',
        resource_id=commit_id,
        change_details=json.dumps({'documentId': document_id, 'branchName': branch_name, 'message': message})
    )
    
    return commit_dict

def get_commits(document_id, branch_name=None):
    """Get commits for a document, optionally filtered by branch.
    
    Returns list of commit dicts ordered by createdAt DESC.
    """
    conn = get_connection()
    cursor = conn.cursor()
    
    if branch_name:
        cursor.execute(
            'SELECT * FROM commits WHERE documentId = ? AND branchName = ? ORDER BY createdAt DESC',
            (document_id, branch_name)
        )
    else:
        cursor.execute(
            'SELECT * FROM commits WHERE documentId = ? ORDER BY createdAt DESC',
            (document_id,)
        )
    
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def get_commit(commit_id):
    """Get a specific commit by id. Returns dict or None."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM commits WHERE id = ?', (commit_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def create_branch(document_id, name, description, created_by):
    """Create a new branch for a document.
    
    Returns the branch dict, or None if a branch with that name already exists
    for this document.
    """
    conn = get_connection()
    cursor = conn.cursor()
    
    # Check if branch name already exists for this document
    cursor.execute(
        'SELECT id FROM branches WHERE documentId = ? AND name = ?',
        (document_id, name)
    )
    if cursor.fetchone():
        conn.close()
        return None
    
    branch_id = str(uuid4())
    now = datetime.utcnow().isoformat()
    
    cursor.execute('''
    INSERT INTO branches (id, documentId, name, headCommitId, createdAt, createdBy, description)
    VALUES (?, ?, ?, NULL, ?, ?, ?)
    ''', (branch_id, document_id, name, now, created_by, description))
    
    conn.commit()
    
    cursor.execute('SELECT * FROM branches WHERE id = ?', (branch_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row)

def get_branches(document_id):
    """Get all branches for a document. Returns list of branch dicts."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM branches WHERE documentId = ? ORDER BY createdAt ASC', (document_id,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def get_branch(document_id, branch_name):
    """Get a specific branch for a document by name. Returns dict or None."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        'SELECT * FROM branches WHERE documentId = ? AND name = ?',
        (document_id, branch_name)
    )
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def checkout_branch(document_id, branch_name):
    """Checkout a branch, restoring its requirements from the head commit snapshot.
    
    Deletes existing requirements for the document and re-inserts from the
    branch's head commit snapshot. Updates the document's currentBranch field.
    Returns the branch dict.
    """
    conn = get_connection()
    cursor = conn.cursor()
    
    # Get the branch
    cursor.execute(
        'SELECT * FROM branches WHERE documentId = ? AND name = ?',
        (document_id, branch_name)
    )
    branch_row = cursor.fetchone()
    if not branch_row:
        conn.close()
        return None
    
    branch = dict(branch_row)
    head_commit_id = branch.get('headCommitId')
    
    # If branch has a head commit with a snapshot, restore requirements
    if head_commit_id:
        cursor.execute('SELECT * FROM commits WHERE id = ?', (head_commit_id,))
        commit_row = cursor.fetchone()
        if commit_row:
            snapshot = json.loads(commit_row['snapshot'])
            
            # Delete existing requirements for this document
            cursor.execute('DELETE FROM requirements WHERE documentId = ?', (document_id,))
            
            # Re-insert requirements from snapshot
            for req in snapshot:
                columns = [
                    'id', 'documentId', 'title', 'description', 'status', 'priority',
                    'level', 'sequenceNumber', 'createdAt', 'updatedAt', 'createdBy',
                    'parentRequirementId', 'changeRequestId', 'changeRequestLink',
                    'testPlan', 'testPlanLink', 'verificationMethod', 'rationale',
                    'tags', 'custom_fields', 'related_requirements'
                ]
                values = []
                for col in columns:
                    val = req.get(col)
                    # Ensure JSON fields are serialized strings
                    if col in ('tags', 'custom_fields', 'related_requirements') and val is not None:
                        if isinstance(val, (list, dict)):
                            val = json.dumps(val)
                    values.append(val)
                
                placeholders = ', '.join(['?' for _ in columns])
                col_str = ', '.join(columns)
                cursor.execute(
                    f'INSERT INTO requirements ({col_str}) VALUES ({placeholders})',
                    values
                )
    
    # Update document's currentBranch
    cursor.execute(
        'UPDATE documents SET currentBranch = ?, updatedAt = ? WHERE id = ?',
        (branch_name, datetime.utcnow().isoformat(), document_id)
    )
    
    conn.commit()
    conn.close()
    return branch

def merge_branches(document_id, source_branch, target_branch, author):
    """Merge source branch into target branch using source-wins strategy.
    
    Takes the source branch head commit snapshot as the merged result,
    creates a commit on the target branch with a merge message.
    Returns a dict with merge details.
    """
    conn = get_connection()
    cursor = conn.cursor()
    
    # Get both branches
    cursor.execute(
        'SELECT * FROM branches WHERE documentId = ? AND name = ?',
        (document_id, source_branch)
    )
    source_row = cursor.fetchone()
    if not source_row:
        conn.close()
        return None
    
    cursor.execute(
        'SELECT * FROM branches WHERE documentId = ? AND name = ?',
        (document_id, target_branch)
    )
    target_row = cursor.fetchone()
    if not target_row:
        conn.close()
        return None
    
    source = dict(source_row)
    target = dict(target_row)
    
    # Get source head commit snapshot
    source_head_id = source.get('headCommitId')
    if not source_head_id:
        conn.close()
        return None
    
    cursor.execute('SELECT * FROM commits WHERE id = ?', (source_head_id,))
    source_commit = cursor.fetchone()
    if not source_commit:
        conn.close()
        return None
    
    snapshot = source_commit['snapshot']
    
    # Create merge commit on target branch
    merge_commit_id = str(uuid4())
    now = datetime.utcnow().isoformat()
    merge_message = f"Merge branch '{source_branch}' into '{target_branch}'"
    
    # Find parent commit on target branch
    target_head_id = target.get('headCommitId')
    parent_commit_id = target_head_id if target_head_id else None
    
    cursor.execute('''
    INSERT INTO commits (id, documentId, branchName, message, author, createdAt, parentCommitId, snapshot)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ''', (merge_commit_id, document_id, target_branch, merge_message, author, now, parent_commit_id, snapshot))
    
    # Update target branch head
    cursor.execute(
        'UPDATE branches SET headCommitId = ? WHERE documentId = ? AND name = ?',
        (merge_commit_id, document_id, target_branch)
    )
    
    # Restore requirements from the merged snapshot
    parsed_snapshot = json.loads(snapshot)
    cursor.execute('DELETE FROM requirements WHERE documentId = ?', (document_id,))
    for req in parsed_snapshot:
        columns = [
            'id', 'documentId', 'title', 'description', 'status', 'priority',
            'level', 'sequenceNumber', 'createdAt', 'updatedAt', 'createdBy',
            'parentRequirementId', 'changeRequestId', 'changeRequestLink',
            'testPlan', 'testPlanLink', 'verificationMethod', 'rationale',
            'tags', 'custom_fields', 'related_requirements'
        ]
        values = []
        for col in columns:
            val = req.get(col)
            if col in ('tags', 'custom_fields', 'related_requirements') and val is not None:
                if isinstance(val, (list, dict)):
                    val = json.dumps(val)
            values.append(val)
        
        placeholders = ', '.join(['?' for _ in columns])
        col_str = ', '.join(columns)
        cursor.execute(
            f'INSERT INTO requirements ({col_str}) VALUES ({placeholders})',
            values
        )
    
    conn.commit()
    conn.close()
    
    # Add audit log entry
    add_audit_log(
        action='merge',
        actor_type='human',
        actor_name=author,
        resource_type='commit',
        resource_id=merge_commit_id,
        change_details=json.dumps({
            'documentId': document_id,
            'sourceBranch': source_branch,
            'targetBranch': target_branch
        })
    )
    
    return {
        'mergeCommitId': merge_commit_id,
        'documentId': document_id,
        'sourceBranch': source_branch,
        'targetBranch': target_branch,
        'message': merge_message,
        'author': author,
        'createdAt': now
    }

def create_tag(document_id, name, commit_id, message, created_by):
    """Create a tag for a document at a specific commit.
    
    Returns the tag dict, or None if a tag with that name already exists
    for this document.
    """
    conn = get_connection()
    cursor = conn.cursor()
    
    # Check if tag name already exists for this document
    cursor.execute(
        'SELECT id FROM tags WHERE documentId = ? AND name = ?',
        (document_id, name)
    )
    if cursor.fetchone():
        conn.close()
        return None
    
    tag_id = str(uuid4())
    now = datetime.utcnow().isoformat()
    
    cursor.execute('''
    INSERT INTO tags (id, documentId, name, commitId, createdAt, createdBy, message)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', (tag_id, document_id, name, commit_id, now, created_by, message))
    
    conn.commit()
    
    cursor.execute('SELECT * FROM tags WHERE id = ?', (tag_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row)

def get_tags(document_id):
    """Get all tags for a document. Returns list of tag dicts."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM tags WHERE documentId = ? ORDER BY createdAt DESC', (document_id,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def add_audit_log(action, actor_type, actor_name, resource_type, resource_id, change_details=None):
    """Add an entry to the audit log.
    
    Returns the audit log entry dict.
    """
    log_id = str(uuid4())
    now = datetime.utcnow().isoformat()
    
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
    INSERT INTO audit_log (id, timestamp, action, actorType, actorName, resourceType, resourceId, changeDetails)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ''', (log_id, now, action, actor_type, actor_name, resource_type, resource_id, change_details))
    
    conn.commit()
    
    cursor.execute('SELECT * FROM audit_log WHERE id = ?', (log_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row)

def get_audit_log(resource_id=None, limit=100):
    """Get audit log entries, optionally filtered by resource_id.
    
    Returns list of audit log dicts ordered by timestamp DESC, limited to `limit` results.
    """
    conn = get_connection()
    cursor = conn.cursor()
    
    if resource_id:
        cursor.execute(
            'SELECT * FROM audit_log WHERE resourceId = ? ORDER BY timestamp DESC LIMIT ?',
            (resource_id, limit)
        )
    else:
        cursor.execute(
            'SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT ?',
            (limit,)
        )
    
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

# --- Traceability Functions ---

def create_traceability_link(source_req_id, target_req_id, target_doc_id, link_type):
    """Create a traceability link between two requirements"""
    conn = get_connection()
    cursor = conn.cursor()

    link_id = str(uuid4())
    now = datetime.utcnow().isoformat()

    cursor.execute('''
    INSERT INTO traceability (id, sourceRequirementId, targetRequirementId, targetDocumentId, linkType, createdAt)
    VALUES (?, ?, ?, ?, ?, ?)
    ''', (link_id, source_req_id, target_req_id, target_doc_id, link_type, now))
    conn.commit()

    cursor.execute('SELECT * FROM traceability WHERE id = ?', (link_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row)

def get_traceability_links(req_id):
    """Get all traceability links where the requirement is source or target"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        'SELECT * FROM traceability WHERE sourceRequirementId = ? OR targetRequirementId = ?',
        (req_id, req_id)
    )
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def delete_traceability_link(link_id):
    """Delete a traceability link"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM traceability WHERE id = ?', (link_id,))
    deleted = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return deleted
