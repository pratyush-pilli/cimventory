from rest_framework import serializers
from indent.models import Project
from store.models import ProjectCode
from .models import StockOutward

class ProjectCodeSerializer(serializers.ModelSerializer):
    code = serializers.PrimaryKeyRelatedField(queryset=Project.objects.all())
    project_code = serializers.CharField(source='code.project_code', read_only=True)
    
    class Meta:
        model = ProjectCode
        fields = ['id', 'code', 'name', 'project_code']

class StockOutwardSerializer(serializers.ModelSerializer):
    location_display = serializers.CharField(source='get_location_display_name', read_only=True)
    project_code_display = serializers.CharField(source='project_code.code', read_only=True)
    item_no = serializers.CharField(source='inventory.item_no', read_only=True)
    description = serializers.CharField(source='inventory.description', read_only=True)

    class Meta:
        model = StockOutward
        fields = [
            'id', 'outward_date', 'document_type', 'document_number',
            'location', 'location_display', 'quantity', 'status',
            'project_code_display', 'remarks', 'outward_type',
            'item_no', 'description'
        ]