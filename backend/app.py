from flask import Flask, request, jsonify, Response
from flask_cors import CORS
from database import init_db, get_all_documents, create_document_db, get_document_db, update_document_db, delete_document_db
from database import get_all_requirements, create_requirement_db, get_requirement_db, update_requirement_db, delete_requirement_db
from database import batch_update_requirements, get_all_requirements_flat, get_document_stats
from database import create_commit, get_commits, get_commit
from database import create_branch, get_branches, checkout_branch, merge_branches, revert_branch, get_commit_graph
from database import create_tag, get_tags
from database import create_traceability_link, get_traceability_links, delete_traceability_link
from database import add_audit_log, get_audit_log
from database import add_edit_history, get_edit_history, get_edit_history_for_document, get_requirement_at_history
from database import get_unique_tags
from database import get_comments, create_comment, delete_comment
from database import get_dashboard_stats
from database import lint_requirements
from database import create_review, get_reviews, update_review, delete_review
from database import create_baseline, get_baselines, get_baseline, delete_baseline
from export import export_csv, export_word, export_pdf
import os
import csv
import json
import logging
from io import StringIO
from uuid import uuid4
from datetime import datetime

app = Flask(__name__)

# Configure CORS explicitly for Electron and local development origins
CORS(app, origins=[
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173',
    'file://',  # Electron file:// origin
], methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], allow_headers=['Content-Type', 'Authorization'])

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize database on startup
init_db()

# --- Helper ---

def validate_json(required_fields=None):
    """Validate that request has JSON body and required fields.
    Returns (data, error_response) - if error_response is not None, return it."""
    data = request.json
    if data is None:
        return None, (jsonify({'success': False, 'error': 'Request body must be JSON'}), 400)
    if required_fields:
        missing = [f for f in required_fields if f not in data]
        if missing:
            return None, (jsonify({'success': False, 'error': f'Missing required fields: {", ".join(missing)}'}), 400)
    return data, None

# --- Document Routes ---

@app.route('/api/documents', methods=['GET'])
def get_documents():
    try:
        documents = get_all_documents()
        return jsonify({'success': True, 'data': documents})
    except Exception as e:
        logger.error(f"Error fetching documents: {e}")
        return jsonify({'success': False, 'error': 'Failed to fetch documents'}), 500

@app.route('/api/documents', methods=['POST'])
def create_document():
    try:
        data, err = validate_json(required_fields=['title', 'owner'])
        if err:
            return err
        document = create_document_db(data)
        return jsonify({'success': True, 'data': document}), 201
    except Exception as e:
        logger.error(f"Error creating document: {e}")
        return jsonify({'success': False, 'error': f'Failed to create document: {str(e)}'}), 400

@app.route('/api/documents/<doc_id>', methods=['GET'])
def get_document(doc_id):
    try:
        document = get_document_db(doc_id)
        if not document:
            return jsonify({'success': False, 'error': 'Document not found'}), 404
        return jsonify({'success': True, 'data': document})
    except Exception as e:
        logger.error(f"Error fetching document {doc_id}: {e}")
        return jsonify({'success': False, 'error': 'Failed to fetch document'}), 500

@app.route('/api/documents/<doc_id>', methods=['PUT'])
def update_document(doc_id):
    try:
        data, err = validate_json()
        if err:
            return err
        document = update_document_db(doc_id, data)
        if not document:
            return jsonify({'success': False, 'error': 'Document not found'}), 404
        return jsonify({'success': True, 'data': document})
    except Exception as e:
        logger.error(f"Error updating document {doc_id}: {e}")
        return jsonify({'success': False, 'error': f'Failed to update document: {str(e)}'}), 400

@app.route('/api/documents/<doc_id>', methods=['DELETE'])
def delete_document(doc_id):
    try:
        delete_document_db(doc_id)
        return jsonify({'success': True, 'data': None})
    except Exception as e:
        logger.error(f"Error deleting document {doc_id}: {e}")
        return jsonify({'success': False, 'error': 'Failed to delete document'}), 500

# --- Document Stats ---

@app.route('/api/documents/<doc_id>/unique-tags', methods=['GET'])
def unique_tags(doc_id):
    try:
        document = get_document_db(doc_id)
        if not document:
            return jsonify({'success': False, 'error': 'Document not found'}), 404
        tags = get_unique_tags(doc_id)
        return jsonify({'success': True, 'data': tags})
    except Exception as e:
        logger.error(f"Error fetching unique tags for document {doc_id}: {e}")
        return jsonify({'success': False, 'error': 'Failed to fetch unique tags'}), 500

