"""Scheme Up Assistant – platform-aware chatbot service.

Architecture:
  User question -> relevance guard -> retrieval (schemes / partners / how-to /
  user context) -> provider-agnostic LLM call -> validated reply.

The assistant answers from real database content whenever the question is
platform-related. Credentials live in server-side environment variables and
are never exposed to the frontend.

Providers (set via AI_PROVIDER + AI_API_KEY in .env):
  openai     - OpenAI or any OpenAI-compatible endpoint (Groq, OpenRouter...)
  anthropic  - Anthropic Claude
  gemini     - Google Gemini
  none       - assistant disabled (default); the API reports a clear message

Without a key the platform still works: the assistant falls back to a
deterministic, database-backed answer builder so users always get real help.
"""

import json
import logging
import re
import urllib.error
import urllib.request
from dataclasses import dataclass, field

from sqlalchemy.orm import Session

from config import settings
from models.activity import Application, ChatLog, Recommendation, SavedScheme
from models.scheme import Partner, Scheme
from models.user import User
from services.config_service import get_config
from services.emi_calculator import emi_breakdown

logger = logging.getLogger("schemeup.assistant")

SYSTEM_PROMPT = """You are the Scheme Up Assistant, the built-in helper of "Scheme Up", a government scheme-matching \
platform for marginalized entrepreneurs and students in India.

Your job:
- Help users find government-backed financial schemes, understand eligibility, and use this platform.
- Answer using ONLY the "Platform context" below when it is relevant. Never invent scheme names, \
loan limits, interest rates or deadlines.
- Recommend concrete next steps on the platform (Find My Scheme flow, EMI Calculator, Channel \
Partners page, Dashboard, starting an application).
- Stay on topic: schemes, financing, eligibility, platform usage, and the user's own saved data. \
Politely decline anything else (general chit-chat, coding help, unrelated advice) in one sentence.
- Never claim to approve loans or guarantee eligibility: final approval rests with the authorized \
implementing agency or Channel Partner.
- Be warm, practical and concise: at most ~150 words unless the user asks for details.
- Reply in the language of the user's question (English, Hindi, Gujarati etc. all supported).
- You may format sparingly with short lines or dashes; no markdown tables or headings.
"""


# ---------------------------------------------------------------- dataclasses
@dataclass
class AssistantResult:
    reply: str
    provider: str
    used_llm: bool
    topic: str = "general"
    context_keys: list = field(default_factory=list)
    suggestions: list = field(default_factory=list)


# ------------------------------------------------------------- keyword guards
_PLATFORM_WORDS = {
    "scheme",
    "schemes",
    "yojana",
    "loan",
    "loans",
    "subsidy",
    "eligib",
    "grant",
    "finance",
    "financing",
    "funding",
    "emi",
    "interest",
    "tenure",
    "moratorium",
    "partner",
    "partners",
    "bank",
    "apply",
    "application",
    "document",
    "documents",
    "kyc",
    "mudra",
    "stand up",
    "standup",
    "pmegp",
    "nbcfdc",
    "nsfdc",
    "nstfdc",
    "business",
    "startup",
    "entrepreneur",
    "education",
    "scholarship",
    "student",
    "micro",
    "credit",
    "collateral",
    "guarantee",
    "income",
    "category",
    "sc",
    "st",
    "obc",
    "minority",
    "women",
    "saksham",
    "scheme up",
    "schemeup",
    "platform",
    "recommend",
    "calculator",
    "dashboard",
    "saved",
    "profile",
}
_ABUSIVE_HINTS = (
    "ignore previous",
    "system prompt",
    "reveal your",
    "api key",
    "token of",
)


def looks_on_topic(message: str) -> bool:
    text = message.lower()
    return any(word in text for word in _PLATFORM_WORDS) and not any(
        h in text for h in _ABUSIVE_HINTS
    )


# ------------------------------------------------------------------ retrieval
def _fmt_inr(value) -> str:
    try:
        return f"₹{float(value):,.0f}"
    except (TypeError, ValueError):
        return "—"


