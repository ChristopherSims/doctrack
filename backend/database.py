import sqlite3
import json
import os
from datetime import datetime
from uuid import uuid4
import time
import random

DB_PATH = os.environ.get('DOCTRACK_DB_PATH', os.path.join(os.path.expanduser('~'), '.doctrack', 'doctrack.db'))

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
    
    # Create index on parent_document_id (after migration ensures column exists)
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_doc_parent ON documents(parent_document_id)')
    
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
    
    # Create edit_history table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS edit_history (
        id TEXT PRIMARY KEY,
        requirementId TEXT NOT NULL,
        userId TEXT NOT NULL,
        userName TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        field TEXT NOT NULL,
        oldValue TEXT,
        newValue TEXT,
        branchName TEXT,
        FOREIGN KEY (requirementId) REFERENCES requirements(id)
    )
    ''')
    
    # Version control indexes
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_commits_doc_branch ON commits(documentId, branchName)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_branches_doc_name ON branches(documentId, name)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_tags_doc ON tags(documentId)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_log(resourceId)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_edit_history_req ON edit_history(requirementId)')
    
    # Create comments table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS comments (
        id TEXT PRIMARY KEY,
        requirementId TEXT NOT NULL,
        author TEXT NOT NULL,
        text TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (requirementId) REFERENCES requirements(id)
    )
    ''')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_comments_req ON comments(requirementId)')
    
    # Migration: add lastEditedBy column to requirements table if not exists
    cursor.execute('PRAGMA table_info(requirements)')
    req_columns2 = [col[1] for col in cursor.fetchall()]
    if 'lastEditedBy' not in req_columns2:
        cursor.execute('ALTER TABLE requirements ADD COLUMN lastEditedBy TEXT')
    
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
    
    # Migrate old requirement IDs from DOC-{hex}-{level}[{seq}] to {PREFIX}-{level}[{seq}]
    # Build doc_id -> prefix map from document titles
    cursor.execute('SELECT id, title FROM documents')
    doc_rows = cursor.fetchall()
    doc_prefix_map = {}
    for dr in doc_rows:
        first_word = (dr[1] or '').strip().split()[0] if (dr[1] or '').strip() else ''
        prefix = ''.join(c for c in first_word if c.isalnum()).upper() if first_word else dr[0][:8]
        doc_prefix_map[dr[0]] = prefix
    
    cursor.execute('SELECT id, documentId, level, sequenceNumber FROM requirements')
    req_rows = cursor.fetchall()
    id_renames = []  # list of (old_id, new_id)
    for req in req_rows:
        old_id = req[0]
        if old_id.startswith('DOC-'):
            doc_id = req[1]
            level = req[2]
            seq = req[3]
            prefix = doc_prefix_map.get(doc_id, doc_id[:8] if doc_id else 'UNK')
            new_id = f"{prefix}-{level}[{seq}]"
            if new_id != old_id:
                id_renames.append((old_id, new_id))
    
    if id_renames:
        # Rename in requirements table and all referencing columns
        for old_id, new_id in id_renames:
            cursor.execute('UPDATE requirements SET id = ?, parentRequirementId = CASE WHEN parentRequirementId = ? THEN ? ELSE parentRequirementId END WHERE id = ?', (new_id, old_id, new_id, old_id))
            cursor.execute('UPDATE requirements SET parentRequirementId = ? WHERE parentRequirementId = ?', (new_id, old_id))
            cursor.execute('UPDATE edit_history SET requirementId = ? WHERE requirementId = ?', (new_id, old_id))
            # related_requirements is JSON — update substrings
            cursor.execute("SELECT rowid, related_requirements FROM requirements WHERE related_requirements LIKE ?", (f'%{old_id}%',))
            for rr in cursor.fetchall():
                import json
                try:
                    related = json.loads(rr[1]) if rr[1] else []
                    updated = [new_id if r == old_id else r for r in related]
                    cursor.execute('UPDATE requirements SET related_requirements = ? WHERE rowid = ?', (json.dumps(updated), rr[0]))
                except Exception:
                    pass
            # traceability_links (if table exists)
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='traceability_links'")
            if cursor.fetchone():
                cursor.execute('UPDATE traceability_links SET sourceRequirementId = ? WHERE sourceRequirementId = ?', (new_id, old_id))
                cursor.execute('UPDATE traceability_links SET targetRequirementId = ? WHERE targetRequirementId = ?', (new_id, old_id))
    
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
def generate_requirement_id(doc_id, level, sequence_number):
    """Generate requirement ID scoped per-document.
    Format: {DOC_PREFIX}-{level}[{seq}] e.g., SRS-1.1[1]
    The prefix is derived from the document title (first word, uppercase).
    Falls back to first 8 chars of doc_id if title is unavailable.
    """
    prefix = None
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT title FROM documents WHERE id = ?', (doc_id,))
        row = cursor.fetchone()
        conn.close()
        if row and row[0]:
            # Take first word, strip non-alphanumerics, uppercase
            first_word = row[0].strip().split()[0] if row[0].strip() else ''
            prefix = ''.join(c for c in first_word if c.isalnum()).upper()
    except Exception:
        pass
    if not prefix:
        prefix = doc_id[:8] if doc_id else 'UNK'
    return f"{prefix}-{level}[{sequence_number}]"

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
    req_id = generate_requirement_id(doc_id, level, seq_num)
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
    
    # Check if requirement exists and fetch old values
    cursor.execute('SELECT * FROM requirements WHERE id = ?', (req_id,))
    old_row = cursor.fetchone()
    if not old_row:
        conn.close()
        return None
    
    old_req = dict(old_row)
    
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
    
    # lastEditedBy
    user_id = data.get('userId', data.get('lastEditedBy', 'system'))
    user_name = data.get('userName', data.get('lastEditedBy', 'system'))
    if 'lastEditedBy' in data:
        updates.append('lastEditedBy = ?')
        params.append(data['lastEditedBy'])
    
    if updates:
        updates.append("updatedAt = ?")
        params.append(now)
        params.append(req_id)
        
        query = f"UPDATE requirements SET {', '.join(updates)} WHERE id = ?"
        cursor.execute(query, params)
        conn.commit()
        
        # Record edit history for changed fields
        # Get the document's currentBranch for branchName
        cursor.execute('SELECT currentBranch FROM documents WHERE id = ?', (old_req['documentId'],))
        doc_row = cursor.fetchone()
        branch_name = doc_row['currentBranch'] if doc_row else 'main'
        
        # Compare and record changes
        all_fields_to_check = fields + ['tags', 'custom_fields', 'related_requirements']
        for field in all_fields_to_check:
            if field in data:
                if field in ('tags', 'custom_fields', 'related_requirements'):
                    old_val = old_req.get(field)
                    new_val = json.dumps(data[field])
                    # Normalize old_val for comparison
                    if old_val is not None:
                        try:
                            old_val = json.dumps(json.loads(old_val))
                        except (json.JSONDecodeError, TypeError):
                            pass
                else:
                    old_val = old_req.get(field)
                    new_val = data[field]
                
                if str(old_val) != str(new_val):
                    add_edit_history(req_id, user_id, user_name, field, old_val, new_val, branch_name)
    
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
    
    # Collect edit history entries to insert after the main transaction
    edit_history_entries = []
    
    try:
        for item in updates_list:
            req_id = item.get('id')
            if not req_id:
                errors.append({'id': None, 'error': 'Missing requirement id'})
                continue
            
            # Check if requirement exists and fetch old values
            cursor.execute('SELECT * FROM requirements WHERE id = ?', (req_id,))
            old_row = cursor.fetchone()
            if not old_row:
                errors.append({'id': req_id, 'error': 'Requirement not found'})
                continue
            
            old_req = dict(old_row)
            
            set_clauses = []
            params = []
            
            for field in all_updateable_fields:
                if field in item:
                    set_clauses.append(f"{field} = ?")
                    if field in json_fields:
                        params.append(json.dumps(item[field]))
                    else:
                        params.append(item[field])
            
            # lastEditedBy
            user_id = item.get('userId', item.get('lastEditedBy', 'system'))
            user_name = item.get('userName', item.get('lastEditedBy', 'system'))
            if 'lastEditedBy' in item:
                set_clauses.append('lastEditedBy = ?')
                params.append(item['lastEditedBy'])
            
            if not set_clauses:
                continue
            
            set_clauses.append("updatedAt = ?")
            params.append(now)
            params.append(req_id)
            
            query = f"UPDATE requirements SET {', '.join(set_clauses)} WHERE id = ?"
            try:
                cursor.execute(query, params)
                updated_ids.append(req_id)
                
                # Get the document's currentBranch for branchName
                cursor.execute('SELECT currentBranch FROM documents WHERE id = ?', (old_req['documentId'],))
                doc_row = cursor.fetchone()
                branch_name = doc_row['currentBranch'] if doc_row else 'main'
                
                # Collect field changes for edit history
                for field in all_updateable_fields:
                    if field in item:
                        if field in json_fields:
                            old_val = old_req.get(field)
                            new_val = json.dumps(item[field])
                            # Normalize old_val for comparison
                            if old_val is not None:
                                try:
                                    old_val = json.dumps(json.loads(old_val))
                                except (json.JSONDecodeError, TypeError):
                                    pass
                        else:
                            old_val = old_req.get(field)
                            new_val = item[field]
                        
                        if str(old_val) != str(new_val):
                            edit_history_entries.append({
                                'requirement_id': req_id,
                                'user_id': user_id,
                                'user_name': user_name,
                                'field': field,
                                'old_value': old_val,
                                'new_value': new_val,
                                'branch_name': branch_name
                            })
            except Exception as e:
                errors.append({'id': req_id, 'error': str(e)})
        
        conn.commit()
        
        # Insert edit history entries (after main transaction succeeds)
        if edit_history_entries:
            for entry in edit_history_entries:
                add_edit_history(
                    entry['requirement_id'],
                    entry['user_id'],
                    entry['user_name'],
                    entry['field'],
                    entry['old_value'],
                    entry['new_value'],
                    entry['branch_name']
                )
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

