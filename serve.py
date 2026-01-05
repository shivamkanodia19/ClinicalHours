#!/usr/bin/env python3
"""
Simple HTTP server to serve the Vite development build
Run this script: python3 serve.py
Then open http://localhost:8000 in your browser
"""
import http.server
import socketserver
import os
import sys

PORT = 8000

# Change to the dist directory (where built files are)
script_dir = os.path.dirname(os.path.abspath(__file__))
dist_dir = os.path.join(script_dir, 'dist')
if os.path.exists(dist_dir):
    os.chdir(dist_dir)
else:
    os.chdir(script_dir)

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Add CORS headers
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        # Set content type for common files
        if self.path.endswith('.js'):
            self.send_header('Content-Type', 'application/javascript')
        elif self.path.endswith('.css'):
            self.send_header('Content-Type', 'text/css')
        super().end_headers()

    def log_message(self, format, *args):
        # Suppress some log messages for cleaner output
        if not any(x in args[0] for x in ['favicon.ico', '.map']):
            super().log_message(format, *args)

if __name__ == "__main__":
    Handler = MyHTTPRequestHandler
    
    # Check if dist folder exists (production build)
    if os.path.exists('dist'):
        print(f"📦 Serving production build from 'dist' folder")
        print(f"🌐 Server running at http://localhost:{PORT}/")
        print(f"📂 Open http://localhost:{PORT} in your browser")
        print(f"\n⚠️  Note: This serves a static build. For development with hot reload,")
        print(f"   you'll need to run 'npm run dev' after installing Node.js")
    else:
        print(f"⚠️  No 'dist' folder found. Building the project first...")
        print(f"   Run 'npm run build' to create a production build, then run this script again.")
        print(f"\n   Or install Node.js and run 'npm run dev' for development mode.")
        sys.exit(1)
    
    try:
        with socketserver.TCPServer(("", PORT), Handler) as httpd:
            print(f"\n🛑 Press Ctrl+C to stop the server\n")
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n\n👋 Server stopped. Goodbye!")
    except OSError as e:
        if e.errno == 48:  # Address already in use
            print(f"\n❌ Port {PORT} is already in use. Try:")
            print(f"   python3 serve.py --port {PORT + 1}")
        else:
            print(f"\n❌ Error: {e}")

