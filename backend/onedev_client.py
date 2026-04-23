"""OneDev REST API client and proxy.

Keeps the access token server-side and proxies requests from the frontend.
"""
import requests
import logging
from database import get_app_setting

logger = logging.getLogger(__name__)

ONEDEV_URL_KEY = 'onedev_url'
ONEDEV_TOKEN_KEY = 'onedev_token'
ONEDEV_PROJECT_KEY = 'onedev_project'


def _get_config():
    """Read OneDev connection config from app_settings."""
    return {
        'url': (get_app_setting(ONEDEV_URL_KEY) or '').rstrip('/'),
        'token': get_app_setting(ONEDEV_TOKEN_KEY) or '',
        'project': get_app_setting(ONEDEV_PROJECT_KEY) or '',
    }


def _headers(token):
    return {
        'Authorization': f'Bearer {token}',
        'Accept': 'application/json',
        'Content-Type': 'application/json',
    }


def is_configured():
    cfg = _get_config()
    return bool(cfg['url'] and cfg['token'])


def test_connection():
    """Test OneDev connectivity by hitting /api/server."""
    cfg = _get_config()
    if not cfg['url'] or not cfg['token']:
        return {'ok': False, 'error': 'OneDev not configured'}
    try:
        resp = requests.get(
            f"{cfg['url']}/api/server",
            headers=_headers(cfg['token']),
            timeout=10,
            verify=False,
        )
        resp.raise_for_status()
        return {'ok': True, 'data': resp.json()}
    except requests.exceptions.RequestException as e:
        logger.error(f"OneDev connection test failed: {e}")
        return {'ok': False, 'error': str(e)}


def get_projects(query=None):
    """List OneDev projects."""
    cfg = _get_config()
    if not cfg['url'] or not cfg['token']:
        return {'ok': False, 'error': 'OneDev not configured'}
    try:
        url = f"{cfg['url']}/api/projects"
        params = {}
        if query:
            params['query'] = query
        resp = requests.get(url, headers=_headers(cfg['token']), params=params, timeout=15, verify=False)
        resp.raise_for_status()
        return {'ok': True, 'data': resp.json()}
    except requests.exceptions.RequestException as e:
        logger.error(f"OneDev get_projects failed: {e}")
        return {'ok': False, 'error': str(e)}


def get_project(project_id):
    """Get a single OneDev project by id."""
    cfg = _get_config()
    if not cfg['url'] or not cfg['token']:
        return {'ok': False, 'error': 'OneDev not configured'}
    try:
        resp = requests.get(
            f"{cfg['url']}/api/projects/{project_id}",
            headers=_headers(cfg['token']),
            timeout=15,
            verify=False,
        )
        resp.raise_for_status()
        return {'ok': True, 'data': resp.json()}
    except requests.exceptions.RequestException as e:
        logger.error(f"OneDev get_project failed: {e}")
        return {'ok': False, 'error': str(e)}


def get_issues(project_id, query=None, offset=0, count=50):
    """List issues in a project."""
    cfg = _get_config()
    if not cfg['url'] or not cfg['token']:
        return {'ok': False, 'error': 'OneDev not configured'}
    try:
        url = f"{cfg['url']}/api/issues"
        params = {
            'projectId': project_id,
            'offset': offset,
            'count': count,
        }
        if query:
            params['query'] = query
        resp = requests.get(url, headers=_headers(cfg['token']), params=params, timeout=15, verify=False)
        resp.raise_for_status()
        return {'ok': True, 'data': resp.json()}
    except requests.exceptions.RequestException as e:
        logger.error(f"OneDev get_issues failed: {e}")
        return {'ok': False, 'error': str(e)}


def get_issue(issue_id):
    """Get a single issue by id."""
    cfg = _get_config()
    if not cfg['url'] or not cfg['token']:
        return {'ok': False, 'error': 'OneDev not configured'}
    try:
        resp = requests.get(
            f"{cfg['url']}/api/issues/{issue_id}",
            headers=_headers(cfg['token']),
            timeout=15,
            verify=False,
        )
        resp.raise_for_status()
        return {'ok': True, 'data': resp.json()}
    except requests.exceptions.RequestException as e:
        logger.error(f"OneDev get_issue failed: {e}")
        return {'ok': False, 'error': str(e)}


def get_builds(project_id, job=None, offset=0, count=50):
    """List builds in a project."""
    cfg = _get_config()
    if not cfg['url'] or not cfg['token']:
        return {'ok': False, 'error': 'OneDev not configured'}
    try:
        url = f"{cfg['url']}/api/builds"
        params = {
            'projectId': project_id,
            'offset': offset,
            'count': count,
        }
        if job:
            params['jobName'] = job
        resp = requests.get(url, headers=_headers(cfg['token']), params=params, timeout=15, verify=False)
        resp.raise_for_status()
        return {'ok': True, 'data': resp.json()}
    except requests.exceptions.RequestException as e:
        logger.error(f"OneDev get_builds failed: {e}")
        return {'ok': False, 'error': str(e)}


def get_build(build_id):
    """Get a single build by id."""
    cfg = _get_config()
    if not cfg['url'] or not cfg['token']:
        return {'ok': False, 'error': 'OneDev not configured'}
    try:
        resp = requests.get(
            f"{cfg['url']}/api/builds/{build_id}",
            headers=_headers(cfg['token']),
            timeout=15,
            verify=False,
        )
        resp.raise_for_status()
        return {'ok': True, 'data': resp.json()}
    except requests.exceptions.RequestException as e:
        logger.error(f"OneDev get_build failed: {e}")
        return {'ok': False, 'error': str(e)}


def get_commits(project_id, branch=None, offset=0, count=50):
    """List commits in a project."""
    cfg = _get_config()
    if not cfg['url'] or not cfg['token']:
        return {'ok': False, 'error': 'OneDev not configured'}
    try:
        url = f"{cfg['url']}/api/projects/{project_id}/commits"
        params = {
            'offset': offset,
            'count': count,
        }
        if branch:
            params['branch'] = branch
        resp = requests.get(url, headers=_headers(cfg['token']), params=params, timeout=15, verify=False)
        resp.raise_for_status()
        return {'ok': True, 'data': resp.json()}
    except requests.exceptions.RequestException as e:
        logger.error(f"OneDev get_commits failed: {e}")
        return {'ok': False, 'error': str(e)}


def get_pull_requests(project_id, query=None, offset=0, count=50):
    """List pull requests in a project."""
    cfg = _get_config()
    if not cfg['url'] or not cfg['token']:
        return {'ok': False, 'error': 'OneDev not configured'}
    try:
        url = f"{cfg['url']}/api/pull-requests"
        params = {
            'projectId': project_id,
            'offset': offset,
            'count': count,
        }
        if query:
            params['query'] = query
        resp = requests.get(url, headers=_headers(cfg['token']), params=params, timeout=15, verify=False)
        resp.raise_for_status()
        return {'ok': True, 'data': resp.json()}
    except requests.exceptions.RequestException as e:
        logger.error(f"OneDev get_pull_requests failed: {e}")
        return {'ok': False, 'error': str(e)}