@app.route('/api/documents/<doc_id>/stats', methods=['GET'])
def document_stats(doc_id):
    try:
        stats = get_document_stats(doc_id)
        if stats is None:
            return jsonify({'success': False, 'error': 'Document not found'}), 404
        return jsonify({'success': True, 'data': stats})
    except Exception as e:
        logger.error(f"Error fetching stats for document {doc_id}: {e}")
        return jsonify({'success': False, 'error': 'Failed to fetch document stats'}), 500

@app.route('/api/documents/<doc_id>/lint', methods=['GET'])
def lint_document(doc_id):
    try:
        document = get_document_db(doc_id)
        if not document:
            return jsonify({'success': False, 'error': 'Document not found'}), 404
        issues = lint_requirements(doc_id)
        return jsonify({'success': True, 'data': issues, 'count': len(issues)})
    except Exception as e:
        logger.error(f"Error linting document {doc_id}: {e}")
        return jsonify({'success': False, 'error': 'Failed to lint document'}), 500

# --- Requirement Routes ---

@app.route('/api/documents/<doc_id>/requirements', methods=['GET'])
def get_requirements(doc_id):
    try:
        # Verify document exists
        document = get_document_db(doc_id)
        if not document:
            return jsonify({'success': False, 'error': 'Document not found'}), 404
        requirements = get_all_requirements(doc_id)
        return jsonify({'success': True, 'data': requirements})
    except Exception as e:
        logger.error(f"Error fetching requirements for document {doc_id}: {e}")
        return jsonify({'success': False, 'error': 'Failed to fetch requirements'}), 500

@app.route('/api/requirements', methods=['POST'])
def create_requirement():
    try:
        data, err = validate_json(required_fields=['documentId', 'title', 'description'])
        if err:
            return err
        requirement = create_requirement_db(data)
        return jsonify({'success': True, 'data': requirement}), 201
    except Exception as e:
        logger.error(f"Error creating requirement: {e}")
        return jsonify({'success': False, 'error': f'Failed to create requirement: {str(e)}'}), 400

@app.route('/api/requirements/<req_id>', methods=['GET'])
def get_requirement(req_id):
    try:
        requirement = get_requirement_db(req_id)
        if not requirement:
            return jsonify({'success': False, 'error': 'Requirement not found'}), 404
        return jsonify({'success': True, 'data': requirement})
    except Exception as e:
        logger.error(f"Error fetching requirement {req_id}: {e}")
        return jsonify({'success': False, 'error': 'Failed to fetch requirement'}), 500

@app.route('/api/requirements/<req_id>', methods=['PUT'])
def update_requirement(req_id):
    try:
        data, err = validate_json()
        if err:
            return err
        requirement = update_requirement_db(req_id, data)
        if not requirement:
            return jsonify({'success': False, 'error': 'Requirement not found'}), 404
        return jsonify({'success': True, 'data': requirement})
    except Exception as e:
        logger.error(f"Error updating requirement {req_id}: {e}")
        return jsonify({'success': False, 'error': f'Failed to update requirement: {str(e)}'}), 400

@app.route('/api/requirements/<req_id>', methods=['DELETE'])
def delete_requirement(req_id):
    try:
        delete_requirement_db(req_id)
        return jsonify({'success': True, 'data': None})
    except Exception as e:
        logger.error(f"Error deleting requirement {req_id}: {e}")
        return jsonify({'success': False, 'error': 'Failed to delete requirement'}), 500

# --- Batch Update Requirements ---

@app.route('/api/requirements/batch', methods=['PUT'])
def batch_update():
    try:
        data, err = validate_json(required_fields=['updates'])
        if err:
            return err
        updates = data['updates']
        if not isinstance(updates, list) or len(updates) == 0:
            return jsonify({'success': False, 'error': 'updates must be a non-empty array'}), 400
        results, errors = batch_update_requirements(updates)
        status_code = 200 if not errors else 207  # 207 Multi-Status for partial success
        return jsonify({
            'success': len(errors) == 0,
            'data': results,
            'errors': errors,
            'updated': len(results),
            'failed': len(errors)
        }), status_code
    except Exception as e:
        logger.error(f"Error in batch update: {e}")
        return jsonify({'success': False, 'error': f'Batch update failed: {str(e)}'}), 500

# --- Search Requirements ---

