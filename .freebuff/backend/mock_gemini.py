"""Local mock of the Google Gemini generateContent API for provider-path testing."""
import json
from http.server import BaseHTTPRequestHandler, HTTPServer


class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length))
        # Echo the question context back so we can assert it arrived
        sys_text = "".join(p.get("text", "") for p in body.get("systemInstruction", {}).get("parts", []))
        user_text = "".join(
            p.get("text", "") for c in body.get("contents", []) if c.get("role") == "user" for p in c.get("parts", [])
        )
        payload = {
            "candidates": [
                {
                    "content": {
                        "parts": [
                            {"text": f"[GEMINI-MOCK] system={'yes' if 'Scheme Up' in sys_text else 'NO'} | user={user_text[:80]}"}
                        ]
                    }
                }
            ]
        }
        data = json.dumps(payload).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    HTTPServer(("127.0.0.1", 9102), Handler).serve_forever()
