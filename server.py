import http.server
import socketserver
import os

PORT = 8080
DIRECTORY = "./public"

if not os.path.exists(DIRECTORY):
    os.makedirs(DIRECTORY)

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_PUT(self):
        filename = os.path.basename(self.path)
        file_path = os.path.join(DIRECTORY, filename)
        
        file_length = int(self.headers['Content-Length'])
        with open(file_path, 'wb') as output_file:
            output_file.write(self.rfile.read(file_length))
            
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b'{"status":"ok"}')

with socketserver.TCPServer(("0.0.0.0", PORT), CustomHandler) as httpd:
    print(f"PicoNote Mobil Sunucusu {PORT} portunda calisiyor...")
    httpd.serve_forever()
