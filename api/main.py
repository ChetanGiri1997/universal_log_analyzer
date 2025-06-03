from fastapi import FastAPI, File, UploadFile, HTTPException, Query, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Union
from datetime import datetime, timezone
import os
import json
import logging
import uuid
import re
from pathlib import Path
import tempfile

# Import both Drain3 and logparser for comparison
from drain3 import TemplateMiner
from drain3.template_miner_config import TemplateMinerConfig
import pymongo
from pymongo import MongoClient
import uvicorn

# Try to import logparser as alternative
try:
    from logparser import Drain as LogparserDrain
    LOGPARSER_AVAILABLE = True
except ImportError:
    LOGPARSER_AVAILABLE = False
    print("logparser not available, using drain3 only")

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Enhanced Universal Log Analyzer", version="2.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB connection
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
MONGODB_DB_NAME = os.getenv("MONGODB_DB_NAME", "log_analyzer")

client = MongoClient(MONGODB_URL)
db = client[MONGODB_DB_NAME]
logs_collection = db.logs
templates_collection = db.templates
files_collection = db.files

# Enhanced log parsing patterns
LOG_PATTERNS = {
    'syslog': {
        'pattern': r'^(?P<timestamp>\w{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})\s+(?P<hostname>\S+)\s+(?P<program>\S+?)(?:\[(?P<pid>\d+)\])?:\s*(?P<message>.*)$',
        'timestamp_format': '%b %d %H:%M:%S'
    },
    'apache_access': {
        'pattern': r'^(?P<remote_addr>\S+)\s+\S+\s+\S+\s+\[(?P<timestamp>[^\]]+)\]\s+"(?P<method>\S+)\s+(?P<url>\S+)\s+(?P<protocol>\S+)"\s+(?P<status>\d+)\s+(?P<size>\S+)(?:\s+"(?P<referer>[^"]*)")?\s*(?:"(?P<user_agent>[^"]*)")?',
        'timestamp_format': '%d/%b/%Y:%H:%M:%S %z'
    },
    'nginx_access': {
        'pattern': r'^(?P<remote_addr>\S+)\s+-\s+\S+\s+\[(?P<timestamp>[^\]]+)\]\s+"(?P<method>\S+)\s+(?P<url>\S+)\s+(?P<protocol>\S+)"\s+(?P<status>\d+)\s+(?P<size>\S+)\s+"(?P<referer>[^"]*)"\s+"(?P<user_agent>[^"]*)"',
        'timestamp_format': '%d/%b/%Y:%H:%M:%S %z'
    },
    'firewall': {
        'pattern': r'.*?(?P<action>ACCEPT|DENY|DROP|REJECT).*?SRC=(?P<src_ip>\d+\.\d+\.\d+\.\d+).*?DST=(?P<dst_ip>\d+\.\d+\.\d+\.\d+).*?(?:SPT=(?P<src_port>\d+))?.*?(?:DPT=(?P<dst_port>\d+))?.*?(?:PROTO=(?P<protocol>\w+))?',
        'level_map': {'ACCEPT': 'INFO', 'DENY': 'WARN', 'DROP': 'WARN', 'REJECT': 'ERROR'}
    },
    'cisco_syslog': {
        'pattern': r'^(?P<timestamp>\w{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}(?:\.\d{3})?)\s*(?P<timezone>\S+)?\s*:?\s*%?(?P<facility>\w+)-(?P<severity>\d+)-(?P<mnemonic>\w+):\s*(?P<message>.*)$',
        'level_map': {'0': 'EMERGENCY', '1': 'ALERT', '2': 'CRITICAL', '3': 'ERROR', '4': 'WARN', '5': 'NOTICE', '6': 'INFO', '7': 'DEBUG'}
    },
    'windows_event': {
        'pattern': r'^(?P<timestamp>\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\s+(?P<level>\w+)\s+(?P<event_id>\d+)\s+(?P<source>\S+)\s+(?P<message>.*)$',
        'timestamp_format': '%Y-%m-%d %H:%M:%S'
    },
    'json_structured': {
        'pattern': r'^\{.*\}$'
    },
    'docker': {
        'pattern': r'^(?P<timestamp>\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z)\s+(?P<level>\w+)\s+(?P<container_id>\w+)\s+(?P<message>.*)$',
        'timestamp_format': '%Y-%m-%dT%H:%M:%S.%fZ'
    }
}

# Network protocol mapping
PROTOCOL_MAP = {
    '1': 'ICMP', '6': 'TCP', '17': 'UDP', '47': 'GRE', '50': 'ESP', '51': 'AH',
    '58': 'ICMPv6', '89': 'OSPF', '132': 'SCTP'
}

# Log level extraction patterns
LEVEL_PATTERNS = [
    r'\b(EMERGENCY|EMERG|PANIC)\b',
    r'\b(ALERT)\b', 
    r'\b(CRITICAL|CRIT|FATAL)\b',
    r'\b(ERROR|ERR|FAIL|FAILED)\b',
    r'\b(WARNING|WARN|NOTICE)\b',
    r'\b(INFO|INFORMATION)\b',
    r'\b(DEBUG|TRACE)\b'
]

