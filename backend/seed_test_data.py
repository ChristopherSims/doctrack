"""
Seed the database with test documents, requirements, and traceability links.

- Test-main: top-level system requirements (levels 1-3)
- Test1: traces up to Test-main (levels 1-3, subsystem A)
- Test2: traces up to Test-main (levels 1-4, subsystem B)

Run from Windows (where Flask runs) or WSL pointing at Windows DB.
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import init_db, get_connection, create_document_db, create_requirement_db, create_traceability_link

def seed():
    init_db()
    conn = get_connection()
    c = conn.cursor()

    # Check if test data already exists
    c.execute("SELECT id FROM documents WHERE title IN ('Test-main', 'Test1', 'Test2')")
    existing = c.fetchall()
    if existing:
        print(f"Test documents already exist ({len(existing)} found). Deleting old test data...")
        c.execute("""DELETE FROM traceability WHERE sourceRequirementId IN 
                     (SELECT id FROM requirements WHERE documentId IN 
                      (SELECT id FROM documents WHERE title IN ('Test-main','Test1','Test2')))
                  """)
        c.execute("""DELETE FROM traceability WHERE targetRequirementId IN 
                     (SELECT id FROM requirements WHERE documentId IN 
                      (SELECT id FROM documents WHERE title IN ('Test-main','Test1','Test2')))
                  """)
        c.execute("""DELETE FROM requirements WHERE documentId IN 
                     (SELECT id FROM documents WHERE title IN ('Test-main','Test1','Test2'))""")
        c.execute("""DELETE FROM branches WHERE documentId IN 
                     (SELECT id FROM documents WHERE title IN ('Test-main','Test1','Test2'))""")
        c.execute("DELETE FROM documents WHERE title IN ('Test-main','Test1','Test2')")
        conn.commit()
        print("Old test data cleared.")

    conn.close()

    # ---- Create Documents ----
    print("Creating Test-main...")
    doc_main = create_document_db({
        'title': 'Test-main',
        'description': 'Top-level system requirements document. Test1 and Test2 trace to these requirements.',
        'owner': 'System Engineer',
        'status': 'approved',
        'version': '1.0',
    })

    print("Creating Test1...")
    doc1 = create_document_db({
        'title': 'Test1',
        'description': 'Subsystem A requirements. These trace up to Test-main system requirements.',
        'owner': 'Engineer A',
        'status': 'draft',
        'version': '0.1',
    })

    print("Creating Test2...")
    doc2 = create_document_db({
        'title': 'Test2',
        'description': 'Subsystem B requirements. These trace up to Test-main system requirements.',
        'owner': 'Engineer B',
        'status': 'draft',
        'version': '0.1',
    })

    print(f"  Test-main ID: {doc_main['id']}")
    print(f"  Test1 ID:     {doc1['id']}")
    print(f"  Test2 ID:     {doc2['id']}")

    # ---- Requirements for Test-main ----
    print("\nCreating requirements for Test-main...")

    req_main_1 = create_requirement_db({
        'documentId': doc_main['id'],
        'title': 'System Performance',
        'description': 'The system shall respond to all user inputs within 200ms under nominal load conditions.',
        'status': 'approved', 'priority': 'high', 'level': '1',
        'createdBy': 'System Engineer',
    })
    req_main_1_1 = create_requirement_db({
        'documentId': doc_main['id'],
        'title': 'UI Response Time',
        'description': 'All UI interactions shall complete rendering within 100ms of user action.',
        'status': 'approved', 'priority': 'high', 'level': '1.1',
        'createdBy': 'System Engineer', 'parentRequirementId': req_main_1['id'],
    })
    req_main_1_2 = create_requirement_db({
        'documentId': doc_main['id'],
        'title': 'API Response Time',
        'description': 'All API endpoints shall respond within 200ms at the 95th percentile.',
        'status': 'approved', 'priority': 'high', 'level': '1.2',
        'createdBy': 'System Engineer', 'parentRequirementId': req_main_1['id'],
    })
    req_main_2 = create_requirement_db({
        'documentId': doc_main['id'],
        'title': 'System Availability',
        'description': 'The system shall maintain 99.9% uptime measured on a monthly basis.',
        'status': 'approved', 'priority': 'high', 'level': '2',
        'createdBy': 'System Engineer',
    })
    req_main_3 = create_requirement_db({
        'documentId': doc_main['id'],
        'title': 'Data Integrity',
        'description': 'The system shall ensure all data writes are atomic and recoverable after any failure mode.',
        'status': 'approved', 'priority': 'medium', 'level': '3',
        'createdBy': 'System Engineer',
    })

    for r in [req_main_1, req_main_1_1, req_main_1_2, req_main_2, req_main_3]:
        print(f"  {r['id']}: {r['title']}")

    # ---- Requirements for Test1 ----
    print("\nCreating requirements for Test1...")

    req1_1 = create_requirement_db({
        'documentId': doc1['id'],
        'title': 'Frontend Rendering Performance',
        'description': 'The frontend application shall render all interactive components within 100ms of receiving data.',
        'status': 'draft', 'priority': 'high', 'level': '1',
        'createdBy': 'Engineer A',
    })
    req1_1_1 = create_requirement_db({
        'documentId': doc1['id'],
        'title': 'Virtual DOM Diffing',
        'description': 'All list rendering shall use virtualized diffing to minimize DOM mutations.',
        'status': 'draft', 'priority': 'medium', 'level': '1.1',
        'createdBy': 'Engineer A', 'parentRequirementId': req1_1['id'],
    })
    req1_1_2 = create_requirement_db({
        'documentId': doc1['id'],
        'title': 'Memoization of Pure Components',
        'description': 'All pure functional components shall be wrapped in React.memo to prevent unnecessary re-renders.',
        'status': 'draft', 'priority': 'low', 'level': '1.2',
        'createdBy': 'Engineer A', 'parentRequirementId': req1_1['id'],
    })
    req1_2 = create_requirement_db({
        'documentId': doc1['id'],
        'title': 'Component Lazy Loading',
        'description': 'Components not in the initial viewport shall be lazy-loaded to achieve time-to-interactive under 2 seconds.',
        'status': 'draft', 'priority': 'medium', 'level': '2',
        'createdBy': 'Engineer A',
    })
    req1_3 = create_requirement_db({
        'documentId': doc1['id'],
        'title': 'State Management Efficiency',
        'description': 'State updates shall trigger no more than 2 re-renders per dispatched action.',
        'status': 'draft', 'priority': 'medium', 'level': '3',
        'createdBy': 'Engineer A',
    })

    for r in [req1_1, req1_1_1, req1_1_2, req1_2, req1_3]:
        print(f"  {r['id']}: {r['title']}")

    # ---- Requirements for Test2 ----
    print("\nCreating requirements for Test2...")

    req2_1 = create_requirement_db({
        'documentId': doc2['id'],
        'title': 'API Gateway Response Time',
        'description': 'The API gateway shall forward requests to backend services and return responses within 150ms.',
        'status': 'draft', 'priority': 'high', 'level': '1',
        'createdBy': 'Engineer B',
    })
    req2_1_1 = create_requirement_db({
        'documentId': doc2['id'],
        'title': 'Connection Pooling',
        'description': 'The API gateway shall maintain a connection pool with a minimum of 10 and maximum of 100 connections.',
        'status': 'draft', 'priority': 'medium', 'level': '1.1',
        'createdBy': 'Engineer B', 'parentRequirementId': req2_1['id'],
    })
    req2_2 = create_requirement_db({
        'documentId': doc2['id'],
        'title': 'Database Query Optimization',
        'description': 'All database queries shall execute within 50ms as measured by the query profiler.',
        'status': 'draft', 'priority': 'high', 'level': '2',
        'createdBy': 'Engineer B',
    })
    req2_3 = create_requirement_db({
        'documentId': doc2['id'],
        'title': 'Caching Strategy',
        'description': 'Frequently accessed data shall be cached with a TTL of 5 minutes, achieving a 90% cache hit rate.',
        'status': 'draft', 'priority': 'medium', 'level': '3',
        'createdBy': 'Engineer B',
    })
    req2_4 = create_requirement_db({
        'documentId': doc2['id'],
        'title': 'Write-Ahead Logging',
        'description': 'All data mutations shall be written to a write-ahead log before being applied to ensure recoverability.',
        'status': 'draft', 'priority': 'high', 'level': '4',
        'createdBy': 'Engineer B',
    })

    for r in [req2_1, req2_1_1, req2_2, req2_3, req2_4]:
        print(f"  {r['id']}: {r['title']}")

    # ---- Traceability Links ----
    print("\nCreating traceability links...")

    links = [
        # Test1 -> Test-main
        (req1_1,   req_main_1_1, 'implements', 'Frontend Rendering -> UI Response Time'),
        (req1_1_1, req_main_1_1, 'implements', 'Virtual DOM Diffing -> UI Response Time'),
        (req1_1_2, req_main_1_1, 'implements', 'Memoization -> UI Response Time'),
        (req1_2,   req_main_1_1, 'implements', 'Lazy Loading -> UI Response Time'),
        (req1_3,   req_main_1,   'satisfies',  'State Management -> System Performance'),

        # Test2 -> Test-main
        (req2_1,   req_main_1_2, 'implements', 'API Gateway -> API Response Time'),
        (req2_1_1, req_main_1_2, 'implements', 'Connection Pooling -> API Response Time'),
        (req2_2,   req_main_1_2, 'implements', 'DB Query Optimization -> API Response Time'),
        (req2_3,   req_main_1,   'satisfies',  'Caching Strategy -> System Performance'),
        (req2_4,   req_main_3,   'satisfies',  'Write-Ahead Logging -> Data Integrity'),
    ]

    for src, tgt, link_type, desc in links:
        create_traceability_link(src['id'], tgt['id'], doc_main['id'], link_type)
        print(f"  {desc} ({link_type})")

    print("\nSeed complete!")
    print("  3 documents, 15 requirements, 10 traceability links")
    print("  Test1 and Test2 both trace up to Test-main requirements")


if __name__ == '__main__':
    seed()
