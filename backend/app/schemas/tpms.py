from pydantic import BaseModel
from typing import Optional

class TPMSStartRequest(BaseModel):
    tire_count: int

class TPMSStatusResponse(BaseModel):
    success: bool
    is_collecting: bool
    message: Optional[str] = None
