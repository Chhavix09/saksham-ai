"""Demo seed data.

All schemes and partners are clearly marked is_demo=True — they are realistic
sample records for development and hackathon presentations, NOT official live
government information. Replace with verified data in production.
"""

from sqlalchemy.orm import Session

from database import Base, SessionLocal, engine
from models.activity import Application, Recommendation
from models.scheme import Partner, Scheme
from models.user import User
from services.config_service import seed_default_config
from services.recommendation_engine import generate_recommendation
from utils.security import hash_password


def _scheme(db: Session, **kw) -> Scheme:
    existing = db.query(Scheme).filter(Scheme.scheme_name == kw["scheme_name"]).first()
    if existing:
        return existing
    scheme = Scheme(**kw, is_demo=True)
    db.add(scheme)
    return scheme


def seed_schemes(db: Session) -> list[Scheme]:
    schemes = [
        _scheme(
            db,
            scheme_name="Micro Finance Scheme",
            category="micro_finance",
            description=(
                "For smaller income-generating projects — kirana stores, tailoring units, "
                "agri-allied activity, artisan work and similar micro enterprises."
            ),
            minimum_income=None,
            maximum_income=300000,
            minimum_loan=10000,
            maximum_loan=140000,
            interest_rate=7.0,
            margin_percentage=5.0,
            moratorium_months=3,
            maximum_tenure_months=36,
            eligible_purposes=["start_business", "small_enterprise", "agriculture", "other"],
            eligible_education_types=[],
            eligibility_rules={"note": "Primarily for lower-income households and micro enterprises."},
            required_documents=[
                "identity_proof", "address_proof", "income_certificate", "project_documents", "bank_details",
            ],
            fund_utilization=62.0,
        ),
        _scheme(
            db,
            scheme_name="Term Loan Scheme",
            category="term_loan",
            description=(
                "For larger income-generating projects and business expansion — machinery, "
                "working capital, infrastructure and substantial enterprise financing."
            ),
            minimum_income=None,
            maximum_income=None,
            minimum_loan=100000,
            maximum_loan=5000000,
            interest_rate=7.0,
            margin_percentage=10.0,
            moratorium_months=6,
            maximum_tenure_months=60,
            eligible_purposes=[
                "start_business", "expand_business", "agriculture", "small_enterprise", "vehicle_equipment",
            ],
            eligible_education_types=[],
            eligibility_rules={"note": "Project should demonstrate income-generating capacity."},
            required_documents=[
                "identity_proof", "address_proof", "income_certificate", "project_documents",
                "bank_details", "business_registration",
            ],
            fund_utilization=55.0,
        ),
        _scheme(
            db,
            scheme_name="Educational Loan Scheme",
            category="educational",
            description=(
                "For eligible higher-education expenses — tuition, course fees, study materials "
                "and related education costs for recognized courses and institutions."
            ),
            minimum_income=None,
            maximum_income=None,
            minimum_loan=50000,
            maximum_loan=2000000,
            interest_rate=6.5,
            margin_percentage=0.0,
            moratorium_months=12,
            maximum_tenure_months=120,
            eligible_purposes=["education"],
            eligible_education_types=[
                "undergraduate", "postgraduate", "professional", "vocational", "engineering", "medical", "other",
            ],
            eligibility_rules={"note": "Course must be from a recognized institution."},
            required_documents=[
                "identity_proof", "address_proof", "income_certificate", "education_documents", "bank_details",
            ],
            fund_utilization=48.0,
        ),
        _scheme(
            db,
            scheme_name="Agricultural & Allied Activity Scheme",
            category="term_loan",
            description=(
                "For agriculture and allied activities — farm equipment, irrigation, dairy, "
                "poultry, fishery and agri-processing units."
            ),
            minimum_income=None,
            maximum_income=600000,
            minimum_loan=50000,
            maximum_loan=1000000,
            interest_rate=6.0,
            margin_percentage=5.0,
            moratorium_months=6,
            maximum_tenure_months=60,
            eligible_purposes=["agriculture", "start_business", "expand_business"],
            eligible_education_types=[],
            eligibility_rules={"note": "Activity must be agriculture/allied in nature."},
            required_documents=[
                "identity_proof", "address_proof", "income_certificate", "project_documents", "bank_details",
            ],
            fund_utilization=70.0,
        ),
        _scheme(
            db,
            scheme_name="Vehicle & Equipment Finance Scheme",
            category="term_loan",
            description=(
                "For commercial vehicles, machinery and equipment used for income-generating "
                "activity such as transport, construction and manufacturing."
            ),
            minimum_income=None,
            maximum_income=None,
            minimum_loan=100000,
            maximum_loan=2000000,
            interest_rate=7.5,
            margin_percentage=15.0,
            moratorium_months=3,
            maximum_tenure_months=48,
            eligible_purposes=["vehicle_equipment", "expand_business", "small_enterprise"],
            eligible_education_types=[],
            eligibility_rules={"note": "Vehicle/equipment must be for commercial use."},
            required_documents=[
                "identity_proof", "address_proof", "income_certificate", "project_documents",
                "bank_details", "business_registration",
            ],
            fund_utilization=58.0,
        ),
    ]
    db.commit()
    return schemes