def get_unique_tags(doc_id):
    """Get all distinct tags used across requirements in a document.
    Tags are stored as JSON arrays in the 'tags' column.
    Returns a sorted list of unique tag strings.
    """
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT tags FROM requirements WHERE documentId = ?', (doc_id,))
    rows = cursor.fetchall()
    conn.close()
    
    all_tags = set()
    for row in rows:
        try:
            tags = json.loads(row[0]) if row[0] else []
            if isinstance(tags, list):
                for t in tags:
                    if isinstance(t, str) and t.strip():
                        all_tags.add(t.strip())
        except (json.JSONDecodeError, TypeError):
            pass
    return sorted(all_tags)

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

def revert_branch(document_id, branch_name, commit_id, author):
    """Revert a branch to a specific commit by restoring that commit's snapshot.
    
    Creates a new revert commit on the branch with the snapshot from the target commit.
    Returns the revert commit dict, or None if the commit or branch doesn't exist.
    """
    conn = get_connection()
    cursor = conn.cursor()
    
    # Verify the commit exists and belongs to this document
    cursor.execute('SELECT * FROM commits WHERE id = ? AND documentId = ?', (commit_id, document_id))
    commit_row = cursor.fetchone()
    if not commit_row:
        conn.close()
        return None
    
    # Verify the branch exists
    cursor.execute('SELECT * FROM branches WHERE documentId = ? AND name = ?', (document_id, branch_name))
    branch_row = cursor.fetchone()
    if not branch_row:
        conn.close()
        return None
    
    snapshot = commit_row['snapshot']
    
    # Create revert commit
    revert_commit_id = str(uuid4())
    now = datetime.utcnow().isoformat()
    revert_message = f"Revert branch '{branch_name}' to commit {commit_id[:8]}"
    
    # Find current head commit on this branch for parent
    branch = dict(branch_row)
    parent_commit_id = branch.get('headCommitId')
    
    cursor.execute('''
    INSERT INTO commits (id, documentId, branchName, message, author, createdAt, parentCommitId, snapshot)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ''', (revert_commit_id, document_id, branch_name, revert_message, author, now, parent_commit_id, snapshot))
    
    # Update branch head
    cursor.execute(
        'UPDATE branches SET headCommitId = ? WHERE documentId = ? AND name = ?',
        (revert_commit_id, document_id, branch_name)
    )
    
    # Restore requirements from the reverted snapshot
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
    
    add_audit_log(
        action='revert',
        actor_type='human',
        actor_name=author,
        resource_type='commit',
        resource_id=revert_commit_id,
        change_details=json.dumps({
            'documentId': document_id,
            'branchName': branch_name,
            'revertedToCommit': commit_id
        })
    )
    
    return {
        'revertCommitId': revert_commit_id,
        'documentId': document_id,
        'branchName': branch_name,
        'revertedToCommit': commit_id,
        'message': revert_message,
        'author': author,
        'createdAt': now
    }

