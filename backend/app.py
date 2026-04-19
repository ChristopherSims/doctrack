from flask import Flask, request, jsonify
from flask_cors import CORS
from database import init_db, get_all_documents, create_document_db, get_document_db, update_document_db, delete_document_db
from database import get_all_requirements, create_requirement_db, get_requirement_db, update_requirement_db, delete_requirement_db
from database import batch_update_requirements, get_all_requirements_flat, get_document_stats
import os
import logging

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

# --- Health check ---

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'})

# --- Error handlers ---

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