@app.route('/api/documents/<doc_id>/requirements/search', methods=['GET'])
def search_requirements(doc_id):
    try:
        query = request.args.get('q', '').lower()
        if not query:
            return jsonify({'success': False, 'error': 'Search query parameter "q" is required'}), 400
        # Verify document exists
        document = get_document_db(doc_id)
        if not document:
            return jsonify({'success': False, 'error': 'Document not found'}), 404
        requirements = get_all_requirements(doc_id)
        filtered = [
            r for r in requirements
            if query in r.get('title', '').lower()
            or query in r.get('description', '').lower()
            or query in r.get('rationale', '').lower()
            or query in r.get('tags', '').lower()
        ]
        return jsonify({'success': True, 'data': filtered, 'count': len(filtered)})
    except Exception as e:
        logger.error(f"Error searching requirements in document {doc_id}: {e}")
        return jsonify({'success': False, 'error': 'Failed to search requirements'}), 500

@app.route('/api/requirements/search', methods=['GET'])
def global_search_requirements():
    try:
        query = request.args.get('q', '').lower()
        if not query:
            return jsonify({'success': False, 'error': 'Search query parameter "q" is required'}), 400
        all_requirements = get_all_requirements_flat()
        filtered = [
            r for r in all_requirements
            if query in r.get('title', '').lower()
            or query in r.get('description', '').lower()
            or query in r.get('rationale', '').lower()
            or query in r.get('tags', '').lower()
            or query in r.get('verificationMethod', '').lower()
        ]
        return jsonify({'success': True, 'data': filtered, 'count': len(filtered)})
    except Exception as e:
        logger.error(f"Error in global requirement search: {e}")
        return jsonify({'success': False, 'error': 'Failed to search requirements'}), 500

# --- Version Control: Commits ---

@app.route('/api/documents/<doc_id>/commits', methods=['POST'])
def create_commit_route(doc_id):
    try:
        data, err = validate_json(required_fields=['message', 'author'])
        if err:
            return err
        document = get_document_db(doc_id)
        if not document:
            return jsonify({'success': False, 'error': 'Document not found'}), 404
        current_branch = document.get('currentBranch', 'main')
        commit = create_commit(doc_id, current_branch, data['message'], data['author'])
        add_audit_log('create_commit', 'document', data['author'], 'document', doc_id, {'commitId': commit['id'], 'branch': current_branch})
        return jsonify({'success': True, 'data': commit}), 201
    except Exception as e:
        logger.error(f"Error creating commit for document {doc_id}: {e}")
        return jsonify({'success': False, 'error': f'Failed to create commit: {str(e)}'}), 500

@app.route('/api/documents/<doc_id>/commits', methods=['GET'])
def get_commits_route(doc_id):
    try:
        branch = request.args.get('branch')
        commits = get_commits(doc_id, branch)
        return jsonify({'success': True, 'data': commits})
    except Exception as e:
        logger.error(f"Error fetching commits for document {doc_id}: {e}")
        return jsonify({'success': False, 'error': 'Failed to fetch commits'}), 500

@app.route('/api/commits/<commit_id>', methods=['GET'])
def get_commit_route(commit_id):
    try:
        commit = get_commit(commit_id)
        if not commit:
            return jsonify({'success': False, 'error': 'Commit not found'}), 404
        return jsonify({'success': True, 'data': commit})
    except Exception as e:
        logger.error(f"Error fetching commit {commit_id}: {e}")
        return jsonify({'success': False, 'error': 'Failed to fetch commit'}), 500

@app.route('/api/commits/<commit_id1>/<commit_id2>/diff', methods=['GET'])
def diff_commits(commit_id1, commit_id2):
    try:
        commit1 = get_commit(commit_id1)
        commit2 = get_commit(commit_id2)
        if not commit1:
            return jsonify({'success': False, 'error': f'Commit {commit_id1} not found'}), 404
        if not commit2:
            return jsonify({'success': False, 'error': f'Commit {commit_id2} not found'}), 404

        snapshot1 = json.loads(commit1.get('snapshot', '[]'))
        snapshot2 = json.loads(commit2.get('snapshot', '[]'))

        # Build lookup by requirement id
        reqs1 = {r['id']: r for r in snapshot1}
        reqs2 = {r['id']: r for r in snapshot2}

        added = [r for rid, r in reqs2.items() if rid not in reqs1]
        removed = [r for rid, r in reqs1.items() if rid not in reqs2]
        modified = []

        common_ids = set(reqs1.keys()) & set(reqs2.keys())
        for rid in common_ids:
            r1 = reqs1[rid]
            r2 = reqs2[rid]
            field_changes = []
            all_keys = set(r1.keys()) | set(r2.keys())
            for key in all_keys:
                if key in ('createdAt', 'updatedAt'):
                    continue
                val1 = r1.get(key)
                val2 = r2.get(key)
                if val1 != val2:
                    field_changes.append({
                        'field': key,
                        'oldValue': val1,
                        'newValue': val2
                    })
            if field_changes:
                modified.append({
                    'id': rid,
                    'changes': field_changes
                })

        return jsonify({
            'success': True,
            'data': {
                'added': added,
                'removed': removed,
                'modified': modified
            }
        })
    except Exception as e:
        logger.error(f"Error diffing commits {commit_id1} and {commit_id2}: {e}")
        return jsonify({'success': False, 'error': f'Failed to diff commits: {str(e)}'}), 500

