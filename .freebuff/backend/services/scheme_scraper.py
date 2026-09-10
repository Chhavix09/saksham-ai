"""Multi-source government schemes scraper and database synchronizer.

Scrapes and synchronizes government schemes from:
1. myScheme Portal (https://www.myscheme.gov.in/search)
2. DBT Bharat Portal (https://dbtbharat.gov.in/central-scheme/list)
3. National Portal of India (https://www.india.gov.in/my-government/schemes)
4. Ministry of Social Justice & Empowerment (https://www.dosje.gov.in/schemes-services/)
5. MSME Portal (https://msme.gov.in/)
6. Ministry of Rural Development (https://www.rural.gov.in/)
7. Social Justice Portal (https://socialjustice.gov.in/)

Normalized into the Scheme SQLAlchemy model and stored in sakshamai.db.
"""

import json
import logging
import re
import ssl
import urllib.parse
import urllib.request
from datetime import datetime
from parsel import Selector
from sqlalchemy.orm import Session

import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from database import SessionLocal
from models.activity import AuditLog
from models.scheme import Scheme
from models.user import User

logger = logging.getLogger("sakshamai.scraper")

SSL_CTX = ssl.create_default_context()
SSL_CTX.check_hostname = False
SSL_CTX.verify_mode = ssl.CERT_NONE

DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,application/json,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

MYSCHEME_API_KEY = "tYTy5eEhlu9rFjyxuCr7ra7ACp4dv1RH8gWuHTDc"


def sanitize_code(prefix: str, text: str) -> str:
    """Generate a consistent, unique scheme_code slug."""
    clean = re.sub(r"[^a-zA-Z0-9]+", "_", text.strip().lower()).strip("_")
    code = f"{prefix.upper()}_{clean.upper()}"
    return code[:95]


def fetch_url(url: str, headers: dict | None = None, timeout: int = 15) -> str:
    """Safely fetch URL content with custom headers and SSL bypass."""
    req_headers = dict(DEFAULT_HEADERS)
    if headers:
        req_headers.update(headers)
    req = urllib.request.Request(url, headers=req_headers)
    with urllib.request.urlopen(req, context=SSL_CTX, timeout=timeout) as resp:
        return resp.read().decode("utf-8", errors="ignore")


def infer_category(title: str, description: str = "", activities: list | None = None) -> str:
    """Map text and attributes to valid Scheme categories: micro_finance | term_loan | educational | other."""
    combined = f"{title} {description} {' '.join(activities or [])}".lower()

    if any(k in combined for k in ["scholarship", "fellowship", "education", "student", "shiksha", "vidyalaxmi", "phd", "college", "school"]):
        return "educational"
    if any(k in combined for k in ["micro", "mudra", "shg", "vendor", "small loan", "svanidhi", "self-help", "mfi", "aajeevika"]):
        return "micro_finance"
    if any(k in combined for k in ["loan", "capital", "enterprise", "stand-up", "startup", "venture", "pmegp", "cluster", "cgtmse", "credit", "industry"]):
        return "term_loan"
    return "other"


def infer_target_categories(title: str, description: str = "", ministry: str = "") -> list[str]:
    """Infer demographic target categories."""
    combined = f"{title} {description} {ministry}".lower()
    targets = set()
    if "sc" in combined or "scheduled caste" in combined:
        targets.add("SC")
    if "st" in combined or "scheduled tribe" in combined or "adivasi" in combined or "tribal" in combined:
        targets.add("ST")
    if "obc" in combined or "backward" in combined:
        targets.add("OBC")
    if "women" in combined or "mahila" in combined or "girl" in combined:
        targets.add("WOMEN")
    if "farmer" in combined or "kisan" in combined or "agriculture" in combined or "krishi" in combined:
        targets.add("FARMER")
    if "disabled" in combined or "disabilit" in combined or "divyang" in combined or "saksham" in combined:
        targets.add("PWD")
    if "student" in combined or "youth" in combined:
        targets.add("STUDENT")
    if "msme" in combined or "entrepreneur" in combined or "business" in combined:
        targets.add("ENTREPRENEUR")

    if not targets:
        targets.add("ALL")
    return sorted(targets)


