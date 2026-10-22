import io
import json
import unittest
from unittest.mock import patch
from app import Handler, CASE, CASES


class MemoryConnection:
    """Run the real HTTP parser and handler without binding a network port."""
    def __init__(self, request):
        self.reader = io.BytesIO(request)
        self.output = io.BytesIO()

    def makefile(self, *_): return self.reader

    def sendall(self, data): self.output.write(data)


class HTTPTests(unittest.TestCase):
    def test_config_exposes_boolean_not_secret(self):
        with patch.dict('os.environ', {'OPENAI_API_KEY': 'secret-test-value'}):
            conn = MemoryConnection(b'GET /api/config HTTP/1.0\r\nHost: 127.0.0.1:8765\r\n\r\n')
            Handler(conn, ('127.0.0.1', 1), None)
            response = conn.output.getvalue().split(b'\r\n\r\n', 1)[1]
            self.assertEqual(json.loads(response), {'ai_available': True})
            self.assertNotIn(b'secret-test-value', response)

    def post(self, body, origin=True):
        payload = json.dumps(body).encode()
        headers = 'POST /api/analyze HTTP/1.0\r\nHost: 127.0.0.1:8765\r\nContent-Type: application/json\r\n'
        if origin: headers += 'Origin: http://127.0.0.1:8765\r\n'
        request = (headers + f'Content-Length: {len(payload)}\r\n\r\n').encode() + payload
        conn = MemoryConnection(request)
        Handler(conn, ('127.0.0.1', 1), None)
        head, response = conn.output.getvalue().split(b'\r\n\r\n', 1)
        return int(head.split(b' ')[1]), json.loads(response)

    def test_demo_and_source_quotes(self):
        status, data = self.post({'mode':'demo','brief':CASE['brief'],'reply':CASE['reply']})
        self.assertEqual(status, 200); self.assertEqual(data['mode'], 'demo')

    def test_changed_demo_is_rejected(self):
        status, _ = self.post({'mode':'demo','brief':CASE['brief']+' New requirement.', 'reply':CASE['reply']})
        self.assertEqual(status, 400)

    def test_each_scenario_can_be_replayed(self):
        for case in CASES:
            with self.subTest(case=case['id']):
                status, data = self.post({'mode':'demo','case_id':case['id'],'brief':case['brief'],'reply':case['reply']})
                self.assertEqual(status, 200)
                self.assertEqual(data['case_id'], case['id'])

    def test_scenario_mismatch_cannot_replay_other_result(self):
        status, _ = self.post({'mode':'demo','case_id':'aligned','brief':CASE['brief'],'reply':CASE['reply']})
        self.assertEqual(status, 400)

    def test_invalid_scenario_identifier_is_rejected(self):
        for case_id in ('does-not-exist', [], None):
            with self.subTest(case_id=case_id):
                status, _ = self.post({'mode':'demo','case_id':case_id,'brief':CASE['brief'],'reply':CASE['reply']})
                self.assertEqual(status, 400)

    def test_static_assets_and_examples_are_served(self):
        for path, mime in (('/api/examples','application/json'), ('/core.js','text/javascript'), ('/assets/editorial.png','image/png')):
            with self.subTest(path=path):
                conn = MemoryConnection(f'GET {path} HTTP/1.0\r\nHost: 127.0.0.1:8765\r\n\r\n'.encode())
                Handler(conn, ('127.0.0.1', 1), None)
                head, body = conn.output.getvalue().split(b'\r\n\r\n', 1)
                self.assertEqual(int(head.split(b' ')[1]), 200)
                self.assertIn(mime.encode(), head)
                self.assertGreater(len(body), 0)

    def test_cross_origin_rejected(self):
        status, _ = self.post({}, origin=False)
        self.assertEqual(status, 403)

    def test_invalid_body_rejected(self):
        for body in ([], {'mode':'live','brief':'','reply':'short'}):
            with self.subTest(body=body): self.assertEqual(self.post(body)[0], 400)


if __name__ == '__main__': unittest.main()
