from pydantic import BaseModel, EmailStr, Field, field_validator

from schemas.common import ORMModel

USER_ROLE_CHOICES = ("applicant", "entrepreneur", "student")


class RegisterIn(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    mobile: str = Field(min_length=10, max_length=15)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    state: str | None = None
    district: str | None = None
    preferred_language: str = "en"
    user_type: str = "applicant"

    @field_validator("user_type")
    @classmethod
    def valid_type(cls, v: str) -> str:
        if v not in USER_ROLE_CHOICES:
            raise ValueError("Please choose a valid user type.")
        return v

    @field_validator("mobile")
    @classmethod
    def mobile_digits(cls, v: str) -> str:
        digits = "".join(ch for ch in v if ch.isdigit())
        if len(digits) < 10:
            raise ValueError("Please enter a valid mobile number.")
        return digits


class LoginIn(BaseModel):
    identifier: str  # mobile or email
    password: str
    remember_me: bool = False


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserOut"


class ForgotPasswordIn(BaseModel):
    identifier: str


class ResetPasswordIn(BaseModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)


class UserOut(ORMModel):
    id: int
    full_name: str
    mobile: str
    email: str
    role: str
    preferred_language: str
    age: int | None = None
    state: str | None = None
    district: str | None = None
    annual_income: int | None = None
    occupation: str | None = None
    category: str | None = None
    education_status: str | None = None


class UserUpdateIn(BaseModel):
    full_name: str | None = None
    preferred_language: str | None = None
    age: int | None = Field(default=None, ge=15, le=100)
    state: str | None = None
    district: str | None = None
    annual_income: int | None = Field(default=None, ge=0)
    occupation: str | None = None
    category: str | None = None
    education_status: str | None = None
    mobile: str | None = None
    email: EmailStr | None = None


TokenOut.model_rebuild()