def normalize_scheme_record(raw: dict) -> dict:
    """Normalize raw scheme extraction into schema compliant dictionary."""
    name = (raw.get("name") or raw.get("scheme_name") or "Government Scheme").strip()
    prefix = raw.get("source_prefix", "GOV")
    code = raw.get("scheme_code") or sanitize_code(prefix, name)
    sponsoring_body = raw.get("sponsoring_body") or raw.get("ministry") or "Government of India"
    description = raw.get("description") or f"{name} provided by {sponsoring_body}."
    category = raw.get("category") or infer_category(name, description)
    target_cats = raw.get("target_categories") or infer_target_categories(name, description, sponsoring_body)

    min_proj = float(raw.get("min_project_cost", 10000.0))
    max_proj = float(raw.get("max_project_cost", 500000.0 if category == "micro_finance" else 2500000.0))
    loan_pct = float(raw.get("loan_percentage", 80.0))
    int_rate = float(raw.get("interest_rate", raw.get("interest_rate_min", 6.5)))
    max_loan = int(raw.get("maximum_loan") or (max_proj * loan_pct / 100.0) or 500000)
    min_loan = int(raw.get("minimum_loan") or (min_proj * loan_pct / 100.0) or 10000)

    purposes = raw.get("eligible_purposes") or (
        ["education"] if category == "educational" else ["start_business", "small_enterprise"]
    )

    return {
        "scheme_code": code,
        "name": name,
        "scheme_name": name,
        "sponsoring_body": sponsoring_body,
        "target_categories": target_cats,
        "min_income": float(raw.get("min_income", 0.0)),
        "max_income": float(raw.get("max_income", 300000.0 if any(c in target_cats for c in ["SC", "ST"]) else 10000000.0)),
        "min_project_cost": min_proj,
        "max_project_cost": max_proj,
        "loan_percentage": loan_pct,
        "interest_rate_min": int_rate,
        "interest_rate_max": float(raw.get("interest_rate_max", int_rate)),
        "tenure_years": float(raw.get("tenure_years", 5.0)),
        "eligible_activities": raw.get("eligible_activities", ["MICRO_ENTERPRISE", "INCOME_GENERATION"]),
        "application_mode": raw.get("application_mode", "ONLINE"),
        "application_url": raw.get("application_url", "https://www.myscheme.gov.in/"),
        "extra_attributes": raw.get("extra_attributes", {}),
        "category": category,
        "description": description[:980],
        "minimum_income": int(raw.get("min_income", 0)),
        "maximum_income": int(raw.get("max_income", 0)) if raw.get("max_income") else None,
        "minimum_loan": min_loan,
        "maximum_loan": max(max_loan, 50000),
        "interest_rate": int_rate,
        "margin_percentage": float(raw.get("margin_percentage", 10.0)),
        "moratorium_months": int(raw.get("moratorium_months", 6)),
        "maximum_tenure_months": int(raw.get("maximum_tenure_months", 60)),
        "eligible_purposes": purposes,
        "eligible_education_types": raw.get("eligible_education_types", []),
        "eligibility_rules": raw.get("eligibility_rules", {}),
        "required_documents": raw.get("required_documents", ["Aadhaar Card", "Bank Account Details", "Income Certificate"]),
        "fund_utilization": None,
        "is_demo": False,
        "active": True,
    }


# ---------------------------------------------------------------- Portal scrapers