def get_commit_graph(document_id):
    """Get all commits and branches for a document formatted as a flow diagram graph.
    
    Returns dict with:
      - nodes: list of commit dicts (id, branchName, message, author, createdAt, parentCommitId, isMerge, mergeSourceBranch)
      - branches: list of branch dicts with headCommitId
      - edges: list of {from, to, type} for parent->child and merge relationships
    """
    conn = get_connection()
    cursor = conn.cursor()
    
    # Get all commits (include snapshot just to check, but don't return it)
    cursor.execute(
        'SELECT id, documentId, branchName, message, author, createdAt, parentCommitId, snapshot FROM commits WHERE documentId = ? ORDER BY createdAt ASC',
        (document_id,)
    )
    commit_rows = cursor.fetchall()
    
    # Get all branches
    cursor.execute('SELECT id, documentId, name, headCommitId, createdAt, createdBy, description FROM branches WHERE documentId = ? ORDER BY createdAt ASC', (document_id,))
    branch_rows = cursor.fetchall()
    
    conn.close()
    
    # Build lookup: commit_id -> commit row
    commit_map = {row['id']: dict(row) for row in commit_rows}
    
    # Build lookup: branch_name -> branch info
    branch_map = {}
    for b in branch_rows:
        branch_map[b['name']] = dict(b)
    
    # Detect merges: a commit with message "Merge branch 'X' into 'Y'"
    # gives us the source branch. We also add a second parent edge from
    # the source branch's head at the time of merge.
    import re
    merge_pattern = re.compile(r"Merge branch '(.+?)' into '(.+?)'")
    
    nodes = []
    edges = []
    
    for row in commit_rows:
        c = dict(row)
        is_merge = False
        merge_source_branch = None
        
        # Detect merge by message pattern
        m = merge_pattern.match(c.get('message', ''))
        if m:
            is_merge = True
            merge_source_branch = m.group(1)
        
        # Also detect revert commits
        is_revert = c.get('message', '').startswith('Revert')
        
        # Add parent edge (always present for non-initial commits)
        if c.get('parentCommitId'):
            edges.append({'from': c['parentCommitId'], 'to': c['id'], 'type': 'parent'})
        
        # For merge commits, add a cross-branch edge from the source branch head
        if is_merge and merge_source_branch:
            # Find the most recent commit on the source branch that was made
            # before this merge commit
            merge_time = c['createdAt']
            source_branch_commits = [
                cr for cr in commit_rows
                if cr['branchName'] == merge_source_branch and cr['createdAt'] <= merge_time
            ]
            if source_branch_commits:
                # The last commit on source branch before/during merge
                source_head = source_branch_commits[-1]
                edges.append({'from': source_head['id'], 'to': c['id'], 'type': 'merge'})
        
        # Don't include snapshot in graph data — it's huge
        c['isMerge'] = is_merge
        c['isRevert'] = is_revert
        c['mergeSourceBranch'] = merge_source_branch
        del c['snapshot']
        nodes.append(c)
    
    branches = [dict(b) for b in branch_rows]
    
    return {'nodes': nodes, 'branches': branches, 'edges': edges}

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
    ''', (log_id, now, action, actor_type, actor_name, resource_type, resource_id, json.dumps(change_details) if change_details else None))
    
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

# --- Edit History Functions ---

def add_edit_history(requirement_id, user_id, user_name, field, old_value, new_value, branch_name=None):
    """Add an edit history entry for a requirement field change.
    
    Returns the edit history entry dict.
    """
    entry_id = str(uuid4())
    now = datetime.utcnow().isoformat()
    
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
    INSERT INTO edit_history (id, requirementId, userId, userName, timestamp, field, oldValue, newValue, branchName)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (entry_id, requirement_id, user_id, user_name, now, field, 
          str(old_value) if old_value is not None else None,
          str(new_value) if new_value is not None else None,
          branch_name))
    
    conn.commit()
    
    cursor.execute('SELECT * FROM edit_history WHERE id = ?', (entry_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row)

def get_edit_history(requirement_id, limit=100):
    """Get edit history entries for a specific requirement.
    
    Returns list of edit history dicts ordered by timestamp DESC, limited to `limit` results.
    """
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute(
        'SELECT * FROM edit_history WHERE requirementId = ? ORDER BY timestamp DESC LIMIT ?',
        (requirement_id, limit)
    )
    
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def get_edit_history_for_document(document_id, limit=500):
    """Get edit history entries for all requirements in a document.
    
    Joins edit_history with requirements by requirementId, filtered by documentId.
    Returns list of edit history dicts ordered by timestamp DESC, limited to `limit` results.
    """
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT eh.* FROM edit_history eh
        INNER JOIN requirements r ON eh.requirementId = r.id
        WHERE r.documentId = ?
        ORDER BY eh.timestamp DESC
        LIMIT ?
    ''', (document_id, limit))
    
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
    """Get all traceability links where the requirement is source or target,
    enriched with requirement titles, levels, and document names."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        'SELECT * FROM traceability WHERE sourceRequirementId = ? OR targetRequirementId = ?',
        (req_id, req_id)
    )
    rows = cursor.fetchall()
    
    links = [dict(row) for row in rows]
    
    # Enrich with titles and document names
    for link in links:
        # Source requirement info
        cursor.execute('SELECT title, level, documentId FROM requirements WHERE id = ?', (link['sourceRequirementId'],))
        src_row = cursor.fetchone()
        if src_row:
            link['sourceReqTitle'] = src_row['title']
            link['sourceReqLevel'] = src_row['level']
            link['sourceDocumentId'] = src_row['documentId']
            cursor.execute('SELECT title FROM documents WHERE id = ?', (src_row['documentId'],))
            src_doc = cursor.fetchone()
            link['sourceDocTitle'] = src_doc['title'] if src_doc else 'Unknown'
        else:
            link['sourceReqTitle'] = link['sourceRequirementId']
            link['sourceReqLevel'] = ''
            link['sourceDocumentId'] = ''
            link['sourceDocTitle'] = 'Unknown'
        
        # Target requirement info
        cursor.execute('SELECT title, level, documentId FROM requirements WHERE id = ?', (link['targetRequirementId'],))
        tgt_row = cursor.fetchone()
        if tgt_row:
            link['targetReqTitle'] = tgt_row['title']
            link['targetReqLevel'] = tgt_row['level']
            link['targetDocumentId'] = tgt_row['documentId'] if not link.get('targetDocumentId') else link['targetDocumentId']
            cursor.execute('SELECT title FROM documents WHERE id = ?', (link['targetDocumentId'],))
            tgt_doc = cursor.fetchone()
            link['targetDocTitle'] = tgt_doc['title'] if tgt_doc else 'Unknown'
        else:
            link['targetReqTitle'] = link['targetRequirementId']
            link['targetReqLevel'] = ''
            link['targetDocTitle'] = 'Unknown'
    
    conn.close()
    return links

def delete_traceability_link(link_id):
    """Delete a traceability link"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM traceability WHERE id = ?', (link_id,))
    deleted = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return deleted