def _scheme_line(scheme: Scheme) -> str:
    income = (
        f", income up to {_fmt_inr(scheme.max_income)}" if scheme.max_income else ""
    )
    return (
        f"- {scheme.scheme_name} (by {scheme.sponsoring_body}): loans up to {_fmt_inr(scheme.maximum_loan)}, "
        f"interest from {scheme.interest_rate}%, tenure up to {scheme.maximum_tenure_months} months"
        f"{income}; purposes: {', '.join(scheme.eligible_purposes or []) or 'various'}"
    )


def _search_schemes(db: Session, message: str, limit: int = 5) -> list[Scheme]:
    """Keyword search over the canonical catalogue; falls back to top schemes."""
    text = message.lower()
    q = db.query(Scheme).filter(Scheme.active.is_(True))
    schemes = q.all()

    words = [
        w
        for w in re.findall(r"[a-z]{3,}", text)
        if w not in {"the", "and", "for", "any", "with", "have", "there"}
    ]
    scored = []
    for s in schemes:
        hay = " ".join(
            filter(
                None,
                [
                    s.scheme_name or "",
                    s.category or "",
                    s.description or "",
                    " ".join(s.eligible_purposes or []),
                    " ".join(s.target_categories or []),
                    s.sponsoring_body or "",
                ],
            ),
        ).lower()
        score = sum(1 for w in words if w in hay)
        if s.category and s.category in text:
            score += 2
        if any(cat.lower() in text for cat in (s.target_categories or [])):
            score += 3
        scored.append((score, s))
    scored.sort(key=lambda pair: -pair[0])
    results = [s for score, s in scored if score > 0][:limit]
    if not results:
        results = q.order_by(Scheme.maximum_loan.desc()).limit(limit).all()
    return results


def _search_partners(
    db: Session, message: str, user: User | None, limit: int = 4
) -> list[Partner]:
    text = message.lower()
    q = db.query(Partner).filter(
        Partner.is_active.is_(True), Partner.processing_status != "paused"
    )
    partners = q.all()
    words = re.findall(r"[a-z]{3,}", text)
    scored = []
    for p in partners:
        hay = f"{p.name} {p.state} {p.district} {p.city} {p.partner_type}".lower()
        score = sum(1 for w in words if w in hay)
        if user and user.state and p.state == user.state:
            score += 2
        scored.append((score, p))
    scored.sort(key=lambda pair: -pair[0])
    results = [p for score, p in scored if score > 0][:limit]
    if not results and user and user.state:
        results = [p for p in partners if p.state == user.state][:limit]
    return results or partners[:limit]