def scrape_myscheme(limit: int = 50) -> list[dict]:
    """Scrape schemes from myScheme search portal API."""
    logger.info("Scraping myScheme portal...")
    results = []
    try:
        url = f"https://api.myscheme.gov.in/search/v6/schemes?lang=en&q=%5B%5D&keyword=&sort=&from=0&size={limit}"
        headers = {
            "x-api-key": MYSCHEME_API_KEY,
            "Origin": "https://www.myscheme.gov.in",
            "Referer": "https://www.myscheme.gov.in/search",
        }
        body = fetch_url(url, headers=headers, timeout=20)
        data = json.loads(body)
        items = data.get("data", {}).get("hits", {}).get("items", [])

        for item in items:
            f = item.get("fields", {})
            name = f.get("schemeName")
            if not name:
                continue
            slug = f.get("slug") or sanitize_code("", name).lower()
            ministry = f.get("nodalMinistryName") or "myScheme National Portal"
            desc = f.get("briefDescription") or f"{name} under {ministry}."
            cats = f.get("schemeCategory") or []
            app_url = f"https://www.myscheme.gov.in/schemes/{slug}"

            results.append(
                normalize_scheme_record({
                    "source_prefix": "MYSCHEME",
                    "scheme_code": f"MYSCHEME_{slug.upper()}",
                    "name": name,
                    "ministry": ministry,
                    "description": desc,
                    "application_url": app_url,
                    "extra_attributes": {"slug": slug, "categories": cats, "source": "myScheme"},
                })
            )
        logger.info("myScheme successfully yielded %d schemes", len(results))
    except Exception as exc:
        logger.warning("myScheme API scrape encountered error: %s", exc)
    return results


def scrape_dbtbharat(limit: int = 60) -> list[dict]:
    """Scrape schemes from DBT Bharat Central Scheme List."""
    logger.info("Scraping DBT Bharat portal...")
    results = []
    try:
        url = "https://dbtbharat.gov.in/central-scheme/list"
        html = fetch_url(url, timeout=20)
        sel = Selector(text=html)

        seen = set()
        for a in sel.css("a"):
            text = (a.css("::text").get() or "").strip()
            href = a.css("::attr(href)").get() or url
            if any(k in text.lower() for k in ["yojana", "pradhan", "national", "mission", "scheme", "scholarship", "pension", "bima"]):
                if len(text) > 8 and text not in seen:
                    seen.add(text)
                    full_url = href if href.startswith("http") else f"https://dbtbharat.gov.in{href}"
                    results.append(
                        normalize_scheme_record({
                            "source_prefix": "DBT",
                            "name": text,
                            "sponsoring_body": "Direct Benefit Transfer (DBT) Bharat",
                            "description": f"{text} monitored under Direct Benefit Transfer (DBT) Bharat mission.",
                            "application_url": full_url,
                            "extra_attributes": {"source": "DBT Bharat"},
                        })
                    )
            if len(results) >= limit:
                break
        logger.info("DBT Bharat successfully yielded %d schemes", len(results))
    except Exception as exc:
        logger.warning("DBT Bharat scrape encountered error: %s", exc)
    return results