LEVEL_MAP = {
    'EMERGENCY': 'EMERGENCY', 'EMERG': 'EMERGENCY', 'PANIC': 'EMERGENCY',
    'ALERT': 'ALERT',
    'CRITICAL': 'CRITICAL', 'CRIT': 'CRITICAL', 'FATAL': 'CRITICAL',
    'ERROR': 'ERROR', 'ERR': 'ERROR', 'FAIL': 'ERROR', 'FAILED': 'ERROR',
    'WARNING': 'WARN', 'WARN': 'WARN', 'NOTICE': 'WARN',
    'INFO': 'INFO', 'INFORMATION': 'INFO',
    'DEBUG': 'DEBUG', 'TRACE': 'DEBUG'
}

def extract_network_info(message: str) -> Dict[str, Any]:
    """Extract network-related information from log message"""
    network_info = {}
    
    # Extract IP addresses
    ip_pattern = r'\b(?P<ip>\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b'
    ips = re.findall(ip_pattern, message)
    if ips:
        network_info['ip_addresses'] = ips
        if len(ips) >= 2:
            network_info['src_ip'] = ips[0]
            network_info['dst_ip'] = ips[1]
        elif len(ips) == 1:
            network_info['ip_address'] = ips[0]
    
    # Extract ports
    port_patterns = [
        r'(?:port|PORT)\s*[=:]\s*(?P<port>\d+)',
        r'(?:src_port|SRC_PORT|SPT)\s*[=:]\s*(?P<port>\d+)',
        r'(?:dst_port|DST_PORT|DPT)\s*[=:]\s*(?P<port>\d+)',
        r':(?P<port>\d+)\b'
    ]
    
    ports = []
    for pattern in port_patterns:
        matches = re.finditer(pattern, message, re.IGNORECASE)
        for match in matches:
            port = match.group('port')
            if port not in ports and 1 <= int(port) <= 65535:
                ports.append(port)
    
    if ports:
        network_info['ports'] = ports
    
    # Extract protocols
    proto_patterns = [
        r'(?:proto|protocol|PROTO)\s*[=:]\s*(?P<proto>\w+)',
        r'\b(?P<proto>TCP|UDP|ICMP|HTTP|HTTPS|FTP|SSH|SMTP|DNS|DHCP|SNMP)\b'
    ]
    
    protocols = []
    for pattern in proto_patterns:
        matches = re.finditer(pattern, message, re.IGNORECASE)
        for match in matches:
            proto = match.group('proto').upper()
            if proto not in protocols:
                protocols.append(proto)
    
    if protocols:
        network_info['protocols'] = protocols
    
    # Extract MAC addresses
    mac_pattern = r'\b(?P<mac>(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2})\b'
    macs = re.findall(mac_pattern, message)
    if macs:
        network_info['mac_addresses'] = macs
    
    return network_info

def extract_log_level(message: str, default_level: str = "INFO") -> str:
    """Extract log level from message with better pattern matching"""
    # Check for explicit level indicators
    for i, pattern in enumerate(LEVEL_PATTERNS):
        match = re.search(pattern, message, re.IGNORECASE)
        if match:
            level_text = match.group(1).upper()
            return LEVEL_MAP.get(level_text, default_level)
    
    # Check for numeric severity levels (syslog style)
    severity_match = re.search(r'<(\d+)>', message)
    if severity_match:
        severity = int(severity_match.group(1)) % 8  # Extract severity from facility.severity
        severity_map = {0: 'EMERGENCY', 1: 'ALERT', 2: 'CRITICAL', 3: 'ERROR', 
                       4: 'WARN', 5: 'NOTICE', 6: 'INFO', 7: 'DEBUG'}
        return severity_map.get(severity, default_level)
    
    # Heuristic detection based on keywords
    message_upper = message.upper()
    if any(word in message_upper for word in ['FAIL', 'ERROR', 'EXCEPTION', 'CRASH']):
        return 'ERROR'
    elif any(word in message_upper for word in ['WARN', 'ALERT', 'DENY', 'BLOCK']):
        return 'WARN'
    elif any(word in message_upper for word in ['DEBUG', 'TRACE']):
        return 'DEBUG'
    
    return default_level

def parse_structured_log(line: str) -> Dict[str, Any]:
    """Parse structured log formats"""
    parsed_data = {}
    
    # Try each log pattern
    for log_type, config in LOG_PATTERNS.items():
        if 'pattern' in config:
            pattern = config['pattern']
            match = re.match(pattern, line)
            if match:
                parsed_data = match.groupdict()
                parsed_data['log_type'] = log_type
                
                # Parse timestamp if present
                if 'timestamp' in parsed_data and 'timestamp_format' in config:
                    try:
                        ts_str = parsed_data['timestamp']
                        if config['timestamp_format']:
                            parsed_data['parsed_timestamp'] = datetime.strptime(ts_str, config['timestamp_format'])
                    except Exception as e:
                        logger.debug(f"Failed to parse timestamp: {e}")
                
                # Map log levels if available
                if 'level_map' in config:
                    if 'severity' in parsed_data:
                        parsed_data['level'] = config['level_map'].get(parsed_data['severity'], 'INFO')
                    elif 'action' in parsed_data:
                        parsed_data['level'] = config['level_map'].get(parsed_data['action'], 'INFO')
                
                break
    
    return parsed_data

