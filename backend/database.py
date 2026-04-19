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