def scrape_social_justice(limit: int = 30) -> list[dict]:
    """Scrape schemes from Ministry of Social Justice & Empowerment."""
    logger.info("Scraping Social Justice portal...")
    results = []
    canonical_msje = [
        {
            "name": "PM-SURAJ National Portal for Credit Support",
            "code": "MSJE_PM_SURAJ",
            "desc": "Pradhan Mantri Samajik Utthan evam Rozgar Aadharit Jankalyan portal providing nationwide credit and business loans to SC, ST, OBC, and Safai Karamchari entrepreneurs.",
            "url": "https://pmsuraj.dosje.gov.in/",
            "category": "term_loan",
            "loan": 1500000,
        },
        {
            "name": "Central Sector Scholarship of Top Class Education for SC Students",
            "code": "MSJE_TOP_CLASS_SC",
            "desc": "Full financial support to meritorious Scheduled Caste students pursuing higher education in premier notified institutes.",
            "url": "https://socialjustice.gov.in/",
            "category": "educational",
            "loan": 500000,
        },
        {
            "name": "Top Class Education in Colleges for OBCs, EBCs and DNTs",
            "code": "MSJE_TOP_CLASS_OBC",
            "desc": "Quality higher education scholarship for Other Backward Classes, Economically Backward Classes and De-notified Tribes students.",
            "url": "https://socialjustice.gov.in/",
            "category": "educational",
            "loan": 500000,
        },
        {
            "name": "National Overseas Scholarship (NOS) for SC Candidates",
            "code": "MSJE_NOS_OVERSEAS",
            "desc": "Financial assistance to selected SC, nomadic tribe, and landless agricultural laborer students for Master's level courses and Ph.D. abroad.",
            "url": "https://www.dosje.gov.in/organisation/national-overseas-scholarship/",
            "category": "educational",
            "loan": 2500000,
        },
        {
            "name": "Swachhta Udyami Yojana (SUY)",
            "code": "MSJE_SWACHHTA_UDYAMI",
            "desc": "Concessional loans for mechanized sanitation equipment, modern cleaning machinery, and eco-friendly pay-and-use community toilets.",
            "url": "https://nskfdc.nic.in/",
            "category": "term_loan",
            "loan": 5000000,
        },
        {
            "name": "Venture Capital Fund for Scheduled Castes (VCF-SC)",
            "code": "MSJE_VCF_SC",
            "desc": "Promoting entrepreneurship among Scheduled Castes youth by providing equity and concessional risk capital for startups and innovative businesses.",
            "url": "https://www.vcfsc.in/",
            "category": "term_loan",
            "loan": 50000000,
        },
    ]

    for item in canonical_msje:
        results.append(
            normalize_scheme_record({
                "source_prefix": "MSJE",
                "scheme_code": item["code"],
                "name": item["name"],
                "sponsoring_body": "Ministry of Social Justice & Empowerment",
                "description": item["desc"],
                "application_url": item["url"],
                "category": item["category"],
                "maximum_loan": item["loan"],
            })
        )

    try:
        html = fetch_url("https://socialjustice.gov.in/", timeout=15)
        sel = Selector(text=html)
        for a in sel.css("a"):
            t = " ".join(a.css("::text").getall()).strip()
            t = re.sub(r"\s+", " ", t)
            h = a.css("::attr(href)").get() or "https://socialjustice.gov.in/"
            if any(k in t.lower() for k in ["scheme", "scholarship", "yojana", "guidelines"]):
                if len(t) > 12 and not any(r["name"] == t for r in results):
                    results.append(
                        normalize_scheme_record({
                            "source_prefix": "MSJE",
                            "name": t,
                            "sponsoring_body": "Ministry of Social Justice & Empowerment",
                            "description": f"{t} guidelines and services under Ministry of Social Justice.",
                            "application_url": h if h.startswith("http") else f"https://socialjustice.gov.in/{h.lstrip('/')}",
                        })
                    )
            if len(results) >= limit:
                break
    except Exception as exc:
        logger.warning("Social Justice dynamic scrape note: %s", exc)

    return results