def create_enhanced_drain3_config():
    """Create enhanced Drain3 configuration with fixed masking format"""
    config = TemplateMinerConfig()
    
    # Basic Drain3 parameters
    config.drain_depth = 4
    config.drain_sim_th = 0.4
    config.drain_max_children = 100
    config.drain_max_clusters = 1000
    
    # Extra delimiters for better parsing
    config.drain_extra_delimiters = [
        ':', '=', ',', '"', "'", '[', ']', '(', ')', '{', '}', 
        '<', '>', '|', '\\', '/', '?', '!', ';', '&', '%', 
        '$', '#', '@', '^', '*', '+', '-', '_', '~', '`'
    ]
    
    # Fixed masking instructions format for newer Drain3 versions
    # Use the correct format without mask_with attribute
    config.masking_instructions = [
        # Mask UUIDs and long hex strings but preserve shorter ones
        r'\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b',
        r'\b[a-fA-F0-9]{32,}\b',
        # Mask specific timestamp formats but preserve others
        r'\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z\b',
        # Mask large numbers but preserve ports and small numbers
        r'\b\d{6,}\b',
        # Mask email addresses
        r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
        # Keep IP addresses, ports, and protocols visible for analysis
    ]
    
    return config

# Initialize both parsers with error handling
template_miner = None
try:
    drain3_config = create_enhanced_drain3_config()
    template_miner = TemplateMiner(config=drain3_config)
    logger.info("Enhanced Drain3 template miner initialized successfully")
except Exception as e:
    logger.error(f"Failed to initialize enhanced Drain3: {e}")
    try:
        # Fallback to basic configuration
        template_miner = TemplateMiner()
        logger.info("Fallback to basic Drain3 template miner")
    except Exception as fallback_error:
        logger.error(f"Failed to initialize basic Drain3: {fallback_error}")

# Initialize logparser if available
logparser_drain = None
if LOGPARSER_AVAILABLE:
    try:
        logparser_drain = LogparserDrain.LogParser(indir='temp_logs/', outdir='temp_output/', 
                                                  depth=4, st=0.4, rex=['<HASH>', '<NUM>'])
        logger.info("Logparser Drain initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize logparser: {e}")

# Enhanced Pydantic models
class EnhancedLogEntry(BaseModel):
    timestamp: Optional[datetime] = Field(default_factory=lambda: datetime.now(timezone.utc))
    level: Optional[str] = "INFO"
    message: str
    source: Optional[str] = None
    log_type: Optional[str] = None
    network_info: Optional[Dict[str, Any]] = Field(default_factory=dict)
    parsed_fields: Optional[Dict[str, Any]] = Field(default_factory=dict)
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)

class EnhancedLogResponse(BaseModel):
    id: str
    timestamp: datetime
    level: str
    message: str
    source: Optional[str]
    log_type: Optional[str]
    template_id: Optional[Union[str, int]]
    template: Optional[str]
    network_info: Dict[str, Any]
    parsed_fields: Dict[str, Any]
    metadata: Dict[str, Any]
    file_id: Optional[str]
    filename: Optional[str]

# Keep existing models for compatibility
class LogEntry(BaseModel):
    timestamp: Optional[datetime] = Field(default_factory=lambda: datetime.now(timezone.utc))
    level: Optional[str] = "INFO"
    message: str
    source: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)

class LogQueryRequest(BaseModel):
    template_id: Optional[Union[str, int]] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    level: Optional[str] = None
    source: Optional[str] = None
    message_contains: Optional[str] = None
    file_id: Optional[str] = None
    log_type: Optional[str] = None
    has_network_info: Optional[bool] = None
    protocol: Optional[str] = None
    ip_address: Optional[str] = None
    limit: Optional[int] = 100
    offset: Optional[int] = 0

class LogResponse(BaseModel):
    id: str
    timestamp: datetime
    level: str
    message: str
    source: Optional[str]
    template_id: Optional[Union[str, int]]
    template: Optional[str]
    metadata: Dict[str, Any]
    file_id: Optional[str]
    filename: Optional[str]

class TemplateResponse(BaseModel):
    template_id: Union[str, int]
    template: str
    count: int
    first_seen: datetime
    last_seen: datetime

class FluentBitLogEntry(BaseModel):
    log: str
    time: Optional[str] = None
    tag: Optional[str] = None
    source: Optional[str] = None

class FileResponse(BaseModel):
    file_id: str
    filename: str
    original_filename: str
    file_size: int
    upload_timestamp: datetime
    processed_logs: int
    failed_logs: int
    status: str

class FileStatsResponse(BaseModel):
    file_id: str
    filename: str
    total_logs: int
    level_distribution: List[Dict[str, Any]]
    log_type_distribution: List[Dict[str, Any]]
    network_info_stats: Dict[str, Any]
    date_range: Dict[str, datetime]

