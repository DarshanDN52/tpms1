from typing import Optional, Dict, Any
import sys
import os

# Add root directory to path to import PCANBasic
root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

# Initialize defaults
PCANBasic = None
PCAN_ERROR_OK = 0
PCAN_ERROR_CAUTION = 0x8000
PCAN_ERROR_QRCVEMPTY = 0x00020  # Receive queue is empty
PCAN_USBBUS1 = 0x51
PCAN_USBBUS2 = 0x52
PCAN_USBBUS3 = 0x53
PCAN_USBBUS4 = 0x54
PCAN_USBBUS5 = 0x55
PCAN_BAUD_1M = 0x0014
PCAN_BAUD_800K = 0x0015
PCAN_BAUD_500K = 0x0004
PCAN_BAUD_250K = 0x0005
PCAN_BAUD_125K = 0x0006
PCAN_BAUD_100K = 0x0007
PCAN_BAUD_50K = 0x0008
PCAN_BAUD_20K = 0x0009
PCAN_BAUD_10K = 0x000A
PCAN_MESSAGE_STANDARD = 0x00
TPCANMsg = None

# Try to import PCANBasic
try:
    from PCANBasic import *
except (ImportError, Exception):
    # PCANBasic not available - will return errors when trying to connect
    pass

class PCANService:
    """Real PCAN service - requires actual PCAN hardware"""
    def __init__(self):
        self.initialized = False
        self.channel = None
        self.baudrate = None
        self.message_counter = 0
        self.pcan_available = False
        self.pcan = None
        
        # Try to instantiate PCANBasic if available
        if PCANBasic is not None:
            try:
                self.pcan = PCANBasic()
                self.pcan_available = True
            except Exception as e:
                # Library failed to load (e.g., libpcanbasic.so not found)
                self.pcan = None
                self.pcan_available = False
        
        # Channel mapping
        self.channel_map = {
            'PCAN_USBBUS1': PCAN_USBBUS1,
            'PCAN_USBBUS2': PCAN_USBBUS2,
            'PCAN_USBBUS3': PCAN_USBBUS3,
            'PCAN_USBBUS4': PCAN_USBBUS4,
            'PCAN_USBBUS5': PCAN_USBBUS5,
        }
        
        # Baudrate mapping
        self.baudrate_map = {
            'PCAN_BAUD_1M': PCAN_BAUD_1M,
            'PCAN_BAUD_800K': PCAN_BAUD_800K,
            'PCAN_BAUD_500K': PCAN_BAUD_500K,
            'PCAN_BAUD_250K': PCAN_BAUD_250K,
            'PCAN_BAUD_125K': PCAN_BAUD_125K,
            'PCAN_BAUD_100K': PCAN_BAUD_100K,
            'PCAN_BAUD_50K': PCAN_BAUD_50K,
            'PCAN_BAUD_20K': PCAN_BAUD_20K,
            'PCAN_BAUD_10K': PCAN_BAUD_10K,
        }
    
    def initialize(self, channel: str, baudrate: str) -> Dict[str, Any]:
        try:
            if not self.pcan_available:
                return {
                    "success": False,
                    "error": "PCAN hardware not available. Ensure PCANBasic driver is installed and PCAN device is connected."
                }
            
            # Get channel handle from mapping
            if channel not in self.channel_map:
                return {
                    "success": False,
                    "error": f"Invalid channel: {channel}"
                }
            
            if baudrate not in self.baudrate_map:
                return {
                    "success": False,
                    "error": f"Invalid baudrate: {baudrate}"
                }
            
            pcan_channel = self.channel_map[channel]
            pcan_baudrate = self.baudrate_map[baudrate]
            
            # Initialize PCAN with proper parameters
            result = self.pcan.Initialize(pcan_channel, pcan_baudrate)
            
            # Check if initialization was successful
            if result == PCAN_ERROR_OK or result == PCAN_ERROR_CAUTION:
                self.initialized = True
                self.channel = channel
                self.baudrate = baudrate
                self.message_counter = 0
                return {
                    "success": True,
                    "message": f"Channel {channel} initialized successfully at {baudrate}"
                }
            else:
                # Get error message
                error_text = self.pcan.GetErrorText(result)
                return {
                    "success": False,
                    "error": f"Failed to initialize PCAN: {error_text}"
                }
        
        except Exception as e:
            return {
                "success": False,
                "error": f"PCAN initialization error: {str(e)}"
            }
    
    def release(self) -> Dict[str, Any]:
        try:
            if self.initialized:
                result = self.pcan.Uninitialize(self.channel_map[self.channel])
                self.initialized = False
                self.channel = None
                self.baudrate = None
                self.message_counter = 0
                
                if result == PCAN_ERROR_OK:
                    return {
                        "success": True,
                        "message": "Channel released successfully"
                    }
                else:
                    error_text = self.pcan.GetErrorText(result)
                    return {
                        "success": False,
                        "error": f"Failed to release PCAN: {error_text}"
                    }
            else:
                return {
                    "success": False,
                    "error": "PCAN not initialized"
                }
        except Exception as e:
            return {
                "success": False,
                "error": f"Error releasing PCAN: {str(e)}"
            }
    
    def get_status(self) -> Dict[str, Any]:
        if not self.initialized:
            return {
                "status_code": "00001h",
                "status_text": "Not initialized"
            }
        
        try:
            result = self.pcan.GetStatus(self.channel_map[self.channel])
            if result == PCAN_ERROR_OK:
                return {
                    "status_code": "00000h",
                    "status_text": "OK"
                }
            else:
                error_text = self.pcan.GetErrorText(result)
                return {
                    "status_code": "00001h",
                    "status_text": error_text
                }
        except Exception as e:
            return {
                "status_code": "00001h",
                "status_text": str(e)
            }
    
    def read_message(self) -> Dict[str, Any]:
        if not self.initialized:
            return {
                "success": False,
                "message": "PCAN not initialized"
            }
        
        if not self.pcan_available:
            return {
                "success": False,
                "message": "PCAN hardware not available"
            }
        
        try:
            # Call Read() and unpack the tuple (status, message, timestamp)
            result = self.pcan.Read(self.channel_map[self.channel])
            status_code = result[0]
            
            if status_code == PCAN_ERROR_OK:
                self.message_counter += 1
                can_msg = result[1]
                timestamp = result[2]
                
                # Parse message data - get only the bytes indicated by LEN
                data = []
                for i in range(can_msg.LEN):
                    data.append(can_msg.DATA[i])
                
                return {
                    "success": True,
                    "message": {
                        "counter": self.message_counter,
                        "id": f"{can_msg.ID:03X}",
                        "msg_type": "DATA",
                        "len": can_msg.LEN,
                        "data": data,
                        "timestamp": timestamp.value if hasattr(timestamp, 'value') else timestamp
                    }
                }
            elif status_code == PCAN_ERROR_QRCVEMPTY:
                # Queue is empty - not an error condition
                return {
                    "success": True,
                    "message": None  # No message available
                }
            else:
                # Get error message from PCAN
                error_text = self.pcan.GetErrorText(status_code)
                return {
                    "success": False,
                    "message": f"Read error: {error_text}"
                }
        
        except Exception as e:
            return {
                "success": False,
                "message": f"Error reading message: {str(e)}"
            }
    
    def write_message(self, msg_id: str, data: list, extended: bool = False, rtr: bool = False) -> Dict[str, Any]:
        if not self.initialized:
            return {
                "success": False,
                "error": "PCAN not initialized"
            }
        
        try:
            # Parse message ID
            can_id = int(msg_id, 16)
            
            # Create CAN message
            can_msg = TPCANMsg()
            can_msg.ID = can_id
            can_msg.MSGTYPE = PCAN_MESSAGE_STANDARD
            can_msg.LEN = len(data)
            
            # Copy data to message
            for i, byte in enumerate(data):
                if i < 8:
                    can_msg.DATA[i] = byte
            
            # Send message
            result = self.pcan.Write(self.channel_map[self.channel], can_msg)
            
            if result == PCAN_ERROR_OK:
                return {
                    "success": True,
                    "message": f"Message sent successfully - ID: {msg_id}"
                }
            else:
                error_text = self.pcan.GetErrorText(result)
                return {
                    "success": False,
                    "error": f"Failed to send message: {error_text}"
                }
        
        except Exception as e:
            return {
                "success": False,
                "error": f"Error writing message: {str(e)}"
            }

pcan_service = PCANService()
