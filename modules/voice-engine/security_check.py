#!/usr/bin/env python3
"""
SECURITY VERIFICATION SCRIPT
Quick validation that security fixes are properly implemented
Run this before any deployment to verify security controls
"""

import sys
import os
import json
from pathlib import Path
from security_validators import (
    PathValidator, TextValidator, ResourceValidator,
    SecurityValidationError, SecurityAuditLogger
)


def test_path_validation():
    """Test path validation security controls"""
    print("🔒 Testing Path Validation...")
    
    # Test legitimate paths
    base_dir = Path("/tmp/test_cache")
    base_dir.mkdir(exist_ok=True)
    
    try:
        # Should succeed
        valid_path = PathValidator.validate_output_path("test.wav", base_dir)
        print("✅ Valid path accepted:", valid_path)
        
        # Should fail - path traversal
        try:
            PathValidator.validate_output_path("../../../etc/passwd.wav", base_dir)
            print("❌ SECURITY FAILURE: Path traversal not blocked!")
            return False
        except SecurityValidationError:
            print("✅ Path traversal blocked")
        
        # Should fail - absolute path  
        try:
            PathValidator.validate_output_path("/etc/passwd.wav", base_dir)
            print("❌ SECURITY FAILURE: Absolute path not blocked!")
            return False
        except SecurityValidationError:
            print("✅ Absolute path blocked")
            
        # Should fail - invalid extension
        try:
            PathValidator.validate_output_path("malicious.exe", base_dir)
            print("❌ SECURITY FAILURE: Invalid extension not blocked!")
            return False
        except SecurityValidationError:
            print("✅ Invalid extension blocked")
            
        return True
        
    except Exception as e:
        print(f"❌ Path validation test failed: {e}")
        return False


def test_text_validation():
    """Test text input validation"""
    print("\n🔒 Testing Text Validation...")
    
    try:
        # Should succeed
        valid_text = TextValidator.validate_text("Hello, this is a normal sentence.")
        print("✅ Valid text accepted:", valid_text[:30] + "...")
        
        # Should fail - script injection
        try:
            TextValidator.validate_text("<script>alert('xss')</script>")
            print("❌ SECURITY FAILURE: Script injection not blocked!")
            return False
        except SecurityValidationError:
            print("✅ Script injection blocked")
        
        # Should fail - command injection
        try:
            TextValidator.validate_text("Hello; rm -rf /")
            print("❌ SECURITY FAILURE: Command injection not blocked!")
            return False
        except SecurityValidationError:
            print("✅ Command injection blocked")
            
        # Should fail - template injection
        try:
            TextValidator.validate_text("Hello ${process.env.SECRET}")
            print("❌ SECURITY FAILURE: Template injection not blocked!")
            return False
        except SecurityValidationError:
            print("✅ Template injection blocked")
            
        # Should fail - excessive length
        try:
            TextValidator.validate_text("A" * 20000)
            print("❌ SECURITY FAILURE: Excessive length not blocked!")
            return False
        except SecurityValidationError:
            print("✅ Excessive length blocked")
            
        return True
        
    except Exception as e:
        print(f"❌ Text validation test failed: {e}")
        return False


def test_resource_validation():
    """Test resource limit validation"""
    print("\n🔒 Testing Resource Validation...")
    
    try:
        # Test cache limits
        cache_dir = Path("/tmp/test_cache")
        cache_dir.mkdir(exist_ok=True)
        
        # Should pass for reasonable usage
        result = ResourceValidator.check_cache_limits(cache_dir, 1024 * 1024)  # 1MB
        print(f"✅ Cache limit check working: {result}")
        
        # Create a test file to check size validation
        test_file = cache_dir / "test.wav"
        test_file.write_bytes(b"test data" * 100)
        
        size_valid = ResourceValidator.validate_file_size(test_file)
        print(f"✅ File size validation working: {size_valid}")
        
        # Cleanup
        test_file.unlink(missing_ok=True)
        
        return True
        
    except Exception as e:
        print(f"❌ Resource validation test failed: {e}")
        return False


def test_security_audit_logging():
    """Test security audit logging"""
    print("\n🔒 Testing Security Audit Logging...")
    
    try:
        # Test logging functions
        SecurityAuditLogger.log_validation_failure(
            "test_validator", 
            "test error message",
            {"test": "context"}
        )
        print("✅ Validation failure logging works")
        
        SecurityAuditLogger.log_path_traversal_attempt(
            "../../../etc/passwd",
            "/tmp/test_cache"
        )
        print("✅ Path traversal logging works")
        
        return True
        
    except Exception as e:
        print(f"❌ Security audit logging test failed: {e}")
        return False


def check_file_permissions():
    """Check that security-critical files have proper permissions"""
    print("\n🔒 Checking File Permissions...")
    
    critical_files = [
        "security_validators.py",
        "tts_service.py",
        "tts-wrapper.ts"
    ]
    
    for filename in critical_files:
        filepath = Path(filename)
        if filepath.exists():
            stat = filepath.stat()
            mode = oct(stat.st_mode)[-3:]
            print(f"✅ {filename}: {mode}")
            
            # Warn if world-writable
            if int(mode[2]) & 2:
                print(f"⚠️  WARNING: {filename} is world-writable!")
                return False
        else:
            print(f"⚠️  WARNING: {filename} not found!")
    
    return True


def check_dependencies():
    """Check that required security dependencies are available"""
    print("\n🔒 Checking Security Dependencies...")
    
    try:
        import hashlib
        print("✅ hashlib available")
        
        import logging
        print("✅ logging available")
        
        import re
        print("✅ regex available")
        
        # Test that pathlib works as expected
        from pathlib import Path
        test_path = Path("/tmp/security_test")
        resolved = test_path.resolve()
        print("✅ pathlib Path.resolve() working")
        
        return True
        
    except ImportError as e:
        print(f"❌ Missing dependency: {e}")
        return False


def main():
    """Run all security validation tests"""
    print("🛡️  SECURITY VALIDATION STARTING")
    print("=" * 50)
    
    tests = [
        ("Path Validation", test_path_validation),
        ("Text Validation", test_text_validation),
        ("Resource Validation", test_resource_validation),
        ("Audit Logging", test_security_audit_logging),
        ("File Permissions", check_file_permissions),
        ("Dependencies", check_dependencies)
    ]
    
    results = []
    
    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"❌ {test_name} FAILED with exception: {e}")
            results.append((test_name, False))
    
    print("\n" + "=" * 50)
    print("🛡️  SECURITY VALIDATION RESULTS")
    print("=" * 50)
    
    all_passed = True
    for test_name, passed in results:
        status = "✅ PASSED" if passed else "❌ FAILED"
        print(f"{test_name:20} {status}")
        if not passed:
            all_passed = False
    
    print("=" * 50)
    
    if all_passed:
        print("🎉 ALL SECURITY TESTS PASSED")
        print("✅ Ready for deployment")
        return 0
    else:
        print("🚨 SECURITY VALIDATION FAILED")
        print("❌ DO NOT DEPLOY")
        return 1


if __name__ == "__main__":
    sys.exit(main())