# --- Comment Functions ---

def get_comments(req_id):
    """Get all comments for a requirement, ordered by createdAt ASC."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        'SELECT * FROM comments WHERE requirementId = ? ORDER BY createdAt ASC',
        (req_id,)
    )
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def create_comment(req_id, author, text):
    """Create a comment on a requirement. Returns the created comment dict."""
    comment_id = str(uuid4())
    now = datetime.utcnow().isoformat()
    
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('''
    INSERT INTO comments (id, requirementId, author, text, createdAt)
    VALUES (?, ?, ?, ?, ?)
    ''', (comment_id, req_id, author, text, now))
    conn.commit()
    
    cursor.execute('SELECT * FROM comments WHERE id = ?', (comment_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row)

def delete_comment(comment_id):
    """Delete a comment by id. Returns True if deleted, False otherwise."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM comments WHERE id = ?', (comment_id,))
    deleted = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return deleted

# --- Linting ---

AMBIGUOUS_WORDS = [
    'etc', 'etc.', 'and/or', 'and so on', 'user-friendly', 'easy to use',
    'sufficient', 'adequate', 'appropriate', 'reasonable', 'as needed',
    'as required', 'may', 'might', 'could', 'should', 'shall be considered',
    'generally', 'usually', 'typically', 'as appropriate', 'if applicable',
]