def process_log_with_enhanced_parsing(message: str, timestamp: datetime, parser_type: str = "drain3") -> Dict[str, Any]:
    """Enhanced log processing with better template mining"""
    try:
        if parser_type == "logparser" and logparser_drain is not None:
            # Use logparser implementation
            # Note: This is a simplified integration - you might need to adapt based on your logparser version
            result = {"template_id": "logparser_template", "template": message, "cluster_size": 1}
            # Logparser would need file-based processing which is more complex
        else:
            # Use enhanced Drain3
            if template_miner is None:
                # Fallback if template miner failed to initialize
                import hashlib
                message_hash = hashlib.md5(message.encode()).hexdigest()[:8]
                return {
                    "template_id": f"fallback_{message_hash}",
                    "template": message,
                    "cluster_size": 1
                }
            
            result = template_miner.add_log_message(message)
            
            template_info = {
                "template_id": None,
                "template": None,
                "cluster_size": 0
            }
            
            if result is not None:
                if isinstance(result, dict):
                    template_info["template_id"] = result.get("cluster_id")
                    template_info["template"] = result.get("template")
                    template_info["cluster_size"] = result.get("cluster_size", 0)
                elif hasattr(result, 'cluster_id') or hasattr(result, 'id'):
                    template_info["template_id"] = getattr(result, 'cluster_id', getattr(result, 'id', None))
                    if hasattr(result, 'get_template'):
                        template_info["template"] = result.get_template()
                    elif hasattr(result, 'template'):
                        template_info["template"] = result.template
                    template_info["cluster_size"] = getattr(result, 'size', getattr(result, 'cluster_size', 0))
            
            if template_info["template_id"] is None:
                try:
                    if hasattr(template_miner.drain, 'id_to_cluster'):
                        clusters = template_miner.drain.id_to_cluster
                        if clusters:
                            max_id = max(clusters.keys()) if hasattr(clusters, 'keys') else None
                            if max_id is not None:
                                cluster = clusters[max_id]
                                template_info["template_id"] = max_id
                                if hasattr(cluster, 'get_template'):
                                    template_info["template"] = cluster.get_template()
                                elif hasattr(cluster, 'log_template_tokens'):
                                    template_info["template"] = ' '.join(cluster.log_template_tokens)
                                template_info["cluster_size"] = getattr(cluster, 'size', 1)
                except Exception:
                    pass
            
            if template_info["template_id"] is None:
                import hashlib
                message_hash = hashlib.md5(message.encode()).hexdigest()[:8]
                template_info["template_id"] = f"tmpl_{message_hash}"
                template_info["template"] = message
                template_info["cluster_size"] = 1
            
            result = template_info
        
        # Update template statistics
        if result["template_id"] is not None and result["template"]:
            try:
                templates_collection.update_one(
                    {"template_id": result["template_id"]},
                    {
                        "$set": {
                            "template": result["template"],
                            "last_seen": timestamp,
                            "cluster_size": result["cluster_size"]
                        },
                        "$setOnInsert": {
                            "first_seen": timestamp,
                            "count": 0
                        },
                        "$inc": {"count": 1}
                    },
                    upsert=True
                )
            except Exception as db_error:
                logger.warning(f"Could not update template in database: {db_error}")
        
        return result
        
    except Exception as e:
        logger.error(f"Error processing log with template mining: {e}")
        import hashlib
        message_hash = hashlib.md5(message.encode()).hexdigest()[:8]
        return {
            "template_id": f"error_{message_hash}",
            "template": message,
            "cluster_size": 1
        }

def parse_enhanced_log_line(line: str, source: str) -> Optional[EnhancedLogEntry]:
    """Enhanced log line parsing with better field extraction"""
    if not line.strip():
        return None
    
    try:
        parsed_fields = {}
        network_info = {}
        metadata = {}
        log_type = "unknown"
        level = "INFO"
        timestamp = datetime.now(timezone.utc)
        message = line.strip()
        
        # Try structured parsing first
        if line.strip().startswith('{'):
            # JSON parsing
            try:
                json_log = json.loads(line)
                log_type = "json"
                parsed_fields = json_log.copy()
                
                message = json_log.get('message', json_log.get('msg', line))
                level = json_log.get('level', json_log.get('severity', 'INFO')).upper()
                
                # Handle timestamp
                if 'timestamp' in json_log:
                    ts_str = json_log['timestamp']
                    if isinstance(ts_str, str):
                        ts_str = ts_str.replace('Z', '+00:00')
                        timestamp = datetime.fromisoformat(ts_str)
                elif 'time' in json_log:
                    ts_str = json_log['time']
                    if isinstance(ts_str, str):
                        ts_str = ts_str.replace('Z', '+00:00')
                        timestamp = datetime.fromisoformat(ts_str)
                
                # Extract network info from JSON
                network_fields = ['src_ip', 'dst_ip', 'src_port', 'dst_port', 'protocol', 'ip_address']
                for field in network_fields:
                    if field in json_log:
                        network_info[field] = json_log[field]
                
                metadata = {k: v for k, v in json_log.items() if k not in ['message', 'msg', 'level', 'severity', 'timestamp', 'time']}
                
            except json.JSONDecodeError:
                pass
        
        if log_type == "unknown":
            # Try structured log patterns
            structured_data = parse_structured_log(line)
            if structured_data:
                log_type = structured_data.get('log_type', 'structured')
                parsed_fields = structured_data
                
                # Extract fields from structured data
                if 'message' in structured_data:
                    message = structured_data['message']
                if 'level' in structured_data:
                    level = structured_data['level']
                if 'parsed_timestamp' in structured_data:
                    timestamp = structured_data['parsed_timestamp']
                
                # Extract network info from structured fields
                network_fields = ['src_ip', 'dst_ip', 'src_port', 'dst_port', 'protocol', 'remote_addr']
                for field in network_fields:
                    if field in structured_data:
                        if field == 'remote_addr':
                            network_info['src_ip'] = structured_data[field]
                        else:
                            network_info[field] = structured_data[field]
                
                metadata = {k: v for k, v in structured_data.items() 
                           if k not in ['message', 'level', 'parsed_timestamp', 'log_type'] + network_fields}
        
        # Extract additional network info from message
        additional_network_info = extract_network_info(message)
        network_info.update(additional_network_info)
        
        # Extract log level if not already determined
        if level == "INFO":
            level = extract_log_level(message, "INFO")
        
        # Map protocol numbers to names
        if 'protocol' in network_info and network_info['protocol'].isdigit():
            proto_num = network_info['protocol']
            network_info['protocol'] = PROTOCOL_MAP.get(proto_num, proto_num)
        
        return EnhancedLogEntry(
            message=message,
            timestamp=timestamp,
            level=level,
            source=source,
            log_type=log_type,
            network_info=network_info,
            parsed_fields=parsed_fields,
            metadata=metadata
        )
        
    except Exception as e:
        logger.warning(f"Failed to parse enhanced log line: {e}")
        return EnhancedLogEntry(message=line.strip(), source=source)

