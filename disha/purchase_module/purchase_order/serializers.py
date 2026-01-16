from rest_framework import serializers
from .models import PurchaseOrder, POLineItem, POHistory

class POLineItemSerializer(serializers.ModelSerializer):
    po_number = serializers.CharField(source='purchase_order.po_number', read_only=True)
    po_date = serializers.DateField(source='purchase_order.po_date', read_only=True)
    vendor_name = serializers.CharField(source='purchase_order.vendor_name', read_only=True)
    project_code = serializers.CharField(source='purchase_order.project_code', read_only=True)
    total_amount = serializers.SerializerMethodField()
    inward_status = serializers.SerializerMethodField()
    remaining_quantity = serializers.SerializerMethodField()

    class Meta:
        model = POLineItem
        fields = [
            'id',
            'po_number',
            'po_date',
            'vendor_name',
            'project_code',
            'item_no',
            'material_description',
            'make',
            'material_group',
            'hsn_code',
            'quantity',
            'unit',
            'unit_price',
            'total_price',
            'expected_delivery',
            'inwarded_quantity',
            'inward_status',
            'remaining_quantity',
            'total_amount'
        ]
        
    def get_total_amount(self, obj):
        return float(obj.unit_price * obj.quantity)

    def get_inward_status(self, obj):
        if obj.inwarded_quantity == 0:
            return 'open'
        elif obj.inwarded_quantity < obj.quantity:
            return 'partially_inwarded'
        else:
            return 'completed'

    def get_remaining_quantity(self, obj):
        return float(obj.quantity - obj.inwarded_quantity)

class POHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = POHistory
        fields = '__all__'

class PurchaseOrderSerializer(serializers.ModelSerializer):
    line_items = POLineItemSerializer(many=True, read_only=True)
    history = POHistorySerializer(many=True, read_only=True)

    class Meta:
        model = PurchaseOrder
        fields = '__all__'
        read_only_fields = ('po_number', 'created_at', 'updated_at')

    def create(self, validated_data):
        line_items_data = self.context['request'].data.get('line_items', [])
        po = PurchaseOrder.objects.create(**validated_data)

        # Create line items
        for item_data in line_items_data:
            POLineItem.objects.create(purchase_order=po, **item_data)

        # Create history entry
        POHistory.objects.create(
            purchase_order=po,
            action='created',
            description='Purchase Order created',
            created_by=self.context['request'].user.username
        )

        return po

class PendingPOSerializer(serializers.ModelSerializer):
    items = POLineItemSerializer(source='line_items', many=True, read_only=True)
    total_amount = serializers.FloatField()
    
    class Meta:
        model = PurchaseOrder
        fields = ['po_number', 'vendor_name', 'po_date', 'total_amount', 
                 'project_code', 'status', 'items']