def lint_requirements(doc_id):
    """Lint all requirements in a document and return quality issues.

    Returns list of {
        requirementId, requirementTitle, level,
        issues: [{severity, message, field}]
    }
    """
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT id, title, description, level, verificationMethod FROM requirements WHERE documentId = ?', (doc_id,))
    rows = cursor.fetchall()
    conn.close()

    # Build title index for duplicate detection
    title_map = {}
    for row in rows:
        title_norm = (row[1] or '').lower().strip()
        if title_norm:
            title_map.setdefault(title_norm, []).append(row[0])

    results = []
    for row in rows:
        req_id = row[0]
        title = row[1] or ''
        description = row[2] or ''
        level = row[3] or ''
        verification = row[4] or ''
        issues = []

        # Check ambiguous words in title and description
        combined = (title + ' ' + description).lower()
        for word in AMBIGUOUS_WORDS:
            if word in combined:
                issues.append({
                    'severity': 'warning',
                    'message': f'Ambiguous word: "{word}"',
                    'field': 'description' if word in description.lower() else 'title',
                })

        # Missing verification method
        if not verification or verification.strip() == '':
            issues.append({
                'severity': 'error',
                'message': 'Missing verification method',
                'field': 'verificationMethod',
            })

        # Length checks
        desc_text = description.strip()
        if len(desc_text) < 20:
            issues.append({
                'severity': 'warning',
                'message': 'Description is very short (< 20 chars)',
                'field': 'description',
            })
        if len(desc_text) > 2000:
            issues.append({
                'severity': 'warning',
                'message': 'Description is very long (> 2000 chars)',
                'field': 'description',
            })

        # Empty title
        if not title.strip():
            issues.append({
                'severity': 'error',
                'message': 'Title is empty',
                'field': 'title',
            })

        # Duplicate title
        title_norm = title.lower().strip()
        if title_norm and len(title_map.get(title_norm, [])) > 1:
            issues.append({
                'severity': 'error',
                'message': 'Duplicate title detected',
                'field': 'title',
            })

        if issues:
            results.append({
                'requirementId': req_id,
                'requirementTitle': title,
                'level': level,
                'issues': issues,
            })

    return results