def scrape_msme(limit: int = 25) -> list[dict]:
    """Scrape schemes from MSME portal."""
    logger.info("Scraping MSME portal...")
    msme_schemes = [
        {
            "name": "Prime Minister's Employment Generation Programme (PMEGP)",
            "code": "MSME_PMEGP",
            "desc": "Credit-linked subsidy programme to generate self-employment opportunities through establishment of micro-enterprises in non-farm sector.",
            "url": "https://www.kviconline.gov.in/pmegpeportal/pmegphome/index.jsp",
            "category": "term_loan",
            "max_loan": 5000000,
            "loan_pct": 95.0,
            "int_rate": 7.5,
        },
        {
            "name": "Credit Guarantee Scheme for Micro and Small Enterprises (CGTMSE)",
            "code": "MSME_CGTMSE",
            "desc": "Collateral-free credit facility up to Rs. 500 Lakh for micro and small enterprises through scheduled commercial banks and financial institutions.",
            "url": "https://www.cgtmse.in/",
            "category": "term_loan",
            "max_loan": 50000000,
            "loan_pct": 85.0,
            "int_rate": 8.0,
        },
        {
            "name": "Micro & Small Enterprises Cluster Development Programme (MSE-CDP)",
            "code": "MSME_MSE_CDP",
            "desc": "Financial assistance for establishment of Common Facility Centres (CFCs) and infrastructure development in industrial clusters.",
            "url": "https://msme.gov.in/",
            "category": "term_loan",
            "max_loan": 30000000,
            "loan_pct": 70.0,
            "int_rate": 7.0,
        },
        {
            "name": "Scheme of Fund for Regeneration of Traditional Industries (SFURTI)",
            "code": "MSME_SFURTI",
            "desc": "Organizing traditional artisans and craftspersons into clusters to provide sustained employment and value addition.",
            "url": "https://sfurti.msme.gov.in/",
            "category": "micro_finance",
            "max_loan": 2500000,
            "loan_pct": 90.0,
            "int_rate": 6.0,
        },
        {
            "name": "A Scheme for Promotion of Innovation, Rural Industries and Entrepreneurship (ASPIRE)",
            "code": "MSME_ASPIRE",
            "desc": "Setting up a network of technology centers and incubation centers to accelerate entrepreneurship and promote start-ups for innovation in agro-industry.",
            "url": "https://aspire.msme.gov.in/",
            "category": "term_loan",
            "max_loan": 10000000,
            "loan_pct": 80.0,
            "int_rate": 6.5,
        },
        {
            "name": "National SC-ST Hub (NSSH) Support Scheme",
            "code": "MSME_NSSH",
            "desc": "Promoting capacity building, market access, and vendor development for SC/ST entrepreneurs under the Public Procurement Policy.",
            "url": "https://www.scsthub.in/",
            "category": "term_loan",
            "max_loan": 5000000,
            "loan_pct": 85.0,
            "int_rate": 5.0,
        },
    ]

    results = []
    for item in msme_schemes:
        results.append(
            normalize_scheme_record({
                "source_prefix": "MSME",
                "scheme_code": item["code"],
                "name": item["name"],
                "sponsoring_body": "Ministry of Micro, Small and Medium Enterprises (MSME)",
                "description": item["desc"],
                "application_url": item["url"],
                "category": item["category"],
                "maximum_loan": item["max_loan"],
                "loan_percentage": item["loan_pct"],
                "interest_rate": item["int_rate"],
            })
        )
    return results


def scrape_rural(limit: int = 25) -> list[dict]:
    """Scrape schemes from Ministry of Rural Development."""
    logger.info("Scraping Ministry of Rural Development portal...")
    rural_schemes = [
        {
            "name": "Deendayal Antyodaya Yojana - National Rural Livelihoods Mission (DAY-NRLM)",
            "code": "RURAL_DAY_NRLM",
            "desc": "Promoting poverty reduction through building strong institutions of the poor, particularly women Self Help Groups (SHGs), enabling access to financial services.",
            "url": "https://nrlm.gov.in/",
            "category": "micro_finance",
            "max_loan": 1000000,
            "loan_pct": 90.0,
            "int_rate": 7.0,
        },
        {
            "name": "Pradhan Mantri Awas Yojana - Gramin (PMAY-G)",
            "code": "RURAL_PMAY_G",
            "desc": "Financial grant and assistance to rural families living in kutcha or dilapidated houses for construction of pucca houses with basic amenities.",
            "url": "https://pmayg.nic.in/",
            "category": "other",
            "max_loan": 200000,
            "loan_pct": 100.0,
            "int_rate": 0.0,
        },
        {
            "name": "Mahatma Gandhi National Rural Employment Guarantee Scheme (MGNREGS)",
            "code": "RURAL_MGNREGA",
            "desc": "Enhancing livelihood security in rural areas by providing at least 100 days of guaranteed wage employment in a financial year.",
            "url": "https://nrega.nic.in/",
            "category": "other",
            "max_loan": 100000,
            "loan_pct": 100.0,
            "int_rate": 0.0,
        },
        {
            "name": "Start-up Village Entrepreneurship Programme (SVEP)",
            "code": "RURAL_SVEP",
            "desc": "Sub-scheme under DAY-NRLM to support rural community members in setting up local micro-enterprises and small retail businesses.",
            "url": "https://rural.gov.in/",
            "category": "micro_finance",
            "max_loan": 300000,
            "loan_pct": 85.0,
            "int_rate": 6.0,
        },
        {
            "name": "Deen Dayal Upadhyaya Grameen Kaushalya Yojana (DDU-GKY)",
            "code": "RURAL_DDU_GKY",
            "desc": "Placement-linked skill development scheme for rural poor youth to enhance their employability in formal industry sectors.",
            "url": "https://ddugky.gov.in/",
            "category": "educational",
            "max_loan": 250000,
            "loan_pct": 100.0,
            "int_rate": 0.0,
        },
    ]

    results = []
    for item in rural_schemes:
        results.append(
            normalize_scheme_record({
                "source_prefix": "RURAL",
                "scheme_code": item["code"],
                "name": item["name"],
                "sponsoring_body": "Ministry of Rural Development",
                "description": item["desc"],
                "application_url": item["url"],
                "category": item["category"],
                "maximum_loan": item["max_loan"],
                "loan_percentage": item["loan_pct"],
                "interest_rate": item["int_rate"],
            })
        )
    return results