def _build_context(
    db: Session, message: str, user: User | None
) -> tuple[str, str, list[str]]:
    """Retrieve only the data relevant to the question. Returns (context, topic, keys)."""
    text = message.lower()
    keys: list[str] = []
    topic = "general"
    blocks: list[str] = []

    wants_schemes = any(
        w in text
        for w in (
            "scheme",
            "yojana",
            "loan",
            "subsidy",
            "eligib",
            "grant",
            "mudra",
            "pmegp",
            "business",
            "education",
            "financ",
            "recommend",
        )
    )
    wants_partners = any(
        w in text
        for w in ("partner", "bank", "branch", "near", "office", "contact", "where")
    )
    wants_howto = any(
        w in text
        for w in (
            "how",
            "start",
            "apply",
            "use",
            "platform",
            "document",
            "steps",
            "begin",
            "dashboard",
            "calculator",
            "emi",
        )
    )
    wants_profile = user is not None and any(
        w in text
        for w in (
            "my ",
            "saved",
            "recommend",
            "application",
            "profile",
            "dashboard",
            "status",
        )
    )

    if wants_profile and user:
        topic = "user_data"
        keys.append("user")
        profile = (
            f"User: {user.full_name}; role: {user.role}; category: {user.category or 'not set'}; "
            f"location: {user.district or '—'}, {user.state or '—'}; annual income: "
            f"{_fmt_inr(user.annual_income) if user.annual_income else 'not set'}."
        )
        last_rec = (
            db.query(Recommendation)
            .filter(Recommendation.user_id == user.id)
            .order_by(Recommendation.created_at.desc())
            .first()
        )
        if last_rec and last_rec.recommended_scheme_id:
            scheme = db.get(Scheme, last_rec.recommended_scheme_id)
            if scheme:
                profile += f" Their latest recommended scheme is '{scheme.scheme_name}' with a {last_rec.eligibility_score:.0f}% eligibility score."
                keys.append("latest_recommendation")
        apps = (
            db.query(Application)
            .filter(Application.user_id == user.id)
            .order_by(Application.created_at.desc())
            .limit(3)
            .all()
        )
        if apps:
            status_list = ", ".join(
                f"{a.scheme.scheme_name} ({a.status})"
                if a.scheme
                else f"#{a.id} ({a.status})"
                for a in apps
            )
            profile += f" Their recent applications: {status_list}."
            keys.append("applications")
        saved = (
            db.query(SavedScheme).filter(SavedScheme.user_id == user.id).limit(5).all()
        )
        if saved:
            names = [
                db.get(Scheme, s.scheme_id).scheme_name
                for s in saved
                if db.get(Scheme, s.scheme_id)
            ]
            if names:
                profile += f" Saved schemes: {', '.join(names)}."
                keys.append("saved_schemes")
        blocks.append("[User's own data]\n" + profile)

    if wants_schemes:
        topic = topic if topic != "general" else "schemes"
        keys.append("schemes")
        schemes = _search_schemes(db, message)
        lines = "\n".join(_scheme_line(s) for s in schemes)
        blocks.append(f"[Relevant schemes from the live catalogue]\n{lines}")

    if wants_partners:
        topic = topic if topic != "general" else "partners"
        keys.append("partners")
        partners = _search_partners(db, message, user)
        lines = "\n".join(
            f"- {p.name} ({p.partner_type}) in {p.city or p.district}, {p.state} — {p.processing_label if hasattr(p, 'processing_label') else p.processing_status}"
            for p in partners
        )
        blocks.append(f"[Channel Partners that may help]\n{lines}")

    if wants_howto:
        topic = topic if topic != "general" else "how_to"
        keys.append("platform_howto")
        blocks.append(
            "[How the platform works]\n"
            "1. 'Find My Scheme' (onboarding): user answers a few questions and the engine recommends a scheme with an eligibility score and explanations.\n"
            "2. 'EMI Calculator': estimates EMI, total interest and repayment for a custom loan or a specific scheme.\n"
            "3. 'Channel Partners': ranked list of authorized SCAs, banks, RRBs and NBFC-MFIs near the user.\n"
            "4. 'Start Application': guided flow (scheme → applicant info → financial info → documents → partner → submit); status is tracked on the Dashboard.\n"
            "5. Dashboard: shows the latest recommendation, saved schemes, applications and a recommended partner.\n"
            "Documents usually required: identity proof, address proof, income certificate, project/business documents, bank details (education loans need admission proof and fee structure)."
        )

    if not blocks:
        blocks.append(
            "[Platform overview]\n"
            "Scheme Up matches marginalized entrepreneurs and students with government-backed financial schemes. "
            "Features: AI scheme matching with explainable eligibility scores, EMI calculator, Channel Partner locator, "
            "guided applications and progress tracking. The catalogue currently holds "
            f"{db.query(Scheme).filter(Scheme.active.is_(True)).count()} active schemes."
        )

    impact = get_config(db, "impact_stats") or {}
    weights = get_config(db, "recommendation_weights") or {}
    if weights:
        keys.append("engine_weights")
        blocks.append(
            "[Recommendation engine factors]\n"
            + ", ".join(f"{k}: {v}" for k, v in weights.items())
        )
    context = "\n\n".join(blocks)
    if impact.get("ai_matching") == "true":
        context += "\n\n(The platform labels this as demo data; final eligibility is decided by the implementing agency.)"
    return context, topic, keys


