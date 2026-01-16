from rest_framework import serializers

class FactoryItemRequestSerializer(serializers.Serializer):
    """
    Serializer for factory item requests to match the data format
    returned by FactoryDB.get_factory_item_requests_by_status()
    """
    id = serializers.SerializerMethodField()
    requestor = serializers.CharField(max_length=255)
    status = serializers.CharField(max_length=50)
    productName = serializers.SerializerMethodField()
    productCode = serializers.SerializerMethodField()
    make = serializers.SerializerMethodField()
    makeCode = serializers.SerializerMethodField()
    mfgPartNo = serializers.SerializerMethodField()
    mfgPartCode = serializers.SerializerMethodField()
    itemDescription = serializers.SerializerMethodField()
    itemCode = serializers.SerializerMethodField()
    type = serializers.SerializerMethodField()
    typeCode = serializers.SerializerMethodField()
    materialRating = serializers.SerializerMethodField()
    materialRatingCode = serializers.SerializerMethodField()
    package = serializers.SerializerMethodField()
    uom = serializers.CharField(max_length=50, allow_blank=True, required=False)
    moq = serializers.IntegerField(required=False, default=0)
    leadTime = serializers.SerializerMethodField()
    hsnCode = serializers.SerializerMethodField()
    bin = serializers.SerializerMethodField()
    cimcon_part_no = serializers.SerializerMethodField()
    created_at = serializers.SerializerMethodField()
    updated_at = serializers.SerializerMethodField()
    rejection_reason = serializers.CharField(allow_blank=True, required=False)
    approved_by = serializers.CharField(allow_blank=True, required=False)
    rejected_by = serializers.CharField(allow_blank=True, required=False)
    document = serializers.SerializerMethodField()
    document_name = serializers.SerializerMethodField()
    
    def get_id(self, obj):
        return obj.get('request_id')
    
    def get_productName(self, obj):
        return obj.get('productname')
    
    def get_productCode(self, obj):
        return obj.get('productcode')
    
    def get_make(self, obj):
        return obj.get('makename')
    
    def get_makeCode(self, obj):
        return obj.get('makecode')
    
    def get_mfgPartNo(self, obj):
        return obj.get('mpnfull')
    
    def get_materialRating(self, obj):
        return obj.get('ratingvalue', '')
    
    def get_package(self, obj):
        return obj.get('packagecode', '')
    
    def get_itemDescription(self, obj):
        return obj.get('itemdesc')
    
    def get_leadTime(self, obj):
        return obj.get('lead_time', 0)
    
    def get_hsnCode(self, obj):
        return obj.get('hsn_code', '')
    
    def get_bin(self, obj):
        return obj.get('bin_location', '')
    
    def get_cimcon_part_no(self, obj):
        return obj.get('full_part_number', '')
    
    def get_mfgPartCode(self, obj):
        return obj.get('mpncode', '')
    
    def get_itemCode(self, obj):
        # For factory items, use the first 3 chars of product code as item code
        return obj.get('productcode', '')[:3]
    
    def get_type(self, obj):
        # Factory items don't have types, return empty or default
        return 'Factory'
    
    def get_typeCode(self, obj):
        # Factory items don't have type codes, return empty
        return ''
    
    def get_materialRatingCode(self, obj):
        # Use the rating value as the code for factory items
        return obj.get('ratingvalue', '')[:3]
    
    def get_document(self, obj):
        # Factory items don't have documents
        return None
    
    def get_document_name(self, obj):
        # Factory items don't have document names
        return None
    
    def get_created_at(self, obj):
        # Format the created_at timestamp for frontend
        created_at = obj.get('created_at')
        if created_at:
            return str(created_at)
        return None
    
    def get_updated_at(self, obj):
        # Format the updated_at timestamp for frontend
        updated_at = obj.get('updated_at')
        if updated_at:
            return str(updated_at)
        return None

    class Meta:
        fields = [
            'id', 'requestor', 'status', 'productName', 'productCode', 
            'make', 'makeCode', 'mfgPartNo', 'mfgPartCode', 'itemDescription', 
            'itemCode', 'type', 'typeCode', 'materialRating', 'materialRatingCode',
            'package', 'uom', 'moq', 'leadTime', 'hsnCode', 'bin', 
            'cimcon_part_no', 'created_at', 'updated_at', 'rejection_reason', 
            'approved_by', 'rejected_by', 'document', 'document_name'
        ]
