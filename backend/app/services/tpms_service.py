from typing import Dict, Any

class TPMSService:
    def __init__(self):
        self.is_collecting = False
        self.tire_count = 0
    
    def start_collection(self, tire_count: int) -> Dict[str, Any]:
        self.is_collecting = True
        self.tire_count = tire_count
        return {
            "success": True,
            "message": f"TPMS collection started with {tire_count} tires",
            "is_collecting": True
        }
    
    def stop_collection(self) -> Dict[str, Any]:
        self.is_collecting = False
        return {
            "success": True,
            "message": "TPMS collection stopped",
            "is_collecting": False
        }
    
    def get_status(self) -> Dict[str, Any]:
        return {
            "success": True,
            "is_collecting": self.is_collecting
        }

tpms_service = TPMSService()