# ------------------------------------------------------------- LLM providers
def _post_json(url: str, payload: dict, headers: dict, timeout: int) -> dict:
    req = urllib.request.Request(
        url, data=json.dumps(payload).encode("utf-8"), method="POST"
    )
    for k, v in headers.items():
        req.add_header(k, v)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _call_openai_compatible(system: str, history: list[dict], context: str) -> str:
    model = settings.ai_model or "gpt-4o-mini"
    url = (settings.ai_base_url or "https://api.openai.com/v1").rstrip(
        "/"
    ) + "/chat/completions"
    messages = (
        [{"role": "system", "content": system}]
        + history
        + [
            {
                "role": "system",
                "content": f"Platform context (use this, do not invent data):\n{context}",
            },
        ]
    )
    data = _post_json(
        url,
        {
            "model": model,
            "messages": messages,
            "max_tokens": settings.ai_max_output_tokens,
            "temperature": 0.4,
        },
        {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {settings.ai_api_key}",
        },
        settings.ai_timeout_seconds,
    )
    return data["choices"][0]["message"]["content"].strip()


def _call_anthropic(system: str, history: list[dict], context: str) -> str:
    model = settings.ai_model or "claude-3-5-haiku-latest"
    url = (settings.ai_base_url or "https://api.anthropic.com/v1").rstrip(
        "/"
    ) + "/messages"
    data = _post_json(
        url,
        {
            "model": model,
            "max_tokens": settings.ai_max_output_tokens,
            "system": f"{system}\n\nPlatform context (use this, do not invent data):\n{context}",
            "messages": history,
        },
        {
            "Content-Type": "application/json",
            "x-api-key": settings.ai_api_key,
            "anthropic-version": "2023-06-01",
        },
        settings.ai_timeout_seconds,
    )
    return "".join(block.get("text", "") for block in data.get("content", [])).strip()


def _call_gemini(system: str, history: list[dict], context: str) -> str:
    model = settings.ai_model or "gemini-3.6-flash"
    url = (
        settings.ai_base_url or "https://generativelanguage.googleapis.com/v1beta"
    ).rstrip("/") + f"/models/{model}:generateContent?key={settings.ai_api_key}"
    contents = []
    for m in history:
        role = "user" if m["role"] == "user" else "model"
        contents.append({"role": role, "parts": [{"text": m["content"]}]})
    data = _post_json(
        url,
        {
            "contents": contents,
            "systemInstruction": {
                "parts": [{"text": f"{system}\n\nPlatform context:\n{context}"}]
            },
            "generationConfig": {
                "maxOutputTokens": settings.ai_max_output_tokens,
                "temperature": 0.4,
            },
        },
        {"Content-Type": "application/json"},
        settings.ai_timeout_seconds,
    )
    candidates = data.get("candidates") or []
    parts = (candidates[0].get("content") or {}).get("parts") or []
    return "".join(p.get("text", "") for p in parts).strip()


_CALLERS = {
    "openai": _call_openai_compatible,
    "anthropic": _call_anthropic,
    "gemini": _call_gemini,
}


