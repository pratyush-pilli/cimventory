from rest_framework import serializers
from .models import Master
 
class MasterSerializer(serializers.ModelSerializer):
    hsn_code = serializers.SerializerMethodField()
   
    class Meta:
        model = Master
        fields = '__all__'  # This will include all model fields
   
    def get_hsn_code(self, obj):
        # Return the hsn_code that was added by the view
        return getattr(obj, '_hsn_code', "")
 