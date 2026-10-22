"""Local-only HTTP application; run with python3 app.py."""
import argparse
import json
import os
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from engine import AnalysisError, analyze, validate

ROOT = Path(__file__).resolve().parent
CASE = json.loads((ROOT / 'examples/case.json').read_text())
CASES = json.loads((ROOT / 'examples/cases.json').read_text())
CASES_BY_ID = {case['id']: case for case in CASES}
LOCK = threading.Lock()
MAX_BODY = 100_000


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass  # Do not log document content or request paths.

    def send(self, status, data, content_type='application/json; charset=utf-8'):
        payload = data if isinstance(data, bytes) else json.dumps(data).encode()
        self.send_response(status)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(payload)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; object-src 'none'; frame-ancestors 'none'")
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self):
        if self.path == '/api/config':
            self.send(200, {'ai_available': bool(os.environ.get('OPENAI_API_KEY', '').strip())})
            return
        if self.path == '/api/example':
            self.send(200, CASE)
            return
        if self.path == '/api/examples':
            self.send(200, CASES)
            return
        files = {'/': ('index.html', 'text/html; charset=utf-8'),
                 '/core.js': ('core.js', 'text/javascript; charset=utf-8'),
                 '/products.js': ('products.js', 'text/javascript; charset=utf-8'),
                 '/studio.js': ('studio.js', 'text/javascript; charset=utf-8'),
                 '/studio.css': ('studio.css', 'text/css; charset=utf-8'),
                 '/app.js': ('app.js', 'text/javascript; charset=utf-8'),
                 '/style.css': ('style.css', 'text/css; charset=utf-8'),
                 '/assets/editorial.png': ('assets/editorial.png', 'image/png')}
        if self.path not in files:
            self.send(404, {'error': 'Not found'})
            return
        name, mime = files[self.path]
        self.send(200, (ROOT / 'web' / name).read_bytes(), mime)

    def do_POST(self):
        if self.path != '/api/analyze':
            self.send(404, {'error': 'Not found'})
            return
        # Same-origin JSON requests only. No CORS, public binding or external assets.
        expected = f'http://{self.headers.get("Host", "")}'
        if self.headers.get('Origin') != expected or self.headers.get('Sec-Fetch-Site', 'same-origin') != 'same-origin':
            self.send(403, {'error': 'Same-origin requests required.'})
            return
        if self.headers.get('Content-Type', '').split(';')[0] != 'application/json':
            self.send(415, {'error': 'JSON required.'})
            return
        try:
            size = int(self.headers.get('Content-Length', '0'))
            if not 0 < size <= MAX_BODY:
                raise ValueError('Request must be between 1 and 100000 bytes.')
            data = json.loads(self.rfile.read(size))
            if not isinstance(data, dict):
                raise ValueError('JSON object required.')
            brief, reply = data.get('brief'), data.get('reply')
            if any(not isinstance(s, str) or not 10 <= len(s.strip()) <= 16000 for s in (brief, reply)):
                raise ValueError('Each document must contain 10–16000 characters.')
            mode = data.get('mode')
            if mode not in ('demo', 'live'):
                raise ValueError('Choose demo or live mode.')
            if mode == 'demo':
                case_id = data.get('case_id', 'field')
                if not isinstance(case_id, str):
                    raise ValueError('Scenario identifier must be a string.')
                case = CASES_BY_ID.get(case_id)
                if case is None or (brief, reply) != (case['brief'], case['reply']):
                    raise ValueError('Demo replays only the unchanged sample. Use live mode for your own documents.')
                self.send(200, {'mode': 'demo', 'case_id': case['id'], **validate(case['result'], brief, reply)})
                return
            if not LOCK.acquire(blocking=False):
                self.send(429, {'error': 'An analysis is already running. Please wait.'})
                return
            try:
                self.send(200, {'mode': 'live', **analyze(brief, reply)})
            finally:
                LOCK.release()
        except (ValueError, UnicodeError) as exc:
            self.send(400, {'error': str(exc)})
        except AnalysisError as exc:
            self.send(502, {'error': str(exc)})


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8765)
    args = parser.parse_args()
    server = ThreadingHTTPServer(('127.0.0.1', args.port), Handler)
    print(f'SupplyLens: http://127.0.0.1:{args.port} (Ctrl+C to stop)', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()