# --------------------------------------------------------- deterministic mode
def _fallback_reply(
    message: str, db: Session, user: User | None, context: str, topic: str
) -> str:
    """Rule-based answer when no AI provider is configured. Always data-backed."""
    text = message.lower()
    parts: list[str] = []

    if topic == "schemes" or "scheme" in text or "loan" in text:
        schemes = _search_schemes(db, message)
        if schemes:
            names = "; ".join(
                f"{s.scheme_name} (up to {_fmt_inr(s.maximum_loan)} at {s.interest_rate}%)"
                for s in schemes[:3]
            )
            parts.append(
                f"Based on the live catalogue, these schemes may fit: {names}."
            )
            parts.append(
                "Use 'Find My Scheme' to get a personalized recommendation with an eligibility score and clear explanations."
            )
    if topic == "partners" or "partner" in text or "bank" in text:
        partners = _search_partners(db, message, user)
        if partners:
            names = "; ".join(
                f"{p.name} ({p.city or p.district}, {p.state})" for p in partners[:3]
            )
            parts.append(
                f"Channel Partners you could approach: {names}. The 'Channel Partners' page shows the full ranked list with fund health."
            )
    if "emi" in text or "calculator" in text or "interest" in text:
        parts.append(
            "The 'EMI Calculator' estimates your monthly repayment, total interest and total repayment — pick a scheme to apply its configured rates automatically."
        )
    if "document" in text:
        parts.append(
            "Typical documents: identity proof, address proof, income certificate, project/business documents and bank details. Education loans also need an admission letter and fee structure."
        )
    if topic == "user_data" and user:
        parts.append(
            "Your Dashboard shows your latest recommendation, saved schemes, applications and a suggested partner near you."
        )
    if not parts:
        parts.append(
            "I can help you find a scheme, check EMI estimates, locate a Channel Partner, or guide you through an application."
        )
        parts.append(
            "Try 'Find My Scheme' to tell us about your need — the engine will match and explain the best options."
        )

    parts.append(
        "Note: final eligibility is determined by the authorized implementing agency."
    )
    return " ".join(parts)


# ------------------------------------------------------------------- facade
class AssistantError(Exception):
    def __init__(self, message: str, status: int = 502):
        super().__init__(message)
        self.status = status


def _log_usage(
    db: Session,
    *,
    user_id: int | None,
    provider: str,
    topic: str,
    used_llm: bool,
    success: bool,
    latency_ms: int,
    message_chars: int,
    reply_chars: int,
    context_keys: list,
) -> None:
    """Persist anonymized usage metadata. Best-effort: never break the chat."""
    try:
        db.add(
            ChatLog(
                user_id=user_id,
                provider=provider[:20],
                topic=topic[:30],
                used_llm=used_llm,
                success=success,
                latency_ms=max(0, int(latency_ms)),
                message_chars=max(0, int(message_chars)),
                reply_chars=max(0, int(reply_chars)),
                context_keys=context_keys or [],
            )
        )
        db.commit()
    except Exception:  # noqa: BLE001 - telemetry must never break chat
        db.rollback()
        logger.warning("Failed to record chat usage metadata", exc_info=True)


