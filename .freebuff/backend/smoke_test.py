"""End-to-end API smoke test for the Scheme Up backend.

Usage: python smoke_test.py [base_url]
"""
import json
import sys
import urllib.request

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8001"
TOKEN = None
FAILURES = []


def call(method, path, payload=None, auth=False):
    global TOKEN
    url = BASE + path
    body = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(url, data=body, method=method)
    req.add_header("Content-Type", "application/json")
    if auth and TOKEN:
        req.add_header("Authorization", f"Bearer {TOKEN}")
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode() or "null")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode() or "null")


def check(name, status, expected, body=None):
    ok = status == expected
    print(f"{'PASS' if ok else 'FAIL'} {name}: {status} (expected {expected})")
    if not ok:
        FAILURES.append(name)
        print("   body:", json.dumps(body)[:300])
    return ok


# public
s, b = call("GET", "/api/health"); check("health", s, 200, b)
s, b = call("GET", "/api/public/stats"); check("public/stats", s, 200, b)
s, b = call("GET", "/api/public/config"); check("public/config", s, 200, b)
s, b = call("GET", "/api/schemes"); check("schemes list", s, 200, b)
schemes = b if isinstance(b, list) else []
print(f"   -> {len(schemes)} schemes")
ACTIVE_ID = schemes[0]["id"] if schemes else 1
s, b = call("GET", f"/api/schemes/{ACTIVE_ID}"); check("scheme detail", s, 200, b)
s, b = call("GET", "/api/schemes/99999"); check("scheme 404", s, 404, b)
s, b = call("GET", "/api/partners"); check("partners list", s, 200, b)
s, b = call("POST", "/api/partners/recommend", {"state": "Gujarat", "district": "Ahmedabad", "scheme_id": 1})
check("partners recommend", s, 200, b)
s, b = call("GET", "/api/partners/nearby?latitude=23.02&longitude=72.57&radius_km=100"); check("partners nearby", s, 200, b)
s, b = call("GET", "/api/partners/nearby"); check("partners nearby missing coords 422", s, 422, b)

# calculator
s, b = call("POST", "/api/calculator/emi", {"project_cost": 1000000, "loan_amount": 900000, "interest_rate": 9, "tenure_months": 60, "moratorium_months": 6})
check("calculator emi", s, 200, b)
if s == 200:
    print(f"   -> EMI={b.get('emi')}")
s, b = call("POST", "/api/calculator/emi", {"project_cost": 100, "loan_amount": 0, "interest_rate": 9, "tenure_months": 60})
check("calculator invalid loan 422", s, 422, b)
s, b = call("POST", "/api/calculator/scheme", {"scheme_id": ACTIVE_ID, "project_cost": 500000})
check("calculator scheme", s, 200, b)

# recommendations (guest)
s, b = call("POST", "/api/recommendations", {
    "income": 350000, "project_cost": 1000000, "purpose": "start_business",
    "required_loan": 900000, "own_contribution": 100000, "category": "SC",
    "location": {"state": "Gujarat", "district": "Ahmedabad"},
})
check("recommendation guest", s, 200, b)
if s == 200:
    print(f"   -> recommended: {(b.get('recommended_scheme') or {}).get('scheme_name')} score={b.get('eligibility_score')}")
    print(f"   -> explanation items: {len(b.get('explanation') or [])}, next_steps: {len(b.get('next_steps') or [])}")

# auth
import random
email = f"smoke{random.randint(1000,9999)}@test.demo"
s, b = call("POST", "/api/auth/register", {"full_name": "Smoke Tester", "mobile": "9" + str(random.randint(100000000, 999999999)), "email": email, "password": "Test@12345", "user_type": "entrepreneur", "state": "Gujarat", "district": "Ahmedabad"})
check("register", s, 200, b)
if s == 200:
    TOKEN = b.get("access_token")
s, b = call("POST", "/api/auth/login", {"identifier": email, "password": "Test@12345"})
check("login", s, 200, b)
TOKEN = b.get("access_token") if s == 200 else TOKEN
s, b = call("POST", "/api/auth/login", {"identifier": email, "password": "wrong"})
check("login wrong password 401", s, 401, b)
s, b = call("GET", "/api/auth/me", auth=True)
check("auth/me", s, 200, b)
s, b = call("GET", "/api/auth/me")
check("auth/me no token 401", s, 401, b)

# users
s, b = call("PUT", "/api/users/me", {"age": 30, "annual_income": 400000}, auth=True)
check("users/me update", s, 200, b)
s, b = call("GET", "/api/users/me/saved-schemes", auth=True)
check("saved schemes empty", s, 200, b)
s, b = call("POST", "/api/users/me/saved-schemes/1", auth=True)
check("save scheme", s, 200, b)
s, b = call("GET", "/api/users/me/saved-schemes", auth=True)
check("saved schemes 1", s, 200, b)
if s == 200:
    print(f"   -> saved list has {len(b)} scheme(s)")
s, b = call("DELETE", "/api/users/me/saved-schemes/1", auth=True)
check("unsave scheme", s, 200, b)

# recommendation as user + latest
s, b = call("POST", "/api/recommendations", {"income": 300000, "project_cost": 400000, "purpose": "education", "education_type": "engineering", "location": {"state": "Gujarat", "district": "Ahmedabad"}}, auth=True)
check("recommendation user education", s, 200, b)
s, b = call("GET", "/api/recommendations/me/latest", auth=True)
check("recommendation latest", s, 200, b)

