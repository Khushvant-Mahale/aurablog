import http.server
import socketserver
import json
import os
import subprocess
import sys

PORT = 8000

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def send_cors_response(self, status, data):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_POST(self):
        if self.path == '/api/publish':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                data = json.loads(post_data.decode('utf-8'))
                slug = data.get('slug')
                html_content = data.get('html')
                
                if not slug or not html_content:
                    self.send_cors_response(400, {"status": "error", "message": "Missing slug or html"})
                    return
                
                # Write html page locally
                os.makedirs('posts', exist_ok=True)
                file_path = os.path.join('posts', f"{slug}.html")
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(html_content)
                
                # Auto git commit and push
                git_message = ""
                try:
                    # Stage
                    subprocess.run(['git', 'add', file_path], check=True, capture_output=True)
                    # Commit
                    subprocess.run(['git', 'commit', '-m', f"Auto-publish post: {slug}"], check=True, capture_output=True)
                    # Push
                    subprocess.run(['git', 'push', 'origin', 'main'], check=True, capture_output=True)
                    git_message = "and pushed to GitHub successfully!"
                except subprocess.CalledProcessError as e:
                    err_msg = e.stderr.decode('utf-8') if e.stderr else str(e)
                    git_message = f"locally, but git push skipped/failed: {err_msg.strip()}"
                
                self.send_cors_response(200, {
                    "status": "success",
                    "message": f"Published locally to posts/{slug}.html {git_message}"
                })
                
            except Exception as e:
                self.send_cors_response(500, {"status": "error", "message": str(e)})
        else:
            self.send_cors_response(404, {"status": "error", "message": "Endpoint not found"})

# Change working directory to the project root (parent of scripts directory) to serve files correctly
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(project_root)

# Configure socket option to allow address reuse (prevents Address already in use errors on restart)
socketserver.TCPServer.allow_reuse_address = True

with socketserver.TCPServer(("", PORT), CustomHandler) as httpd:
    print(f"=== AuraBlog Publishing Server running on http://localhost:{PORT} ===")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
        sys.exit(0)