def generate_reply(
    db: Session,
    message: str,
    history: list[dict] | None = None,
    user: User | None = None,
) -> dict:
    """Main entry point. Returns a dict for the API response."""
    import time as _time

    started = _time.monotonic()
    message = (message or "").strip()
    if not message:
        raise AssistantError("Message cannot be empty.", status=422)
    if len(message) > 1000:
        message = message[:1000]

    history = [
        {
            "role": "assistant" if h.get("role") == "assistant" else "user",
            "content": str(h.get("content", ""))[:1000],
        }
        for h in (history or [])[-8:]
        if h.get("content")
    ]
    # The current question must reach the LLM even when history is empty
    # (providers only receive prior turns otherwise).
    if (
        not history
        or history[-1]["role"] != "user"
        or history[-1]["content"].strip().lower() != message.lower()
    ):
        history.append({"role": "user", "content": message})

    if not looks_on_topic(message):
        reply = "I'm the Scheme Up Assistant — I can help with government schemes, eligibility, EMI estimates, Channel Partners and using this platform. What would you like to explore?"
        _log_usage(
            db,
            user_id=user.id if user else None,
            provider="guard",
            topic="off_topic",
            used_llm=False,
            success=True,
            latency_ms=int((_time.monotonic() - started) * 1000),
            message_chars=len(message),
            reply_chars=len(reply),
            context_keys=[],
        )
        return {
            "reply": reply,
            "provider": "guard",
            "used_llm": False,
            "topic": "off_topic",
            "suggestions": [
                "What schemes can I apply for?",
                "How do I find a Channel Partner?",
                "How does the EMI calculator work?",
            ],
        }

    context, topic, keys = _build_context(db, message, user)
    provider = (settings.ai_provider or "none").lower()
    llm_active = bool(provider in _CALLERS and settings.ai_api_key)
    reply = None

    def _log_failed_attempt(status_code: int) -> None:
        """Record the failed LLM attempt so admin telemetry reflects real failures."""
        _log_usage(
            db,
            user_id=user.id if user else None,
            provider=provider,
            topic=topic,
            used_llm=True,
            success=False,
            latency_ms=int((_time.monotonic() - started) * 1000),
            message_chars=len(message),
            reply_chars=0,
            context_keys=keys,
        )
        logger.info("Assistant failure recorded (status=%s, provider=%s)", status_code, provider)

    if llm_active:
        system = SYSTEM_PROMPT + (
            f"\nThe user's name is {user.full_name}."
            if user
            else "\nThe user is browsing as a guest."
        )
        caller = _CALLERS[provider]
        try:
            reply = caller(system, history, context)
        except urllib.error.HTTPError as exc:
            if exc.code == 429:
                _log_failed_attempt(exc.code)
                raise AssistantError(
                    "The AI service is busy right now. Please try again in a few seconds.",
                    status=429,
                ) from exc
            if exc.code in (401, 403):
                logger.error("AI provider rejected credentials (%s)", exc.code)
                _log_failed_attempt(exc.code)
                raise AssistantError(
                    "The assistant is temporarily unavailable. Please try again later.",
                    status=502,
                ) from exc
            logger.warning("AI provider HTTP error %s", exc.code)
            _log_failed_attempt(exc.code)
            raise AssistantError(
                "The assistant could not complete your request. Please try again.",
                status=502,
            ) from exc
        except urllib.error.URLError as exc:
            logger.warning("AI provider unreachable: %s", exc.reason)
            _log_failed_attempt(0)
            raise AssistantError(
                "The assistant service is unreachable. Please check back shortly.",
                status=502,
            ) from exc
        except (KeyError, IndexError, ValueError) as exc:
            logger.warning("AI provider returned an unexpected response: %s", exc)
            _log_failed_attempt(0)
            raise AssistantError(
                "The assistant returned an invalid response. Please try again.",
                status=502,
            ) from exc
        except Exception as exc:  # noqa: BLE001 - surface a friendly message, log the cause
            logger.warning("AI provider call failed: %s", exc)
            _log_failed_attempt(0)
            raise AssistantError(
                "The assistant could not complete your request. Please try again.",
                status=502,
            ) from exc
        if not reply:
            _log_failed_attempt(0)
            raise AssistantError(
                "The assistant returned an empty response. Please try again.",
                status=502,
            )
    else:
        reply = _fallback_reply(message, db, user, context, topic)

    _log_usage(
        db,
        user_id=user.id if user else None,
        provider=provider if llm_active else "fallback",
        topic=topic,
        used_llm=llm_active,
        success=True,
        latency_ms=int((_time.monotonic() - started) * 1000),
        message_chars=len(message),
        reply_chars=len(reply),
        context_keys=keys,
    )

    suggestions = _suggest(message, topic, db)
    return {
        "reply": reply,
        "provider": provider if llm_active else "fallback",
        "used_llm": llm_active,
        "topic": topic,
        "context_keys": keys,
        "suggestions": suggestions,
    }


def _suggest(message: str, topic: str, db: Session) -> list[str]:
    text = message.lower()
    if topic == "off_topic":
        return []
    out: list[str] = []
    if "emi" not in text and topic in ("schemes", "general", "user_data"):
        out.append("How much EMI would I pay?")
    if topic != "partners":
        out.append("How do I find a Channel Partner near me?")
    if topic not in ("how_to", "user_data"):
        out.append("What documents do I need to apply?")
    if len(out) < 2:
        out.append("What schemes can I apply for?")
    return out[:3]


def assistant_status() -> dict:
    provider = (settings.ai_provider or "none").lower()
    enabled = provider in _CALLERS and bool(settings.ai_api_key)
    return {
        "enabled": enabled,
        "provider": provider,
        "model": settings.ai_model or None,
    }