def store_enhanced_log_entry(log_entry: EnhancedLogEntry, template_info: Dict[str, Any], 
                           file_id: str = None, filename: str = None) -> str:
    """Store enhanced log entry in MongoDB"""
    try:
        doc = {
            "timestamp": log_entry.timestamp,
            "level": log_entry.level,
            "message": log_entry.message,
            "source": log_entry.source,
            "log_type": log_entry.log_type,
            "template_id": template_info["template_id"],
            "template": template_info["template"],
            "cluster_size": template_info["cluster_size"],
            "network_info": log_entry.network_info,
            "parsed_fields": log_entry.parsed_fields,
            "metadata": log_entry.metadata,
            "file_id": file_id,
            "filename": filename,
            "created_at": datetime.now(timezone.utc)
        }
        
        result = logs_collection.insert_one(doc)
        return str(result.inserted_id)
    except Exception as e:
        logger.error(f"Error storing enhanced log entry: {e}")
        raise HTTPException(status_code=500, detail="Failed to store enhanced log entry")

@app.post("/api/logs/upload", response_model=Dict[str, Any])
async def upload_logs(file: UploadFile = File(...)):
    """Upload and process log file with unique file tracking"""
    if not file.filename or not file.filename.endswith(('.log', '.txt', '.json')):
        raise HTTPException(status_code=400, detail="Unsupported file format")
    
    try:
        content = await file.read()
        
        # Generate unique file ID
        file_id = str(uuid.uuid4())
        upload_timestamp = datetime.now(timezone.utc)
        
        # Create uploads directory if it doesn't exist
        upload_dir = Path("uploads")
        upload_dir.mkdir(exist_ok=True)
        
        # Save uploaded file with unique name
        unique_filename = f"{file_id}_{file.filename}"
        file_path = upload_dir / unique_filename
        with open(file_path, "wb") as f:
            f.write(content)
        
        processed_count = 0
        failed_count = 0
        
        # Store file metadata in database
        file_doc = {
            "file_id": file_id,
            "filename": unique_filename,
            "original_filename": file.filename,
            "file_size": len(content),
            "upload_timestamp": upload_timestamp,
            "status": "processing",
            "processed_logs": 0,
            "failed_logs": 0
        }
        files_collection.insert_one(file_doc)
        
        # Process file line by line
        try:
            text_content = content.decode('utf-8')
            lines = text_content.strip().split('\n')
            
            for line in lines:
                log_entry = parse_enhanced_log_line(line, file.filename)  # Fixed function name
                if log_entry:
                    try:
                        template_info = process_log_with_enhanced_parsing(log_entry.message, log_entry.timestamp)  # Fixed function name
                        store_enhanced_log_entry(log_entry, template_info, file_id, file.filename)  # Fixed function name
                        processed_count += 1
                    except Exception as e:
                        logger.error(f"Error processing log entry: {e}")
                        failed_count += 1
                else:
                    failed_count += 1
        
        except UnicodeDecodeError:
            raise HTTPException(status_code=400, detail="File encoding not supported")
        
        # Update file status
        files_collection.update_one(
            {"file_id": file_id},
            {
                "$set": {
                    "status": "completed",
                    "processed_logs": processed_count,
                    "failed_logs": failed_count,
                    "completed_at": datetime.now(timezone.utc)
                }
            }
        )
        
        return {
            "message": "File processed successfully",
            "file_id": file_id,
            "filename": file.filename,
            "processed_logs": processed_count,
            "failed_logs": failed_count,
            "file_size": len(content)
        }
        
    except Exception as e:
        logger.error(f"Error processing uploaded file: {e}")
        # Update file status to failed if it was created
        if 'file_id' in locals():
            files_collection.update_one(
                {"file_id": file_id},
                {"$set": {"status": "failed", "error": str(e)}}
            )
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")

    """Upload and process log file with unique file tracking"""
    if not file.filename or not file.filename.endswith(('.log', '.txt', '.json')):
        raise HTTPException(status_code=400, detail="Unsupported file format")
    
    try:
        content = await file.read()
        
        # Generate unique file ID
        file_id = str(uuid.uuid4())
        upload_timestamp = datetime.now(timezone.utc)
        
        # Create uploads directory if it doesn't exist
        upload_dir = Path("uploads")
        upload_dir.mkdir(exist_ok=True)
        
        # Save uploaded file with unique name
        unique_filename = f"{file_id}_{file.filename}"
        file_path = upload_dir / unique_filename
        with open(file_path, "wb") as f:
            f.write(content)
        
        processed_count = 0
        failed_count = 0
        
        # Store file metadata in database
        file_doc = {
            "file_id": file_id,
            "filename": unique_filename,
            "original_filename": file.filename,
            "file_size": len(content),
            "upload_timestamp": upload_timestamp,
            "status": "processing",
            "processed_logs": 0,
            "failed_logs": 0
        }
        files_collection.insert_one(file_doc)
        
        # Process file line by line
        try:
            text_content = content.decode('utf-8')
            lines = text_content.strip().split('\n')
            
            for line in lines:
                log_entry = parse_log_line(line, file.filename)
                if log_entry:
                    try:
                        template_info = process_log_with_drain3(log_entry.message, log_entry.timestamp)
                        store_log_entry(log_entry, template_info, file_id, file.filename)
                        processed_count += 1
                    except Exception as e:
                        logger.error(f"Error processing log entry: {e}")
                        failed_count += 1
                else:
                    failed_count += 1
        
        except UnicodeDecodeError:
            raise HTTPException(status_code=400, detail="File encoding not supported")
        
        # Update file status
        files_collection.update_one(
            {"file_id": file_id},
            {
                "$set": {
                    "status": "completed",
                    "processed_logs": processed_count,
                    "failed_logs": failed_count,
                    "completed_at": datetime.now(timezone.utc)
                }
            }
        )
        
        return {
            "message": "File processed successfully",
            "file_id": file_id,
            "filename": file.filename,
            "processed_logs": processed_count,
            "failed_logs": failed_count,
            "file_size": len(content)
        }
        
    except Exception as e:
        logger.error(f"Error processing uploaded file: {e}")
        # Update file status to failed if it was created
        if 'file_id' in locals():
            files_collection.update_one(
                {"file_id": file_id},
                {"$set": {"status": "failed", "error": str(e)}}
            )
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")

