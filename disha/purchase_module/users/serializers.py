from rest_framework import serializers
from .models import CustomUser, Division, User
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView
from django.contrib.auth import authenticate
from django.contrib.auth.hashers import check_password

# UserSerializer to handle CustomUser model
class UserSerializer(serializers.ModelSerializer):
    # Dynamically creating a name field using get_full_name() method from CustomUser
    name = serializers.SerializerMethodField()

    class Meta:
        model = CustomUser
        fields = ['id', 'name', 'email', 'role', 'division', 'username']

    def get_name(self, obj):
        return obj.get_full_name()  # Using the method from CustomUser to generate full name

# Custom Token Serializer
class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        username = attrs.get("username")
        password = attrs.get("password")
        print(f"Login attempt for username: {username}")  # Debugging

        try:
            # Fetch the user
            user = CustomUser.objects.get(username=username)
            print(f"User found: {user}")  # Debugging

            # Validate password
            if check_password(password, user.password):
                if not user.is_active:
                    raise serializers.ValidationError({"detail": "User is inactive"})

                print("Password is correct")  # Debugging
                refresh = self.get_token(user)

                # Return the token and custom claims
                return {

                    "username": user.username,
                    "email": user.email,
                    "role": user.role,
                    "division": user.division.id,
                    "division_name": user.division.division_name,
                    "full_name": f"{user.first_name} {user.last_name}",
                }
            else:
                raise serializers.ValidationError({"detail": "Invalid password"})
        except CustomUser.DoesNotExist:
            raise serializers.ValidationError({"detail": "No active account found"})

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        
        # Add custom claims to the token
        token['username'] = user.username
        token['email'] = user.email
        token['role'] = user.role
        token['division'] = user.division.id
        token['division_name'] = user.division.division_name
        token['full_name'] = f"{user.first_name} {user.last_name}"
        
        return token

# Serializer for Division Users
class DivisionUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser
        fields = ['id', 'username', 'role']  # Customize based on the fields you want to show

# Serializer for Division Model (optional, if needed for other parts of the app)
class DivisionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Division
        fields = ['id', 'division_name']  # Adjust this based on your model