_PARTNERS = [
    # (name, type, address, state, district, city, pincode, lat, lng, schemes idx, fund, status, npa)
    ("Gujarat State Finance Corporation", "SCA", "Sector 10, Gandhinagar", "Gujarat", "Gandhinagar", "Gandhinagar", "382010", 23.2156, 72.6369, [0, 1, 3, 4], 55.0, "available", "none"),
    ("Saksham Gujarat SCA – Ahmedabad", "SCA", "Ashram Road, Ahmedabad", "Gujarat", "Ahmedabad", "Ahmedabad", "380009", 23.0225, 72.5714, [0, 1, 3, 4], 61.0, "available", "none"),
    ("Maharashtra State Finance Agency", "SCA", "Nariman Point, Mumbai", "Maharashtra", "Mumbai City", "Mumbai", "400021", 19.0760, 72.8777, [0, 1, 3], 68.0, "available", "none"),
    ("Karnataka State Channelizing Agency", "SCA", "MG Road, Bengaluru", "Karnataka", "Bengaluru Urban", "Bengaluru", "560001", 12.9716, 77.5946, [0, 1, 2], 74.0, "limited", "none"),
    ("Tamil Nadu State Credit Agency", "SCA", "Anna Salai, Chennai", "Tamil Nadu", "Chennai", "Chennai", "600002", 13.0827, 80.2707, [1, 2], 61.0, "available", "none"),
    ("West Bengal State Finance Agency", "SCA", "Salt Lake, Kolkata", "West Bengal", "Kolkata", "Kolkata", "700091", 22.5726, 88.3639, [0, 1], 82.0, "limited", "watch"),
    ("Uttar Pradesh State Channelizing Agency", "SCA", "Hazratganj, Lucknow", "Uttar Pradesh", "Lucknow", "Lucknow", "226001", 26.8467, 80.9462, [0, 1, 3, 4], 58.0, "available", "none"),
    ("State Bank of India – Ahmedabad Branch", "PSB", "Bhadra, Ahmedabad", "Gujarat", "Ahmedabad", "Ahmedabad", "380001", 23.0300, 72.5800, [1, 2], 45.0, "available", "none"),
    ("Bank of Baroda – Vadodara Main Branch", "PSB", "Mandal, Vadodara", "Gujarat", "Vadodara", "Vadodara", "390001", 22.3072, 73.1812, [1, 3, 4], 39.0, "available", "none"),
    ("Punjab National Bank – Ludhiana", "PSB", "Civil Lines, Ludhiana", "Punjab", "Ludhiana", "Ludhiana", "141001", 30.9010, 75.8573, [1, 3], 52.0, "available", "none"),
    ("Canara Bank – Pune", "PSB", "FC Road, Pune", "Maharashtra", "Pune", "Pune", "411004", 18.5204, 73.8567, [1, 2, 4], 47.0, "available", "none"),
    ("Bank of India – Mumbai Fort", "PSB", "Fort, Mumbai", "Maharashtra", "Mumbai City", "Mumbai", "400001", 18.9322, 72.8311, [1, 2], 60.0, "limited", "none"),
    ("Union Bank of India – Jaipur", "PSB", "MI Road, Jaipur", "Rajasthan", "Jaipur", "Jaipur", "302001", 26.9124, 75.7873, [0, 1, 3], 44.0, "available", "none"),
    ("Baroda Gujarat Gramin Bank", "RRB", "Akota, Vadodara", "Gujarat", "Vadodara", "Vadodara", "390020", 22.2700, 73.1700, [0, 3], 66.0, "available", "watch"),
    ("Karnataka Gramin Bank", "RRB", "Vidyanagar, Hubballi", "Karnataka", "Dharwad", "Hubballi", "580031", 15.3647, 75.1240, [0, 3], 71.0, "available", "none"),
    ("Punjab Gramin Bank", "RRB", "Ferozepur Road, Ludhiana", "Punjab", "Ludhiana", "Ludhiana", "141012", 30.9100, 75.8700, [0, 3], 78.0, "limited", "none"),
    ("Madhya Bihar Gramin Bank", "RRB", "Frazer Road, Patna", "Bihar", "Patna", "Patna", "800001", 25.5941, 85.1376, [0, 3], 63.0, "available", "none"),
    ("Sakhi Micro Finance – Surat", "NBFC-MFI", "Ring Road, Surat", "Gujarat", "Surat", "Surat", "395002", 21.1702, 72.8311, [0], 69.0, "available", "none"),
    ("Ujjwal Finance – Coimbatore", "NBFC-MFI", "Ramanathapuram, Coimbatore", "Tamil Nadu", "Coimbatore", "Coimbatore", "641045", 11.0168, 76.9558, [0], 58.0, "available", "none"),
    ("Anmol Microcredit – Varanasi", "NBFC-MFI", "Cantt, Varanasi", "Uttar Pradesh", "Varanasi", "Varanasi", "221002", 25.3176, 82.9739, [0], 85.0, "paused", "high"),
    ("Gram Shakti Finance – Nagpur", "NBFC-MFI", "Sitabuldi, Nagpur", "Maharashtra", "Nagpur", "Nagpur", "440012", 21.1458, 79.0882, [0], 54.0, "available", "none"),
    ("Kerala Micro Enterprise Finance", "NBFC-MFI", "MG Road, Kochi", "Kerala", "Ernakulam", "Kochi", "682016", 9.9312, 76.2673, [0], 77.0, "limited", "none"),
    ("Delhi Urban Credit Co-operative", "NBFC-MFI", "Karol Bagh, New Delhi", "Delhi", "Central Delhi", "New Delhi", "110005", 28.6139, 77.2090, [0, 4], 49.0, "available", "none"),
]