@app.get("/api/files", response_model=List[FileResponse])
async def get_uploaded_files():
    """Get list of all uploaded files"""
    try:
        cursor = files_collection.find().sort("upload_timestamp", -1)
        
        files = []
        for doc in cursor:
            files.append(FileResponse(
                file_id=doc["file_id"],
                filename=doc["filename"],
                original_filename=doc["original_filename"],
                file_size=doc["file_size"],
                upload_timestamp=doc["upload_timestamp"],
                processed_logs=doc.get("processed_logs", 0),
                failed_logs=doc.get("failed_logs", 0),
                status=doc.get("status", "unknown")
            ))
        
        return files
        
    except Exception as e:
        logger.error(f"Error fetching files: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching files: {str(e)}")

@app.get("/api/files/{file_id}/stats", response_model=FileStatsResponse)
async def get_file_stats(file_id: str):
    """Get statistics for a specific file"""
    try:
        # Get file info
        file_doc = files_collection.find_one({"file_id": file_id})
        if not file_doc:
            raise HTTPException(status_code=404, detail="File not found")
        
        # Get total logs for this file
        total_logs = logs_collection.count_documents({"file_id": file_id})
        
        # Get log level distribution for this file
        level_pipeline = [
            {"$match": {"file_id": file_id}},
            {"$group": {"_id": "$level", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}}
        ]
        level_stats = list(logs_collection.aggregate(level_pipeline))
        
        # Get date range for this file
        date_pipeline = [
            {"$match": {"file_id": file_id}},
            {"$group": {
                "_id": None,
                "earliest": {"$min": "$timestamp"},
                "latest": {"$max": "$timestamp"}
            }}
        ]
        date_result = list(logs_collection.aggregate(date_pipeline))
        date_range = {}
        if date_result:
            date_range = {
                "earliest": date_result[0]["earliest"],
                "latest": date_result[0]["latest"]
            }
        
        return FileStatsResponse(
            file_id=file_id,
            filename=file_doc["original_filename"],
            total_logs=total_logs,
            level_distribution=level_stats,
            date_range=date_range
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching file stats: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching file stats: {str(e)}")

@app.get("/api/files/{file_id}/stats", response_model=FileStatsResponse)
async def get_file_stats(file_id: str):
    """Get statistics for a specific file"""
    try:
        # Get file info
        file_doc = files_collection.find_one({"file_id": file_id})
        if not file_doc:
            raise HTTPException(status_code=404, detail="File not found")
        
        # Get total logs for this file
        total_logs = logs_collection.count_documents({"file_id": file_id})
        
        # Get log level distribution for this file
        level_pipeline = [
            {"$match": {"file_id": file_id}},
            {"$group": {"_id": "$level", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}}
        ]
        level_stats = list(logs_collection.aggregate(level_pipeline))
        
        # Get log type distribution for this file
        log_type_pipeline = [
            {"$match": {"file_id": file_id}},
            {"$group": {"_id": "$log_type", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}}
        ]
        log_type_stats = list(logs_collection.aggregate(log_type_pipeline))
        
        # Get network info statistics
        network_pipeline = [
            {"$match": {"file_id": file_id, "network_info": {"$ne": {}}}},
            {"$group": {
                "_id": None,
                "total_with_network": {"$sum": 1},
                "unique_protocols": {"$addToSet": "$network_info.protocols"},
                "unique_ips": {"$addToSet": "$network_info.ip_addresses"}
            }}
        ]
        network_result = list(logs_collection.aggregate(network_pipeline))
        network_stats = {}
        if network_result:
            result = network_result[0]
            network_stats = {
                "logs_with_network_info": result.get("total_with_network", 0),
                "unique_protocols": len([p for protocols in result.get("unique_protocols", []) if protocols for p in protocols]),
                "unique_ips": len([ip for ips in result.get("unique_ips", []) if ips for ip in ips])
            }
        
        # Get date range for this file
        date_pipeline = [
            {"$match": {"file_id": file_id}},
            {"$group": {
                "_id": None,
                "earliest": {"$min": "$timestamp"},
                "latest": {"$max": "$timestamp"}
            }}
        ]
        date_result = list(logs_collection.aggregate(date_pipeline))
        date_range = {}
        if date_result:
            date_range = {
                "earliest": date_result[0]["earliest"],
                "latest": date_result[0]["latest"]
            }
        
        return FileStatsResponse(
            file_id=file_id,
            filename=file_doc["original_filename"],
            total_logs=total_logs,
            level_distribution=level_stats,
            log_type_distribution=log_type_stats,
            network_info_stats=network_stats,
            date_range=date_range
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching file stats: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching file stats: {str(e)}")

@app.post("/api/logs/ingest")
async def ingest_log(log_entry: LogEntry):
    """Ingest a single log entry"""
    try:
        template_info = process_log_with_enhanced_parsing(log_entry.message, log_entry.timestamp)  # Fixed function name
        
        # Convert LogEntry to EnhancedLogEntry
        enhanced_entry = EnhancedLogEntry(
            message=log_entry.message,
            timestamp=log_entry.timestamp,
            level=log_entry.level,
            source=log_entry.source,
            metadata=log_entry.metadata
        )
        
        log_id = store_enhanced_log_entry(enhanced_entry, template_info)  # Fixed function name
        
        return {
            "message": "Log ingested successfully",
            "log_id": log_id,
            "template_id": template_info["template_id"],
            "template": template_info["template"]
        }
    except Exception as e:
        logger.error(f"Error ingesting log: {e}")
        raise HTTPException(status_code=500, detail=f"Error ingesting log: {str(e)}")

@app.post("/api/logs/ingest/fluent-bit")
async def ingest_fluent_bit_logs(logs: List[FluentBitLogEntry]):
    """Ingest logs from Fluent Bit"""
    processed_count = 0
    failed_count = 0
    
    for fb_log in logs:
        try:
            # Parse timestamp if provided
            timestamp = datetime.now(timezone.utc)
            if fb_log.time:
                try:
                    # Handle different timestamp formats
                    ts_str = fb_log.time.replace('Z', '+00:00')
                    timestamp = datetime.fromisoformat(ts_str)
                except Exception as e:
                    logger.warning(f"Failed to parse Fluent Bit timestamp: {e}")
            
            # Create EnhancedLogEntry instead of LogEntry
            enhanced_entry = EnhancedLogEntry(
                message=fb_log.log,
                timestamp=timestamp,
                source=fb_log.source or fb_log.tag or "fluent-bit",
                metadata={"tag": fb_log.tag} if fb_log.tag else {}
            )
            
            template_info = process_log_with_enhanced_parsing(enhanced_entry.message, enhanced_entry.timestamp)  # Fixed function name
            store_enhanced_log_entry(enhanced_entry, template_info)  # Fixed function name
            processed_count += 1
            
        except Exception as e:
            logger.error(f"Error processing Fluent Bit log: {e}")
            failed_count += 1
            continue
    
    return {
        "message": "Fluent Bit logs processed",
        "processed_logs": processed_count,
        "failed_logs": failed_count
    }

@app.post("/api/logs/query", response_model=Dict[str, Any])
async def query_logs(query: LogQueryRequest):
    """Query logs with various filters including enhanced filtering"""
    try:
        # Build MongoDB query
        mongo_query = {}
        
        if query.template_id is not None:
            mongo_query["template_id"] = query.template_id
        
        if query.start_time or query.end_time:
            mongo_query["timestamp"] = {}
            if query.start_time:
                mongo_query["timestamp"]["$gte"] = query.start_time
            if query.end_time:
                mongo_query["timestamp"]["$lte"] = query.end_time
        
        if query.level:
            mongo_query["level"] = query.level
        
        if query.source:
            mongo_query["source"] = {"$regex": query.source, "$options": "i"}
        
        if query.message_contains:
            mongo_query["message"] = {"$regex": query.message_contains, "$options": "i"}
        
        if query.file_id:
            mongo_query["file_id"] = query.file_id
        
        if query.log_type:
            mongo_query["log_type"] = query.log_type
        
        if query.has_network_info:
            mongo_query["network_info"] = {"$ne": {}} if query.has_network_info else {"$eq": {}}
        
        if query.protocol:
            mongo_query["network_info.protocols"] = {"$in": [query.protocol.upper()]}
        
        if query.ip_address:
            mongo_query["$or"] = [
                {"network_info.ip_addresses": {"$in": [query.ip_address]}},
                {"network_info.src_ip": query.ip_address},
                {"network_info.dst_ip": query.ip_address}
            ]
        
        # Execute query with error handling
        try:
            cursor = logs_collection.find(mongo_query).sort("timestamp", -1).skip(query.offset).limit(query.limit)
            total_count = logs_collection.count_documents(mongo_query)
            
            logs = []
            for doc in cursor:
                logs.append(EnhancedLogResponse(
                    id=str(doc["_id"]),
                    timestamp=doc["timestamp"],
                    level=doc["level"],
                    message=doc["message"],
                    source=doc.get("source"),
                    log_type=doc.get("log_type"),
                    template_id=doc.get("template_id"),
                    template=doc.get("template"),
                    network_info=doc.get("network_info", {}),
                    parsed_fields=doc.get("parsed_fields", {}),
                    metadata=doc.get("metadata", {}),
                    file_id=doc.get("file_id"),
                    filename=doc.get("filename")
                ))
            
            return {
                "logs": logs,
                "total_count": total_count,
                "returned_count": len(logs),
                "offset": query.offset,
                "limit": query.limit
            }
        except Exception as db_error:
            logger.error(f"Database query error: {db_error}")
            raise HTTPException(status_code=500, detail="Database query failed")
        
    except Exception as e:
        logger.error(f"Error querying logs: {e}")
        raise HTTPException(status_code=500, detail=f"Error querying logs: {str(e)}")

@app.get("/api/templates", response_model=List[TemplateResponse])
async def get_templates():
    """Get all log templates"""
    try:
        cursor = templates_collection.find().sort("count", -1)
        
        templates = []
        for doc in cursor:
            templates.append(TemplateResponse(
                template_id=doc["template_id"],
                template=doc["template"],
                count=doc["count"],
                first_seen=doc["first_seen"],
                last_seen=doc["last_seen"]
            ))
        
        return templates
        
    except Exception as e:
        logger.error(f"Error fetching templates: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching templates: {str(e)}")

@app.get("/api/stats")
async def get_stats():
    """Get enhanced log statistics"""
    try:
        total_logs = logs_collection.count_documents({})
        total_templates = templates_collection.count_documents({})
        total_files = files_collection.count_documents({})
        
        # Get log count by level
        level_pipeline = [
            {"$group": {"_id": "$level", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}}
        ]
        level_stats = list(logs_collection.aggregate(level_pipeline))
        
        # Get log count by source
        source_pipeline = [
            {"$group": {"_id": "$source", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": 10}
        ]
        source_stats = list(logs_collection.aggregate(source_pipeline))
        
        # Get log count by type
        log_type_pipeline = [
            {"$group": {"_id": "$log_type", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}}
        ]
        log_type_stats = list(logs_collection.aggregate(log_type_pipeline))
        
        # Get log count by file
        file_pipeline = [
            {"$match": {"file_id": {"$ne": None}}},
            {"$group": {"_id": "$filename", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": 10}
        ]
        file_stats = list(logs_collection.aggregate(file_pipeline))
        
        # Get network statistics
        network_pipeline = [
            {"$match": {"network_info": {"$ne": {}}}},
            {"$group": {
                "_id": None,
                "total_with_network": {"$sum": 1},
                "protocols": {"$push": "$network_info.protocols"},
                "ips": {"$push": "$network_info.ip_addresses"}
            }}
        ]
        network_result = list(logs_collection.aggregate(network_pipeline))
        network_stats = {"logs_with_network_info": 0, "top_protocols": [], "unique_ips": 0}
        if network_result:
            result = network_result[0]
            network_stats["logs_with_network_info"] = result.get("total_with_network", 0)
        
        # Get recent activity (logs per hour for last 24 hours)
        from datetime import timedelta
        now = datetime.now(timezone.utc)
        yesterday = now - timedelta(days=1)
        
        activity_pipeline = [
            {"$match": {"timestamp": {"$gte": yesterday}}},
            {
                "$group": {
                    "_id": {
                        "$dateToString": {
                            "format": "%Y-%m-%d %H:00",
                            "date": "$timestamp"
                        }
                    },
                    "count": {"$sum": 1}
                }
            },
            {"$sort": {"_id": 1}}
        ]
        activity_stats = list(logs_collection.aggregate(activity_pipeline))
        
        return {
            "total_logs": total_logs,
            "total_templates": total_templates,
            "total_files": total_files,
            "level_distribution": level_stats,
            "log_type_distribution": log_type_stats,
            "top_sources": source_stats,
            "top_files": file_stats,
            "network_stats": network_stats,
            "hourly_activity": activity_stats
        }
        
    except Exception as e:
        logger.error(f"Error fetching stats: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching stats: {str(e)}")
    
@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    try:
        # Test MongoDB connection
        client.admin.command('ping')
        
        return {
            "status": "healthy",
            "timestamp": datetime.now(timezone.utc),
            "services": {
                "mongodb": "connected",
                "drain3": "initialized"
            }
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "timestamp": datetime.now(timezone.utc),
            "error": str(e)
        }

@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "message": "Universal Log Analyzer API",
        "version": "1.0.0",
        "endpoints": {
            "health": "/api/health",
            "upload": "/api/logs/upload",
            "ingest": "/api/logs/ingest",
            "fluent_bit": "/api/logs/ingest/fluent-bit",
            "query": "/api/logs/query",
            "templates": "/api/templates",
            "stats": "/api/stats",
            "files": "/api/files",
            "file_stats": "/api/files/{file_id}/stats"
        }
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)