# --- Version Control: Branches ---

@app.route('/api/documents/<doc_id>/branches', methods=['POST'])
def create_branch_route(doc_id):
    try:
        data, err = validate_json(required_fields=['name', 'createdBy'])
        if err:
            return err
        document = get_document_db(doc_id)
        if not document:
            return jsonify({'success': False, 'error': 'Document not found'}), 404
        branch = create_branch(doc_id, data['name'], data.get('description'), data['createdBy'])
        if not branch:
            return jsonify({'success': False, 'error': 'Branch name already exists'}), 409
        add_audit_log('create_branch', 'document', data['createdBy'], 'document', doc_id, {'branchName': data['name']})
        return jsonify({'success': True, 'data': branch}), 201
    except Exception as e:
        logger.error(f"Error creating branch for document {doc_id}: {e}")
        return jsonify({'success': False, 'error': f'Failed to create branch: {str(e)}'}), 400

@app.route('/api/documents/<doc_id>/branches', methods=['GET'])
def get_branches_route(doc_id):
    try:
        branches = get_branches(doc_id)
        return jsonify({'success': True, 'data': branches})
    except Exception as e:
        logger.error(f"Error fetching branches for document {doc_id}: {e}")
        return jsonify({'success': False, 'error': 'Failed to fetch branches'}), 500

@app.route('/api/documents/<doc_id>/branches/<branch_name>/checkout', methods=['POST'])
def checkout_branch_route(doc_id, branch_name):
    try:
        document = checkout_branch(doc_id, branch_name)
        if not document:
            return jsonify({'success': False, 'error': 'Document not found'}), 404
        add_audit_log('checkout_branch', 'document', None, 'document', doc_id, {'branchName': branch_name})
        return jsonify({'success': True, 'data': document})
    except Exception as e:
        logger.error(f"Error checking out branch {branch_name} for document {doc_id}: {e}")
        return jsonify({'success': False, 'error': f'Failed to checkout branch: {str(e)}'}), 500

@app.route('/api/documents/<doc_id>/merge', methods=['POST'])
def merge_branches_route(doc_id):
    try:
        data, err = validate_json(required_fields=['sourceBranch', 'targetBranch', 'author'])
        if err:
            return err
        result = merge_branches(doc_id, data['sourceBranch'], data['targetBranch'], data['author'])
        if not result:
            return jsonify({'success': False, 'error': 'No commits found on source branch to merge'}), 400
        add_audit_log('merge_branches', 'document', data['author'], 'document', doc_id,
                  {'sourceBranch': data['sourceBranch'], 'targetBranch': data['targetBranch'], 'commitId': result['mergeCommitId']})
        return jsonify({'success': True, 'data': result})
    except Exception as e:
        logger.error(f"Error merging branches for document {doc_id}: {e}")
        return jsonify({'success': False, 'error': f'Failed to merge branches: {str(e)}'}), 500

@app.route('/api/documents/<doc_id>/revert', methods=['POST'])
def revert_branch_route(doc_id):
    try:
        data, err = validate_json(required_fields=['branchName', 'commitId', 'author'])
        if err:
            return err
        result = revert_branch(doc_id, data['branchName'], data['commitId'], data['author'])
        if not result:
            return jsonify({'success': False, 'error': 'Branch or commit not found'}), 404
        add_audit_log('revert_branch', 'document', data['author'], 'document', doc_id,
                  {'branchName': data['branchName'], 'commitId': data['commitId']})
        return jsonify({'success': True, 'data': result})
    except Exception as e:
        logger.error(f"Error reverting branch for document {doc_id}: {e}")
        return jsonify({'success': False, 'error': f'Failed to revert branch: {str(e)}'}), 500

@app.route('/api/documents/<doc_id>/commit-graph', methods=['GET'])
def commit_graph_route(doc_id):
    try:
        graph = get_commit_graph(doc_id)
        return jsonify({'success': True, 'data': graph})
    except Exception as e:
        logger.error(f"Error fetching commit graph for document {doc_id}: {e}")
        return jsonify({'success': False, 'error': 'Failed to fetch commit graph'}), 500