def seed_partners(db: Session, schemes: list[Scheme]) -> list[Partner]:
    partners = []
    for row in _PARTNERS:
        name = row[0]
        existing = db.query(Partner).filter(Partner.name == name).first()
        if existing:
            partners.append(existing)
            continue
        partner = Partner(
            name=name,
            partner_type=row[1],
            address=row[2],
            state=row[3],
            district=row[4],
            city=row[5],
            pincode=row[6],
            latitude=row[7],
            longitude=row[8],
            contact_person=f"Manager, {row[1]}",
            phone=f"+91 79 0000 {1000 + len(partners)}",
            email=f"contact{len(partners) + 1}@demo.saksham.in",
            fund_utilization_percent=row[10],
            processing_status=row[11],
            npa_indicator=row[12],
            is_demo=True,
        )
        partner.supported_schemes = [schemes[i] for i in row[9]]
        db.add(partner)
        partners.append(partner)
    db.commit()
    return partners


def seed_users(db: Session) -> dict:
    users = {
        "admin": db.query(User).filter(User.email == "admin@saksham.demo").first(),
        "rahul": db.query(User).filter(User.email == "rahul@saksham.demo").first(),
        "priya": db.query(User).filter(User.email == "priya@saksham.demo").first(),
    }
    if not users["admin"]:
        admin = User(
            full_name="Administrator", mobile="9999900001", email="admin@saksham.demo",
            password_hash=hash_password("Admin@12345"), role="admin", preferred_language="en",
        )
        db.add(admin)
        users["admin"] = admin
    if not users["rahul"]:
        rahul = User(
            full_name="Rahul Sharma", mobile="9999900002", email="rahul@saksham.demo",
            password_hash=hash_password("Demo@12345"), role="entrepreneur", preferred_language="hi",
            state="Gujarat", district="Ahmedabad", annual_income=350000, age=31,
            occupation="Small business owner", category="general", education_status="graduate",
        )
        db.add(rahul)
        users["rahul"] = rahul
    if not users["priya"]:
        priya = User(
            full_name="Priya Desai", mobile="9999900003", email="priya@saksham.demo",
            password_hash=hash_password("Demo@12345"), role="student", preferred_language="gu",
            state="Maharashtra", district="Pune", annual_income=450000, age=22,
            occupation="Student", category="general", education_status="undergraduate",
        )
        db.add(priya)
        users["priya"] = priya
    db.commit()
    return users


