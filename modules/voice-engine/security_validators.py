#!/usr/bin/env python3
"""
Security Validators Library
Comprehensive input validation and security controls for Coqui TTS
"""

import os
import re
import hashlib
from pathlib import Path
from typing import Optional, List, Dict, Any
import logging

# Configure security logging
security_logger = logging.getLogger('tts.security')
security_logger.setLevel(logging.INFO)

class SecurityError(Exception):
    """Custom exception for security violations"""
    pass

class PathTraversalError(SecurityError):
    """Raised when path traversal attack is detected"""
    pass

class InputValidationError(SecurityError):
    """Raised when input validation fails"""
    pass

class ResourceExhaustionError(SecurityError):
    """Raised when resource limits are exceeded"""
    pass

class SecurityValidator:
    """Comprehensive security validation for TTS service"""
    
    # Security patterns to block
    INJECTION_PATTERNS = [
        # Command injection
        r'[;&|`$(){}[\]<>]',
        # Path traversal
        r'\.\./|\.\.\\'
        # Template injection
        r'\{\{.*\}\}',
        # XSS patterns
        r'<script.*?>.*?</script>',
        r'javascript:',
        r'on\w+\s*=',
        # SQL injection
        r'(\bunion\b|\bselect\b|\binsert\b|\bdelete\b|\bdrop\b).*(\bfrom\b|\btable\b)',
    ]
    
    # Allowed file extensions for audio files
    ALLOWED_EXTENSIONS = {'.wav', '.mp3', '.ogg', '.flac', '.m4a'}
    
    # Maximum limits
    MAX_TEXT_LENGTH = 10000  # characters
    MAX_FILENAME_LENGTH = 255
    MAX_PATH_LENGTH = 4096
    MAX_CACHE_SIZE_MB = 100
    MAX_INDIVIDUAL_FILE_SIZE_MB = 10
    
    def __init__(self, base_directory: str):
        """
        Initialize security validator
        
        Args:
            base_directory: Safe base directory for file operations
        """
        self.base_directory = Path(base_directory).resolve()
        self.base_directory.mkdir(parents=True, exist_ok=True)
        
        # Compile regex patterns for performance
        self.injection_regex = re.compile('|'.join(self.INJECTION_PATTERNS), re.IGNORECASE)
        
        security_logger.info(f"Security validator initialized with base directory: {self.base_directory}")
    
    def validate_text_input(self, text: str) -> str:
        """
        Validate text input for synthesis
        
        Args:
            text: Input text to validate
            
        Returns:
            Sanitized text
            
        Raises:
            InputValidationError: If validation fails
        """
        if not isinstance(text, str):
            raise InputValidationError("Text input must be a string")
        
        # Check length
        if len(text) > self.MAX_TEXT_LENGTH:
            security_logger.warning(f"Text too long: {len(text)} > {self.MAX_TEXT_LENGTH}")
            raise InputValidationError(f"Text too long: {len(text)} characters > {self.MAX_TEXT_LENGTH} limit")
        
        # Check for empty input
        if not text.strip():
            raise InputValidationError("Empty text input not allowed")
        
        # Check for injection patterns
        if self.injection_regex.search(text):
            security_logger.warning(f"Injection pattern detected in text: {text[:100]}...")
            raise InputValidationError("Potentially malicious patterns detected in text input")
        
        # Sanitize text (remove control characters except newlines and tabs)
        sanitized = re.sub(r'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', '', text)
        
        if sanitized != text:
            security_logger.info("Text sanitized: removed control characters")
        
        return sanitized
    
    def validate_file_path(self, file_path: str, allow_create: bool = True) -> Path:
        """
        Validate file path to prevent directory traversal
        
        Args:
            file_path: Path to validate
            allow_create: Whether to allow creating new files
            
        Returns:
            Validated Path object
            
        Raises:
            PathTraversalError: If path traversal detected
            InputValidationError: If path is invalid
        """
        if not isinstance(file_path, str):
            raise InputValidationError("File path must be a string")
        
        # Check path length
        if len(file_path) > self.MAX_PATH_LENGTH:
            raise InputValidationError(f"Path too long: {len(file_path)} > {self.MAX_PATH_LENGTH}")
        
        try:
            # Resolve and normalize path
            requested_path = Path(file_path).resolve()
            
            # Check if path is within allowed base directory
            try:
                requested_path.relative_to(self.base_directory)
            except ValueError:
                security_logger.warning(f"Path traversal attempt: {file_path} -> {requested_path}")
                raise PathTraversalError(f"Path outside allowed directory: {file_path}")
            
            # Validate filename
            filename = requested_path.name
            if len(filename) > self.MAX_FILENAME_LENGTH:
                raise InputValidationError(f"Filename too long: {len(filename)} > {self.MAX_FILENAME_LENGTH}")
            
            # Check for invalid characters in filename
            if re.search(r'[<>:"|?*\x00-\x1f]', filename):
                raise InputValidationError(f"Invalid characters in filename: {filename}")
            
            # Validate file extension if specified
            if requested_path.suffix and requested_path.suffix.lower() not in self.ALLOWED_EXTENSIONS:
                raise InputValidationError(f"File extension not allowed: {requested_path.suffix}")
            
            # Check if file exists (for read operations)
            if not allow_create and not requested_path.exists():
                raise InputValidationError(f"File does not exist: {requested_path}")
            
            return requested_path
            
        except OSError as e:
            raise InputValidationError(f"Invalid path: {e}")
    
    def validate_cache_limits(self, cache_info: Dict[str, Any]) -> bool:
        """
        Validate cache size limits to prevent resource exhaustion
        
        Args:
            cache_info: Dictionary with cache statistics
            
        Returns:
            True if within limits
            
        Raises:
            ResourceExhaustionError: If limits exceeded
        """
        total_files = cache_info.get('file_count', 0)
        total_size_mb = cache_info.get('total_size_mb', 0)
        
        # Check file count limit
        if total_files > 50:  # Reasonable limit for file count
            raise ResourceExhaustionError(f"Too many cached files: {total_files} > 50")
        
        # Check total size limit
        if total_size_mb > self.MAX_CACHE_SIZE_MB:
            raise ResourceExhaustionError(f"Cache size exceeded: {total_size_mb}MB > {self.MAX_CACHE_SIZE_MB}MB")
        
        return True
    
    def validate_file_size(self, file_path: Path) -> bool:
        """
        Validate individual file size
        
        Args:
            file_path: Path to file to check
            
        Returns:
            True if size is acceptable
            
        Raises:
            ResourceExhaustionError: If file too large
        """
        if not file_path.exists():
            return True  # File doesn't exist yet
        
        size_mb = file_path.stat().st_size / (1024 * 1024)
        if size_mb > self.MAX_INDIVIDUAL_FILE_SIZE_MB:
            raise ResourceExhaustionError(f"File too large: {size_mb:.2f}MB > {self.MAX_INDIVIDUAL_FILE_SIZE_MB}MB")
        
        return True
    
    def generate_safe_cache_key(self, text: str, model: str) -> str:
        """
        Generate safe cache key from text and model
        
        Args:
            text: Input text
            model: Model name
            
        Returns:
            Safe cache key
        """
        # Validate inputs first
        validated_text = self.validate_text_input(text)
        
        # Create hash of content
        content = f"{model}:{validated_text}"
        return hashlib.sha256(content.encode('utf-8')).hexdigest()[:16]
    
    def validate_model_name(self, model_name: str) -> str:
        """
        Validate TTS model name
        
        Args:
            model_name: Name of TTS model
            
        Returns:
            Validated model name
            
        Raises:
            InputValidationError: If model name invalid
        """
        if not isinstance(model_name, str):
            raise InputValidationError("Model name must be a string")
        
        # Allow only alphanumeric, underscore, hyphen
        if not re.match(r'^[a-zA-Z0-9_-]+$', model_name):
            raise InputValidationError(f"Invalid model name: {model_name}")
        
        if len(model_name) > 50:
            raise InputValidationError(f"Model name too long: {len(model_name)} > 50")
        
        return model_name
    
    def validate_python_executable(self, python_path: str) -> str:
        """
        Validate Python executable path
        
        Args:
            python_path: Path to Python executable
            
        Returns:
            Validated path
            
        Raises:
            SecurityError: If path not allowed
        """
        # Allowed Python executable paths
        allowed_paths = [
            '/usr/bin/python3',
            '/usr/local/bin/python3',
            '/opt/homebrew/bin/python3',
            str(Path(__file__).parent / 'venv' / 'bin' / 'python'),
            str(Path(__file__).parent / 'venv' / 'Scripts' / 'python.exe'),  # Windows
        ]
        
        try:
            resolved_path = str(Path(python_path).resolve())
        except OSError:
            raise SecurityError(f"Invalid Python path: {python_path}")
        
        # Check against allowlist
        if resolved_path not in allowed_paths:
            # Allow if it's in a venv directory under current project
            current_dir = Path(__file__).parent.resolve()
            try:
                rel_path = Path(resolved_path).relative_to(current_dir)
                if not str(rel_path).startswith('venv/'):
                    raise SecurityError(f"Python path not allowed: {python_path}")
            except ValueError:
                raise SecurityError(f"Python path not allowed: {python_path}")
        
        # Verify file exists and is executable
        python_file = Path(resolved_path)
        if not python_file.exists():
            raise SecurityError(f"Python executable not found: {resolved_path}")
        
        if not os.access(python_file, os.X_OK):
            raise SecurityError(f"Python executable not executable: {resolved_path}")
        
        return resolved_path
    
    def log_security_event(self, event_type: str, details: Dict[str, Any]):
        """
        Log security events for monitoring
        
        Args:
            event_type: Type of security event
            details: Event details
        """
        security_logger.warning(f"Security event: {event_type} - {details}")

# Global validator instance (will be initialized by service)
_validator: Optional[SecurityValidator] = None

def get_validator() -> SecurityValidator:
    """Get global security validator instance"""
    if _validator is None:
        raise RuntimeError("Security validator not initialized")
    return _validator

def init_security_validator(base_directory: str):
    """Initialize global security validator"""
    global _validator
    _validator = SecurityValidator(base_directory)

# Convenience functions for common validations
def validate_text(text: str) -> str:
    """Validate text input"""
    return get_validator().validate_text_input(text)

def validate_path(path: str, allow_create: bool = True) -> Path:
    """Validate file path"""
    return get_validator().validate_file_path(path, allow_create)

def validate_model(model_name: str) -> str:
    """Validate model name"""
    return get_validator().validate_model_name(model_name)

def safe_cache_key(text: str, model: str) -> str:
    """Generate safe cache key"""
    return get_validator().generate_safe_cache_key(text, model)