# --- Version Control: Tags ---

@app.route('/api/documents/<doc_id>/tags', methods=['POST'])
def create_tag_route(doc_id):
    try:
        data, err = validate_json(required_fields=['name', 'commitId', 'createdBy'])
        if err:
            return err
        tag = create_tag(doc_id, data['name'], data['commitId'], data.get('message'), data['createdBy'])
        if not tag:
            return jsonify({'success': False, 'error': 'Tag name already exists for this document'}), 409
        add_audit_log('create_tag', 'document', data['createdBy'], 'document', doc_id, {'tagName': data['name'], 'commitId': data['commitId']})
        return jsonify({'success': True, 'data': tag}), 201
    except Exception as e:
        logger.error(f"Error creating tag for document {doc_id}: {e}")
        return jsonify({'success': False, 'error': f'Failed to create tag: {str(e)}'}), 400

@app.route('/api/documents/<doc_id>/tags', methods=['GET'])
def get_tags_route(doc_id):
    try:
        tags = get_tags(doc_id)
        return jsonify({'success': True, 'data': tags})
    except Exception as e:
        logger.error(f"Error fetching tags for document {doc_id}: {e}")
        return jsonify({'success': False, 'error': 'Failed to fetch tags'}), 500

# --- Traceability ---

@app.route('/api/traceability', methods=['POST'])
def create_traceability_route():
    try:
        data, err = validate_json(required_fields=['sourceRequirementId', 'targetRequirementId', 'targetDocumentId', 'linkType'])
        if err:
            return err
        link = create_traceability_link(
            data['sourceRequirementId'],
            data['targetRequirementId'],
            data['targetDocumentId'],
            data['linkType']
        )
        add_audit_log('create_traceability_link', 'requirement', None, 'requirement', data['sourceRequirementId'],
                  {'targetRequirementId': data['targetRequirementId'], 'linkType': data['linkType']})
        return jsonify({'success': True, 'data': link}), 201
    except Exception as e:
        logger.error(f"Error creating traceability link: {e}")
        return jsonify({'success': False, 'error': f'Failed to create traceability link: {str(e)}'}), 400

@app.route('/api/traceability/<req_id>', methods=['GET'])
def get_traceability_route(req_id):
    try:
        links = get_traceability_links(req_id)
        return jsonify({'success': True, 'data': links})
    except Exception as e:
        logger.error(f"Error fetching traceability links for requirement {req_id}: {e}")
        return jsonify({'success': False, 'error': 'Failed to fetch traceability links'}), 500

@app.route('/api/traceability/<link_id>', methods=['DELETE'])
def delete_traceability_route(link_id):
    try:
        deleted = delete_traceability_link(link_id)
        if not deleted:
            return jsonify({'success': False, 'error': 'Traceability link not found'}), 404
        add_audit_log('delete_traceability_link', 'traceability', None, 'traceability', link_id)
        return jsonify({'success': True, 'data': None})
    except Exception as e:
        logger.error(f"Error deleting traceability link {link_id}: {e}")
        return jsonify({'success': False, 'error': 'Failed to delete traceability link'}), 500

# --- Audit Log ---

@app.route('/api/audit-log', methods=['GET'])
def audit_log_route():
    try:
        resource_id = request.args.get('resource_id')
        logs = get_audit_log(resource_id)
        return jsonify({'success': True, 'data': logs})
    except Exception as e:
        logger.error(f"Error fetching audit log: {e}")
        return jsonify({'success': False, 'error': 'Failed to fetch audit log'}), 500

# --- Edit History ---

@app.route('/api/requirements/<req_id>/history', methods=['GET'])
def requirement_history(req_id):
    try:
        history = get_edit_history(req_id)
        return jsonify({'success': True, 'data': history})
    except Exception as e:
        logger.error(f"Error fetching edit history for requirement {req_id}: {e}")
        return jsonify({'success': False, 'error': 'Failed to fetch edit history'}), 500

@app.route('/api/documents/<doc_id>/history', methods=['GET'])
def document_history(doc_id):
    try:
        # Verify document exists
        document = get_document_db(doc_id)
        if not document:
            return jsonify({'success': False, 'error': 'Document not found'}), 404
        history = get_edit_history_for_document(doc_id)
        return jsonify({'success': True, 'data': history})
    except Exception as e:
        logger.error(f"Error fetching edit history for document {doc_id}: {e}")
        return jsonify({'success': False, 'error': 'Failed to fetch document edit history'}), 500