# --- Dashboard Stats ---

def get_dashboard_stats():
    """Get global dashboard statistics across all documents.

    Returns {
        totalDocuments,
        totalRequirements,
        requirementsByStatus: {status: count},
        requirementsByPriority: {priority: count},
        documentsNeedingAttention: [{id, title, draftCount, reviewCount}],
        recentActivity: [audit_log dicts],
        topTags: [{tag, count}],
    }
    """
    conn = get_connection()
    cursor = conn.cursor()

    # Total documents
    cursor.execute('SELECT COUNT(*) FROM documents')
    total_documents = cursor.fetchone()[0] or 0

    # Total requirements
    cursor.execute('SELECT COUNT(*) FROM requirements')
    total_requirements = cursor.fetchone()[0] or 0

    # Requirements by status
    cursor.execute('SELECT status, COUNT(*) FROM requirements GROUP BY status')
    by_status = {row[0] or 'unknown': row[1] for row in cursor.fetchall()}

    # Requirements by priority
    cursor.execute('SELECT priority, COUNT(*) FROM requirements GROUP BY priority')
    by_priority = {row[0] or 'unknown': row[1] for row in cursor.fetchall()}

    # Documents needing attention (draft or review requirements)
    cursor.execute('''
        SELECT d.id, d.title,
               SUM(CASE WHEN r.status = 'draft' THEN 1 ELSE 0 END) as draftCount,
               SUM(CASE WHEN r.status = 'review' THEN 1 ELSE 0 END) as reviewCount
        FROM documents d
        LEFT JOIN requirements r ON d.id = r.documentId
        WHERE r.status IN ('draft', 'review')
        GROUP BY d.id
        HAVING draftCount > 0 OR reviewCount > 0
        ORDER BY reviewCount DESC, draftCount DESC
        LIMIT 10
    ''')
    docs_attention = []
    for row in cursor.fetchall():
        docs_attention.append({
            'id': row[0],
            'title': row[1],
            'draftCount': row[2] or 0,
            'reviewCount': row[3] or 0,
        })

    # Recent activity (last 15 audit log entries)
    cursor.execute('''
        SELECT * FROM audit_log
        ORDER BY timestamp DESC
        LIMIT 15
    ''')
    recent_activity = [dict(row) for row in cursor.fetchall()]

    # Top tags
    cursor.execute('SELECT tags FROM requirements')
    tag_counts = {}
    for row in cursor.fetchall():
        try:
            tags = json.loads(row[0]) if row[0] else []
            if isinstance(tags, list):
                for t in tags:
                    if isinstance(t, str) and t.strip():
                        tag = t.strip()
                        tag_counts[tag] = tag_counts.get(tag, 0) + 1
        except (json.JSONDecodeError, TypeError):
            pass
    top_tags = sorted([{'tag': k, 'count': v} for k, v in tag_counts.items()],
                      key=lambda x: x['count'], reverse=True)[:10]

    conn.close()
    return {
        'totalDocuments': total_documents,
        'totalRequirements': total_requirements,
        'requirementsByStatus': by_status,
        'requirementsByPriority': by_priority,
        'documentsNeedingAttention': docs_attention,
        'recentActivity': recent_activity,
        'topTags': top_tags,
    }
