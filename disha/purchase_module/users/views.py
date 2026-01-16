import logging
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import Division, CustomUser
from .serializers import DivisionUserSerializer, UserSerializer
from rest_framework_simplejwt.views import TokenObtainPairView
from .serializers import CustomTokenObtainPairSerializer
from rest_framework.decorators import api_view
from django.contrib.auth import authenticate
from rest_framework.response import Response
from rest_framework import status
from rest_framework.exceptions import AuthenticationFailed
from .models import User
from .permissions import IsRequisitorOrApprover
from rest_framework.permissions import AllowAny
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator

class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


class DivisionUsersView(APIView):
    def get(self, request, division_id):
        """
        Fetch users in the same division as the logged-in user.
        """
        try:
            users = CustomUser.objects.filter(division=division_id).select_related('division')
            
            print(f"Looking for users in division {division_id}")
            print(f"Found {users.count()} users")

            serializer = UserSerializer(users, many=True)

            return Response(serializer.data, status=status.HTTP_200_OK)
        except Exception as e:
            print(f"Error in DivisionUsersView: {str(e)}")
            return Response(
                {'error': f'Error fetching division users: {str(e)}'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )



    


# Set up logging
logger = logging.getLogger(__name__)
@method_decorator(csrf_exempt, name='dispatch')
class LoginView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        """Handle GET requests for debugging"""
        return Response({
            'message': 'Login endpoint is working',
            'methods_allowed': ['POST'],
            'note': 'Please use POST method with username and password'
        }, status=status.HTTP_200_OK)

    def post(self, request):
        try:
            print(f"Login attempt from IP: {request.META.get('REMOTE_ADDR')}")
            print(f"Request data: {request.data}")
            
            username = request.data.get('username')
            password = request.data.get('password')

            if not username or not password:
                return Response({
                    'message': 'Username and password are required'
                }, status=status.HTTP_400_BAD_REQUEST)

            user = authenticate(username=username, password=password)
            if user is not None:
                print(f"User {username} authenticated successfully")
                approver = CustomUser.objects.filter(division=user.division, role='Approver').first()

                user_info = {
                    'username': user.username,
                    'role': user.role,
                    'division': user.division.id,
                    'division_name': user.division.division_name,
                    'name': f"{user.first_name} {user.last_name}".strip(),
                    'full_name': f"{user.first_name} {user.last_name}".strip(),
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                    'email': user.email,
                    'approver_name': user.get_full_name() if user.role == 'Approver' else approver.get_full_name() if approver else None,
                }
                
                response = Response({
                    'message': 'Authentication successful', 
                    'user_info': user_info
                }, status=status.HTTP_200_OK)
                
                response.set_cookie(
                    key='username',
                    value=user.username,
                    max_age=30 * 24 * 60 * 60,
                    httponly=False,
                    samesite='Lax'
                )
                
                full_name = f"{user.first_name} {user.last_name}".strip()
                if full_name:
                    response.set_cookie(
                        key='full_name',
                        value=full_name,
                        max_age=30 * 24 * 60 * 60,
                        httponly=False,
                        samesite='Lax'
                    )
                
                print(f"Login successful for {username}")
                return response
            else:
                print(f"Authentication failed for {username}")
                return Response({
                    'message': 'Invalid credentials'
                }, status=status.HTTP_401_UNAUTHORIZED)
                
        except Exception as e:
            logger.error(f"Login error: {str(e)}")
            print(f"Login exception: {str(e)}")
            return Response({
                'message': 'Login failed due to server error',
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Fetch the approver whose division ID matches the logged-in user's division ID