# applications
s, b = call("POST", "/api/applications", {"scheme_id": 1, "applicant_info": {"full_name": "Smoke"}, "financial_info": {"project_cost": 500000}, "documents": [{"name": "identity_proof", "label": "ID", "provided": True}]}, auth=True)
check("create application", s, 200, b)
app_id = b.get("id") if isinstance(b, dict) else None
s, b = call("GET", "/api/applications", auth=True)
check("list applications", s, 200, b)
if app_id:
    s, b = call("PATCH", f"/api/applications/{app_id}/status", {"status": "submitted"}, auth=True)
    check("update application status", s, 200, b)
    s, b = call("PATCH", f"/api/applications/{app_id}/status", {"status": "bogus"}, auth=True)
    check("invalid status 422", s, 422, b)

# dashboard
s, b = call("GET", "/api/dashboard", auth=True)
check("dashboard", s, 200, b)

# admin protection
s, b = call("GET", "/api/admin/analytics", auth=True)
check("admin analytics as non-admin 403", s, 403, b)
s, b = call("POST", "/api/admin/schemes", {"scheme_name": "Hack", "maximum_loan": 100}, auth=True)
check("admin create scheme as non-admin 403", s, 403, b)

# admin login (demo admin account)
s, b = call("POST", "/api/auth/login", {"identifier": "admin@saksham.demo", "password": "Admin@12345"})
check("admin login", s, 200, b)
if s == 200:
    TOKEN = b.get("access_token")
    s, b = call("GET", "/api/admin/analytics", auth=True)
    check("admin analytics", s, 200, b)
    s, b = call("GET", "/api/admin/audit-logs", auth=True)
    check("admin audit logs", s, 200, b)
    s, b = call("GET", "/api/admin/config", auth=True)
    check("admin config", s, 200, b)
    # A real create/delete to prove admin write paths work
    s, b = call("POST", "/api/admin/schemes", {"scheme_name": "Smoke Test Scheme", "maximum_loan": 123456, "interest_rate": 5.0, "margin_percentage": 10, "moratorium_months": 0, "maximum_tenure_months": 60}, auth=True)
    check("admin create scheme", s, 200, b)
    if s == 200:
        tmp_id = b.get("id")
        s, b = call("DELETE", f"/api/admin/schemes/{tmp_id}", auth=True)
        check("admin delete scheme", s, 200, b)

# ------------------------------------------------------------------ assistant
s, b = call("GET", "/api/assistant/status")
check("assistant status", s, 200, b)
print(f"   -> AI provider: {b.get('provider')} (enabled={b.get('enabled')})")
s, b = call("POST", "/api/assistant/chat", {"message": "What schemes can I apply for?"})
check("assistant chat (guest)", s, 200, b)
if s == 200:
    print(f"   -> reply: {b.get('reply')[:100]}...")
    print(f"   -> suggestions: {b.get('suggestions')}")
s, b = call("POST", "/api/assistant/chat", {"message": "Tell me about MUDRA loans"})
check("assistant chat scheme search", s, 200, b)
if s == 200 and b.get("topic"):
    print(f"   -> topic: {b.get('topic')}, context: {b.get('context_keys')}")
s, b = call("POST", "/api/assistant/chat", {"message": "How do I find a Channel Partner near me?"})
check("assistant chat partners", s, 200, b)
s, b = call("POST", "/api/assistant/chat", {"message": "What is the capital of France?"})
check("assistant chat off-topic guard", s, 200, b)
if s == 200:
    print(f"   -> topic: {b.get('topic')}")
s, b = call("POST", "/api/assistant/chat", {"message": ""})
check("assistant chat empty 422", s, 422, b)
s, b = call("POST", "/api/assistant/chat", {"message": "Tell me my saved schemes", "history": [{"role": "user", "content": "hi"}]}, auth=True)
check("assistant chat with user context", s, 200, b)
if s == 200:
    print(f"   -> context keys: {b.get('context_keys')}")

# ------------------------------------------------------------------ admin: users & system
if TOKEN:
    s, b = call("GET", "/api/admin/users?limit=5", auth=True)
    check("admin users list", s, 200, b)
    if s == 200:
        print(f"   -> {b.get('total')} users total")
        rows = b.get("users") or []
        if rows:
            need = {"is_active", "recommendations", "applications", "chat_messages", "created_at"}
            print(f"   -> row fields ok: {need.issubset(rows[0])}")
    s, b = call("GET", "/api/admin/users?search=zzz_no_one_zzz", auth=True)
    check("admin users search no match", s, 200, b)
    if s == 200:
        print(f"   -> filtered total: {b.get('total')}")
    s, b = call("GET", "/api/admin/system", auth=True)
    check("admin system overview", s, 200, b)
    if s == 200:
        print(f"   -> users={b['users']['total']} growth_weeks={len(b['users']['growth'])} "
              f"chats={b['ai']['total_chats']} db={b['database']['dialect']}")
    # find a non-admin non-self target and toggle status (revert immediately)
    s, b = call("GET", "/api/admin/users?role=applicant&limit=10", auth=True)
    if s == 200:
        target = next((u for u in b.get("users") or [] if u["email"] != "admin@saksham.demo"), None)
        if target:
            s2, r = call("PATCH", f"/api/admin/users/{target['id']}/status", {"is_active": False}, auth=True)
            check("admin deactivate user", s2, 200, r)
            s3, r3 = call("PATCH", f"/api/admin/users/{target['id']}/status", {"is_active": True}, auth=True)
            check("admin reactivate user", s3, 200, r3)
    s, b = call("PATCH", "/api/admin/users/99999/status", {"is_active": False}, auth=True)
    check("admin status unknown user 404", s, 404, b)
    s, b = call("PATCH", "/api/admin/users/1/status", {"is_active": "yes"}, auth=True)
    check("admin status invalid body 422", s, 422, b)

print()
if FAILURES:
    print(f"FAILED ({len(FAILURES)}): {FAILURES}")
    sys.exit(1)
print("ALL PASS")