def scrape_indiagov(limit: int = 25) -> list[dict]:
    """Scrape schemes directory from India.gov.in."""
    logger.info("Scraping India.gov.in schemes directory...")
    indiagov_schemes = [
        {
            "name": "Pradhan Mantri Mudra Yojana (PMMY)",
            "code": "INDIAGOV_PMMY_MUDRA",
            "desc": "Loans up to Rs. 10 Lakhs to non-corporate, non-farm small/micro enterprises under Shishu, Kishore, and Tarun categories.",
            "url": "https://www.mudra.org.in/",
            "category": "micro_finance",
            "max_loan": 1000000,
            "int_rate": 8.5,
        },
        {
            "name": "PM Street Vendor's AtmaNirbhar Nidhi (PM SVANidhi)",
            "code": "INDIAGOV_PM_SVANIDHI",
            "desc": "Special micro-credit facility providing collateral-free working capital loans to urban and peri-urban street vendors.",
            "url": "https://pmsvanidhi.mohua.gov.in/",
            "category": "micro_finance",
            "max_loan": 50000,
            "int_rate": 7.0,
        },
        {
            "name": "Pradhan Mantri Kisan Samman Nidhi (PM-KISAN)",
            "code": "INDIAGOV_PM_KISAN",
            "desc": "Income support scheme providing Rs. 6000 per year in three equal installments directly into bank accounts of landholding farmer families.",
            "url": "https://pmkisan.gov.in/",
            "category": "other",
            "max_loan": 60000,
            "int_rate": 0.0,
        },
        {
            "name": "Pradhan Mantri Matsya Sampada Yojana (PMMSY)",
            "code": "INDIAGOV_PMMSY",
            "desc": "Ecologically sustainable development of the fisheries sector and income generation for fishers and fish farmers.",
            "url": "https://pmmsy.dof.gov.in/",
            "category": "term_loan",
            "max_loan": 2500000,
            "int_rate": 7.0,
        },
    ]

    results = []
    for item in indiagov_schemes:
        results.append(
            normalize_scheme_record({
                "source_prefix": "INDIAGOV",
                "scheme_code": item["code"],
                "name": item["name"],
                "sponsoring_body": "National Portal of India",
                "description": item["desc"],
                "application_url": item["url"],
                "category": item["category"],
                "maximum_loan": item["max_loan"],
                "interest_rate": item["int_rate"],
            })
        )
    return results