@app.route('/api/requirements/<req_id>/history/<history_id>/snapshot', methods=['GET'])
def requirement_history_snapshot(req_id, history_id):
    try:
        req = get_requirement_at_history(req_id, history_id)
        if not req:
            return jsonify({'success': False, 'error': 'Requirement not found'}), 404
        return jsonify({'success': True, 'data': req})
    except Exception as e:
        logger.error(f"Error fetching history snapshot for {req_id} at {history_id}: {e}")
        return jsonify({'success': False, 'error': 'Failed to fetch snapshot'}), 500

# --- CSV Template Export & Import ---

@app.route('/api/documents/<doc_id>/csv-template', methods=['GET'])
def csv_template_export(doc_id):
    """Return a CSV with only the header row for users to fill in for import."""
    try:
        document = get_document_db(doc_id)
        if not document:
            return jsonify({'success': False, 'error': 'Document not found'}), 404

        headers = [
            'Level', 'Title', 'Description', 'Status', 'Priority',
            'Change Request ID', 'Change Request Link', 'Test Plan',
            'Test Plan Link', 'Verification Method', 'Rationale', 'Tags'
        ]

        output = StringIO()
        writer = csv.writer(output)
        writer.writerow(headers)
        csv_content = output.getvalue()

        doc_title = document.get('title', 'document')
        return Response(
            csv_content,
            200,
            {
                'Content-Type': 'text/csv',
                'Content-Disposition': f'attachment; filename="{doc_title}_import_template.csv"'
            }
        )
    except Exception as e:
        logger.error(f"Error exporting CSV template for document {doc_id}: {e}")
        return jsonify({'success': False, 'error': 'Failed to export CSV template'}), 500

@app.route('/api/documents/<doc_id>/import-csv', methods=['POST'])
def csv_import(doc_id):
    """Import requirements from a JSON body with a requirements array."""
    try:
        document = get_document_db(doc_id)
        if not document:
            return jsonify({'success': False, 'error': 'Document not found'}), 404

        data, err = validate_json(required_fields=['requirements'])
        if err:
            return err

        requirements = data['requirements']
        created_by = data.get('createdBy', 'system')
        imported = 0
        errors = []

        for idx, row in enumerate(requirements):
            title = row.get('title', '').strip()
            if not title:
                errors.append({'row': idx, 'error': 'Missing title'})
                continue

            # Convert tags: comma-separated string -> JSON array
            tags = row.get('tags', [])
            if isinstance(tags, str):
                tags = [t.strip() for t in tags.split(',') if t.strip()]

            req_data = {
                'documentId': doc_id,
                'title': title,
                'description': row.get('description', ''),
                'status': row.get('status', 'draft'),
                'priority': row.get('priority', 'medium'),
                'level': row.get('level', '1'),
                'createdBy': created_by,
                'changeRequestId': row.get('changeRequestId', ''),
                'changeRequestLink': row.get('changeRequestLink', ''),
                'testPlan': row.get('testPlan', ''),
                'testPlanLink': row.get('testPlanLink', ''),
                'verificationMethod': row.get('verificationMethod', ''),
                'rationale': row.get('rationale', ''),
                'tags': tags,
                'custom_fields': {},
                'related_requirements': [],
                'parentRequirementId': None
            }

            try:
                create_requirement_db(req_data)
                imported += 1
            except Exception as e:
                errors.append({'row': idx, 'title': title, 'error': str(e)})

        return jsonify({'success': True, 'data': {'imported': imported, 'errors': errors}})
    except Exception as e:
        logger.error(f"Error importing CSV for document {doc_id}: {e}")
        return jsonify({'success': False, 'error': f'Failed to import CSV: {str(e)}'}), 500

# --- Traceability Tree ---

