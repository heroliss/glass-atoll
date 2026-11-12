"""No-cache static server for first-frame byte measurement.

/play/glass-atoll/<path>  -> <runtime root>/<path>
/measure.html             -> measure.html next to this script
/__log                    -> JSON request log (path, bytes, start/end ms)
/__mark?name=...          -> records a timestamped marker in the log
/__reset                  -> clears the log
No compression: body bytes equal file bytes.
"""
import http.server, json, sys, threading, time, urllib.parse
from pathlib import Path

ROOT = Path(sys.argv[1]).resolve()
PORT = int(sys.argv[2]) if len(sys.argv) > 2 else 8765
# Optional: /old/play/glass-atoll/<path> serves <overlay>/<path> when present
# (pre-change copies of edited files), else the same file from ROOT.
OVERLAY = Path(sys.argv[3]).resolve() if len(sys.argv) > 3 else None
HERE = Path(__file__).resolve().parent
LOG, LOCK, T0 = [], threading.Lock(), time.perf_counter()
TYPES = {'.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.json': 'application/json',
         '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.ogg': 'audio/ogg', '.wasm': 'application/wasm'}
now = lambda: round((time.perf_counter() - T0) * 1000, 1)

class H(http.server.BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'
    def log_message(self, *a): pass
    def send_json(self, obj):
        body = json.dumps(obj).encode()
        self.send_response(200); self.send_header('Content-Type', 'application/json'); self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store'); self.end_headers(); self.wfile.write(body)
    def do_GET(self):
        url = urllib.parse.urlsplit(self.path); path = urllib.parse.unquote(url.path)
        if path == '/__log': return self.send_json(LOG)
        if path == '/__reset':
            with LOCK: LOG.clear()
            return self.send_json({'ok': True})
        if path == '/__mark':
            name = urllib.parse.parse_qs(url.query).get('name', ['mark'])[0]
            with LOCK: LOG.append({'mark': name, 't': now()})
            return self.send_json({'ok': True})
        if path.count('/') == 1 and path.endswith('.html') and (HERE / path[1:]).is_file(): file = HERE / path[1:]
        elif OVERLAY and path.startswith('/old/play/glass-atoll/') and '/' not in path[len('/old/play/glass-atoll/'):] and (OVERLAY / path[len('/old/play/glass-atoll/'):]).is_file():
            file = OVERLAY / path[len('/old/play/glass-atoll/'):]
        elif OVERLAY and path.startswith('/old/play/glass-atoll/'):
            rel = path[len('/old/play/glass-atoll/'):] or 'index.html'
            file = (ROOT / rel).resolve()
            if ROOT not in file.parents and file != ROOT: return self.send_error(403)
        elif path.startswith('/play/glass-atoll/'):
            rel = path[len('/play/glass-atoll/'):] or 'index.html'
            file = (ROOT / rel).resolve()
            if ROOT not in file.parents and file != ROOT: return self.send_error(403)
            if file.is_dir(): file = file / 'index.html'
        else: return self.send_error(404)
        if not file.is_file(): return self.send_error(404)
        data = file.read_bytes(); start = now()
        self.send_response(200)
        self.send_header('Content-Type', TYPES.get(file.suffix.lower(), 'application/octet-stream'))
        self.send_header('Content-Length', str(len(data))); self.send_header('Cache-Control', 'no-store'); self.end_headers()
        sent = 0
        try:
            for i in range(0, len(data), 1 << 20):
                self.wfile.write(data[i:i + (1 << 20)]); sent = min(len(data), i + (1 << 20))
        finally:
            with LOCK: LOG.append({'path': path, 'bytes': sent, 'size': len(data), 'start': start, 'end': now()})

http.server.ThreadingHTTPServer(('127.0.0.1', PORT), H).serve_forever()
