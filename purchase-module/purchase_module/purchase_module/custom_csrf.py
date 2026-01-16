from django.middleware.csrf import CsrfViewMiddleware
import re

class CustomCsrfMiddleware(CsrfViewMiddleware):
    """
    Custom CSRF middleware that exempts API endpoints
    """
    
    def __init__(self, get_response):
        print("🔧 CustomCsrfMiddleware initialized")
        super().__init__(get_response)
    
    def __call__(self, request):
        print(f"🔍 CustomCsrfMiddleware processing: {request.method} {request.path}")
        return super().__call__(request)
    
    def process_view(self, request, callback, callback_args, callback_kwargs):
        print(f"🔎 CustomCsrfMiddleware.process_view: {request.method} {request.path}")
        
        # List of URL patterns to exempt from CSRF
        exempt_patterns = [
            r'^/api/',
            r'^/requisitions/',
            r'^/save-requisition/',
            r'^/division-requisitions/',
            r'^/inventory/',
            r'^/allocate/',
            r'^/outward/',
            r'^/vendors/',
            r'^/items/',
            r'^/master/',
        ]
        
        # Check if current path matches any exempt pattern
        for pattern in exempt_patterns:
            if re.match(pattern, request.path):
                print(f"✅ CSRF EXEMPT for path: {request.path} (matched pattern: {pattern})")
                return None  # Skip CSRF check
        
        print(f"🚨 CSRF REQUIRED for path: {request.path}")
        # For non-exempt paths, use default CSRF protection
        result = super().process_view(request, callback, callback_args, callback_kwargs)
        print(f"🔒 CSRF check result: {result}")
        return result 