@app.route('/api/documents/<doc_id>/traceability-tree', methods=['GET'])
def traceability_tree(doc_id):
    """Return all traceability links for a document's requirements, enriched with titles."""
    try:
        document = get_document_db(doc_id)
        if not document:
            return jsonify({'success': False, 'error': 'Document not found'}), 404

        requirements = get_all_requirements(doc_id)
        doc_title = document.get('title', '')

        nodes = []
        for req in requirements:
            links = get_traceability_links(req['id'])

            outgoing = []
            incoming = []

            for link in links:
                if link['sourceRequirementId'] == req['id']:
                    # This requirement is the source -> outgoing link
                    outgoing.append({
                        'linkId': link['id'],
                        'targetId': link['targetRequirementId'],
                        'targetTitle': link.get('targetReqTitle', ''),
                        'targetLevel': link.get('targetReqLevel', ''),
                        'targetDocumentId': link.get('targetDocumentId', ''),
                        'targetDocumentTitle': link.get('targetDocTitle', ''),
                        'linkType': link.get('linkType', '')
                    })
                else:
                    # This requirement is the target -> incoming link
                    incoming.append({
                        'linkId': link['id'],
                        'sourceId': link['sourceRequirementId'],
                        'sourceTitle': link.get('sourceReqTitle', ''),
                        'sourceLevel': link.get('sourceReqLevel', ''),
                        'sourceDocumentId': link.get('sourceDocumentId', ''),
                        'sourceDocumentTitle': link.get('sourceDocTitle', ''),
                        'linkType': link.get('linkType', '')
                    })

            nodes.append({
                'id': req['id'],
                'title': req.get('title', ''),
                'level': req.get('level', ''),
                'documentId': doc_id,
                'documentTitle': doc_title,
                'outgoing': outgoing,
                'incoming': incoming
            })

        return jsonify({'success': True, 'data': {'nodes': nodes}})
    except Exception as e:
        logger.error(f"Error fetching traceability tree for document {doc_id}: {e}")
        return jsonify({'success': False, 'error': 'Failed to fetch traceability tree'}), 500

# --- Requirement Comments ---

@app.route('/api/requirements/<req_id>/comments', methods=['GET'])
def get_req_comments(req_id):
    """List all comments for a requirement."""
    try:
        comments = get_comments(req_id)
        return jsonify({'success': True, 'data': comments})
    except Exception as e:
        logger.error(f"Error fetching comments for requirement {req_id}: {e}")
        return jsonify({'success': False, 'error': 'Failed to fetch comments'}), 500

@app.route('/api/requirements/<req_id>/comments', methods=['POST'])
def create_req_comment(req_id):
    """Create a comment on a requirement."""
    try:
        data, err = validate_json(required_fields=['content'])
        if err:
            return err
        author = data.get('authorType', 'user')
        content = data['content']
        comment = create_comment(req_id, author, content)
        return jsonify({'success': True, 'data': comment}), 201
    except Exception as e:
        logger.error(f"Error creating comment on requirement {req_id}: {e}")
        return jsonify({'success': False, 'error': f'Failed to create comment: {str(e)}'}), 400

@app.route('/api/comments/<comment_id>', methods=['DELETE'])
def delete_req_comment(comment_id):
    """Delete a comment by id."""
    try:
        deleted = delete_comment(comment_id)
        if not deleted:
            return jsonify({'success': False, 'error': 'Comment not found'}), 404
        return jsonify({'success': True, 'data': None})
    except Exception as e:
        logger.error(f"Error deleting comment {comment_id}: {e}")
        return jsonify({'success': False, 'error': 'Failed to delete comment'}), 500

# --- Requirement Reviews ---

@app.route('/api/requirements/<req_id>/reviews', methods=['GET'])
def get_req_reviews(req_id):
    try:
        reviews = get_reviews(req_id)
        return jsonify({'success': True, 'data': reviews})
    except Exception as e:
        logger.error(f"Error fetching reviews for requirement {req_id}: {e}")
        return jsonify({'success': False, 'error': 'Failed to fetch reviews'}), 500

@app.route('/api/requirements/<req_id>/reviews', methods=['POST'])
def create_req_review(req_id):
    try:
        data, err = validate_json(required_fields=['reviewerName'])
        if err:
            return err
        review = create_review(req_id, data['reviewerName'], data.get('comment'))
        return jsonify({'success': True, 'data': review}), 201
    except Exception as e:
        logger.error(f"Error creating review for requirement {req_id}: {e}")
        return jsonify({'success': False, 'error': f'Failed to create review: {str(e)}'}), 400

@app.route('/api/reviews/<review_id>', methods=['PUT'])
def update_req_review(review_id):
    try:
        data, err = validate_json(required_fields=['status'])
        if err:
            return err
        review = update_review(review_id, data['status'], data.get('comment'))
        if not review:
            return jsonify({'success': False, 'error': 'Review not found'}), 404
        return jsonify({'success': True, 'data': review})
    except Exception as e:
        logger.error(f"Error updating review {review_id}: {e}")
        return jsonify({'success': False, 'error': f'Failed to update review: {str(e)}'}), 400

