from typing import Optional
from pydantic import BaseModel
from pydantic.utils import GetterDict

# Getter that tolerates different column names on the ORM model
class HouseGetter(GetterDict):
    def get(self, key: str, default=None):
        obj = self._obj

        if key == "file_no":
            for name in ("file_no", "file", "file_number", "fileno"):
                if hasattr(obj, name):
                    return getattr(obj, name)
            return default

        if key == "qtr_no":
            for name in ("qtr_no", "qtr", "quarter_no"):
                if hasattr(obj, name):
                    return getattr(obj, name)
            return default

        if key == "street":
            for name in ("street",):
                if hasattr(obj, name):
                    return getattr(obj, name)
            return default

        if key == "sector":
            for name in ("sector",):
                if hasattr(obj, name):
                    return getattr(obj, name)
            return default

        if key == "type_code":
            for name in ("type_code", "type", "house_type"):
                if hasattr(obj, name):
                    return getattr(obj, name)
            return default

        if key == "status":
            return getattr(obj, "status", default)

        if key == "status_manual":
            return getattr(obj, "status_manual", default)

        # fallback to normal attribute access
        return getattr(obj, key, default)


# ----- Request models (keep your existing expectations here) -----

class HouseCreate(BaseModel):
    # Keep file_no required if your API expects it on create.
    file_no: str
    qtr_no: Optional[int] = None
    sector: Optional[str] = None
    street: Optional[str] = None
    type_code: Optional[str] = None
    status: Optional[str] = "vacant"
    status_manual: Optional[bool] = False


class HouseUpdate(BaseModel):
    # All optional for PATCH
    file_no: Optional[str] = None
    qtr_no: Optional[int] = None
    sector: Optional[str] = None
    street: Optional[str] = None
    type_code: Optional[str] = None
    status: Optional[str] = None
    status_manual: Optional[bool] = None


# ----- Response model (tolerant to missing/renamed ORM fields) -----

class HouseOut(BaseModel):
    id: int
    file_no: Optional[str] = None
    qtr_no: Optional[int] = None
    street: Optional[str] = None
    sector: Optional[str] = None
    type_code: Optional[str] = None
    status: Optional[str] = None
    status_manual: Optional[bool] = None

    class Config:
        orm_mode = True
        getter_dict = HouseGetter
