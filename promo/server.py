# Serveur de capture : fichiers statiques + récepte les frames JPEG (POST /frame?i=N)
import http.server, os, urllib.parse, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRAMES = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'frames')
os.makedirs(FRAMES, exist_ok=True)

class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def do_POST(self):
        u = urllib.parse.urlparse(self.path)
        if u.path == '/frame':
            n = urllib.parse.parse_qs(u.query).get('i', ['0'])[0]
            ln = int(self.headers.get('Content-Length', 0))
            data = self.rfile.read(ln)
            with open(os.path.join(FRAMES, f'f_{int(n):04d}.jpg'), 'wb') as f:
                f.write(data)
            self.send_response(204); self.end_headers()
        else:
            self.send_response(404); self.end_headers()

    def log_message(self, *a): pass

http.server.ThreadingHTTPServer(('127.0.0.1', 8899), H).serve_forever()