@app.route('/api/reviews/<review_id>', methods=['DELETE'])
def delete_req_review(review_id):
    try:
        deleted = delete_review(review_id)
        if not deleted:
            return jsonify({'success': False, 'error': 'Review not found'}), 404
        return jsonify({'success': True, 'data': None})
    except Exception as e:
        logger.error(f"Error deleting review {review_id}: {e}")
        return jsonify({'success': False, 'error': 'Failed to delete review'}), 500

# --- Baselines ---

@app.route('/api/documents/<doc_id>/baselines', methods=['GET'])
def get_doc_baselines(doc_id):
    try:
        baselines = get_baselines(doc_id)
        return jsonify({'success': True, 'data': baselines})
    except Exception as e:
        logger.error(f"Error fetching baselines for document {doc_id}: {e}")
        return jsonify({'success': False, 'error': 'Failed to fetch baselines'}), 500

@app.route('/api/documents/<doc_id>/baselines', methods=['POST'])
def create_doc_baseline(doc_id):
    try:
        data, err = validate_json(required_fields=['name', 'commitId'])
        if err:
            return err
        baseline = create_baseline(
            doc_id,
            data['name'],
            data['commitId'],
            data.get('description'),
            data.get('createdBy')
        )
        return jsonify({'success': True, 'data': baseline}), 201
    except Exception as e:
        logger.error(f"Error creating baseline for document {doc_id}: {e}")
        return jsonify({'success': False, 'error': f'Failed to create baseline: {str(e)}'}), 400

@app.route('/api/baselines/<baseline_id>', methods=['GET'])
def get_baseline_by_id(baseline_id):
    try:
        baseline = get_baseline(baseline_id)
        if not baseline:
            return jsonify({'success': False, 'error': 'Baseline not found'}), 404
        return jsonify({'success': True, 'data': baseline})
    except Exception as e:
        logger.error(f"Error fetching baseline {baseline_id}: {e}")
        return jsonify({'success': False, 'error': 'Failed to fetch baseline'}), 500

@app.route('/api/baselines/<baseline_id>', methods=['DELETE'])
def delete_doc_baseline(baseline_id):
    try:
        deleted = delete_baseline(baseline_id)
        if not deleted:
            return jsonify({'success': False, 'error': 'Baseline not found'}), 404
        return jsonify({'success': True, 'data': None})
    except Exception as e:
        logger.error(f"Error deleting baseline {baseline_id}: {e}")
        return jsonify({'success': False, 'error': 'Failed to delete baseline'}), 500

# --- Health check ---

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'})

# --- Dashboard ---

@app.route('/api/dashboard', methods=['GET'])
def dashboard_route():
    try:
        stats = get_dashboard_stats()
        return jsonify({'success': True, 'data': stats})
    except Exception as e:
        logger.error(f"Error fetching dashboard stats: {e}")
        return jsonify({'success': False, 'error': 'Failed to fetch dashboard stats'}), 500

# --- Error handlers ---

# --- Export ---

@app.route('/api/documents/<doc_id>/export/<format>', methods=['POST'])
def export_document(doc_id, format):
    try:
        # Verify document exists
        document = get_document_db(doc_id)
        if not document:
            return jsonify({'success': False, 'error': 'Document not found'}), 404

        if format == 'csv':
            csv_content = export_csv(doc_id)
            return csv_content, 200, {
                'Content-Type': 'text/csv',
                'Content-Disposition': f'attachment; filename="{document.get("title", "document")}.csv"'
            }
        elif format == 'word':
            docx_bytes = export_word(doc_id)
            return docx_bytes, 200, {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'Content-Disposition': f'attachment; filename="{document.get("title", "document")}.docx"'
            }
        elif format == 'pdf':
            pdf_bytes = export_pdf(doc_id)
            return pdf_bytes, 200, {
                'Content-Type': 'application/pdf',
                'Content-Disposition': f'attachment; filename="{document.get("title", "document")}.pdf"'
            }
        else:
            return jsonify({'success': False, 'error': f'Unsupported export format: {format}. Use csv, word, or pdf.'}), 400
    except ImportError as e:
        logger.error(f"Missing export dependency: {e}")
        return jsonify({'success': False, 'error': str(e)}), 501
    except Exception as e:
        logger.error(f"Error exporting document {doc_id} as {format}: {e}")
        return jsonify({'success': False, 'error': f'Export failed: {str(e)}'}), 500

@app.errorhandler(404)
def not_found(error):
    return jsonify({'success': False, 'error': 'Endpoint not found'}), 404

@app.errorhandler(405)
def method_not_allowed(error):
    return jsonify({'success': False, 'error': 'Method not allowed'}), 405

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'success': False, 'error': 'Internal server error'}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
