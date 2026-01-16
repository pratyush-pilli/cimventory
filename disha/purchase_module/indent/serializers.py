from rest_framework import serializers
from .models import Requisition, Project, RequisitionHistory

class ProjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        fields = '__all__'  # You can specify the fields explicitly if needed

class RequisitionSerializer(serializers.ModelSerializer):
    project_code = serializers.CharField(source='project.project_code', read_only=True)

    class Meta:
        model = Requisition
        fields = '__all__'  # Include all fields from the Requisition model

    def validate(self, data):
        # Removed unique constraint validation for item_no and cimcon_part_number
        # Validate batch_id format if provided
        batch_id = data.get('batch_id')
        if batch_id:
            try:
                batch_num = int(batch_id.split('_')[0])
                project_code = batch_id.split('_')[1]
                
                if project_code != data['project'].project_code:
                    raise serializers.ValidationError(
                        "Batch ID project code must match the project"
                    )
            except (IndexError, ValueError):
                raise serializers.ValidationError(
                    "Invalid batch_id format. Expected format: number_projectcode"
                )

        return data

class RequisitionHistorySerializer(serializers.ModelSerializer):
    changed_by_name = serializers.SerializerMethodField()
    approved_by_name = serializers.SerializerMethodField()

    class Meta:
        model = RequisitionHistory
        fields = [
            'id', 'field_name', 'old_value', 'new_value',
            'changed_at', 'changed_by', 'changed_by_name', 'approved_by', 'approved_by_name'
        ]

    def get_changed_by_name(self, obj):
        return obj.changed_by  # Return the username directly

    def get_approved_by_name(self, obj):
        return obj.approved_by  # Return the username directly