from __future__ import annotations
from typing import Optional
from pydantic import BaseModel
from pydantic.utils import GetterDict

# Tolerant getter so responses don't 500 even if legacy column names exist
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
            return getattr(obj, "street", default)

        if key == "sector":
            return getattr(obj, "sector", default)

        if key == "type_code":
            for name in ("type_code", "type", "house_type"):
                if hasattr(obj, name):
                    return getattr(obj, name)
            return default

        if key == "status":
            return getattr(obj, "status", default)

        if key == "status_manual":
            return getattr(obj, "status_manual", default)

        return getattr(obj, key, default)

class HouseCreate(BaseModel):
    file_no: str
    qtr_no: Optional[int] = None
    street: Optional[str] = None
    sector: Optional[str] = None
    type_code: Optional[str] = None
    status: Optional[str] = "vacant"
    status_manual: Optional[bool] = False

class HouseUpdate(BaseModel):
    file_no: Optional[str] = None
    qtr_no: Optional[int] = None
    street: Optional[str] = None
    sector: Optional[str] = None
    type_code: Optional[str] = None
    status: Optional[str] = None
    status_manual: Optional[bool] = None

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