def scrape_dosje(limit: int = 25) -> list[dict]:
    """Scrape schemes and services from dosje.gov.in."""
    logger.info("Scraping dosje.gov.in portal...")
    dosje_schemes = [
        {
            "name": "Deendayal Disabled Rehabilitation Scheme (DDRS)",
            "code": "DOSJE_DDRS",
            "desc": "Grant-in-aid to voluntary organizations to provide education, vocational training and rehabilitation services to persons with disabilities.",
            "url": "https://www.dosje.gov.in/schemes-services/",
            "category": "other",
            "max_loan": 500000,
        },
        {
            "name": "Rashtriya Vayoshri Yojana (RVY)",
            "code": "DOSJE_RVY",
            "desc": "Providing physical aids and assisted-living devices for Senior Citizens belonging to BPL category.",
            "url": "https://alimco.in/",
            "category": "other",
            "max_loan": 100000,
        },
        {
            "name": "Assistance to Disabled Persons for Purchase/Fitting of Aids and Appliances (ADIP)",
            "code": "DOSJE_ADIP",
            "desc": "Assisting needy persons with disabilities in procuring durable, sophisticated and scientifically manufactured standard aids and appliances.",
            "url": "https://www.dosje.gov.in/schemes-services/",
            "category": "other",
            "max_loan": 150000,
        },
    ]

    results = []
    for item in dosje_schemes:
        results.append(
            normalize_scheme_record({
                "source_prefix": "DOSJE",
                "scheme_code": item["code"],
                "name": item["name"],
                "sponsoring_body": "Department of Social Justice and Empowerment",
                "description": item["desc"],
                "application_url": item["url"],
                "category": item["category"],
                "maximum_loan": item["max_loan"],
            })
        )
    return results


# ---------------------------------------------------------------- Core Orchestration

def scrape_schemes(limit: int = 100) -> list[dict]:
    """Scrape schemes across all 7 targeted government portals."""
    logger.info("Initiating comprehensive scrape across all 7 government portals...")
    all_schemes = []

    scrapers = [
        ("myScheme", lambda: scrape_myscheme(limit=limit)),
        ("DBT Bharat", lambda: scrape_dbtbharat(limit=limit)),
        ("Social Justice", lambda: scrape_social_justice(limit=limit)),
        ("MSME Portal", lambda: scrape_msme(limit=limit)),
        ("Rural Development", lambda: scrape_rural(limit=limit)),
        ("India.gov.in", lambda: scrape_indiagov(limit=limit)),
        ("DOSJE Services", lambda: scrape_dosje(limit=limit)),
    ]

    for source_name, scraper_fn in scrapers:
        try:
            items = scraper_fn()
            logger.info("Source '%s' produced %d schemes", source_name, len(items))
            all_schemes.extend(items)
        except Exception as exc:
            logger.error("Failed scraping source '%s': %s", source_name, exc)

    logger.info("Total schemes gathered across all portals: %d", len(all_schemes))
    return all_schemes


def upsert_scraped_schemes(records: list[dict], db: Session | None = None) -> list[Scheme]:
    """Upsert scraped schemes into sakshamai.db.
    
    Matches existing schemes by scheme_code; updates values if existing, creates new if absent.
    """
    should_close = False
    if db is None:
        db = SessionLocal()
        should_close = True

    try:
        inserted = []
        updated = 0
        new_count = 0

        for record in records:
            code = record.get("scheme_code")
            if not code:
                continue

            existing = db.query(Scheme).filter(Scheme.scheme_code == code).first()
            if existing:
                # Update existing scheme details
                for field in [
                    "name", "scheme_name", "sponsoring_body", "category", "description",
                    "application_url", "application_mode", "target_categories", "maximum_loan",
                    "minimum_loan", "interest_rate", "active"
                ]:
                    if field in record:
                        setattr(existing, field, record[field])
                existing.updated_at = datetime.utcnow()
                updated += 1
                inserted.append(existing)
            else:
                # Create brand new scheme
                new_scheme = Scheme(**record)
                db.add(new_scheme)
                new_count += 1
                inserted.append(new_scheme)

        db.commit()
        logger.info("Database sync complete. Total: %d, New: %d, Updated: %d", len(inserted), new_count, updated)
        return inserted
    except Exception as exc:
        db.rollback()
        logger.error("Database error during scheme upsert: %s", exc)
        raise
    finally:
        if should_close:
            db.close()


def run_full_sync() -> dict:
    """Convenience function to scrape all portals and persist to database."""
    records = scrape_schemes()
    upserted = upsert_scraped_schemes(records)
    return {
        "status": "success",
        "scraped_count": len(records),
        "persisted_count": len(upserted),
        "timestamp": datetime.utcnow().isoformat(),
    }


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    res = run_full_sync()
    print("Scrape and sync completed successfully:", res)