def seed_activity(db: Session, users: dict, schemes: list[Scheme], partners: list[Partner]) -> None:
    # A sample recommendation for the demo entrepreneur
    has_rec = db.query(Recommendation).filter(Recommendation.user_id == users["rahul"].id).first()
    if not has_rec:
        generate_recommendation(
            db,
            {
                "income": 350000,
                "project_cost": 1000000,
                "purpose": "start_business",
                "education_status": "graduate",
                "location": {"state": "Gujarat", "district": "Ahmedabad"},
                "required_loan": 900000,
                "own_contribution": 100000,
            },
            user_id=users["rahul"].id,
        )

    has_app = db.query(Application).filter(Application.user_id == users["rahul"].id).first()
    if not has_app:
        term = next((s for s in schemes if s.category == "term_loan"), schemes[1])
        partner = next((p for p in partners if p.state == "Gujarat" and term in p.supported_schemes), partners[0])
        db.add(
            Application(
                user_id=users["rahul"].id,
                scheme_id=term.id,
                partner_id=partner.id,
                status="documents_pending",
                applicant_info={"full_name": "Rahul Sharma", "age": 31, "state": "Gujarat", "district": "Ahmedabad"},
                financial_info={"project_cost": 1000000, "loan_amount": 900000, "own_contribution": 100000},
                documents=[
                    {"name": "identity_proof", "label": "Identity proof (Aadhaar/PAN)", "provided": True},
                    {"name": "address_proof", "label": "Address proof", "provided": True},
                    {"name": "income_certificate", "label": "Income certificate", "provided": False},
                    {"name": "project_documents", "label": "Project / business documents", "provided": False},
                    {"name": "bank_details", "label": "Bank account details", "provided": True},
                    {"name": "business_registration", "label": "Business registration proof", "provided": False},
                ],
            )
        )
        db.commit()


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seed_default_config(db)
        schemes = seed_schemes(db)
        partners = seed_partners(db, schemes)
        users = seed_users(db)
        seed_activity(db, users, schemes, partners)


if __name__ == "__main__":
    init_db()
    print("SakshamAI demo database seeded.")