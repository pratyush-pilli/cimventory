from django.db import models
import os

def vendor_document_path(instance, filename):
    # Get a valid folder name (remove special chars that might be problematic)
    safe_vendor_name = "".join(c for c in instance.vendor_name if c.isalnum() or c in [' ', '_']).replace(' ', '_')
    # Create path like: vendor_documents/CIMVED0000123_VendorName/filename
    return os.path.join('vendor_documents', f"{instance.vendor_id}_{safe_vendor_name}", filename)

class Vendor(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]
    vendor_id = models.CharField(max_length=20, null=True)
    # sr_no = models.AutoField(primary_key=True, verbose_name="Serial Number")
    
    product_category = models.CharField("Product Category", max_length=255)
    vendor_name = models.CharField("Vendor Name", max_length=255)
    contact_person = models.CharField("Contact Person", max_length=255, blank=True, null=True)
    mobile_no_1 = models.CharField("Mobile Number 1", max_length=20, blank=True, null=True)
    mobile_no_2 = models.CharField("Mobile Number 2", max_length=20, blank=True, null=True)
    email_1 = models.EmailField("Primary Email", max_length=255, blank=True, null=True)
    email_2 = models.EmailField("Secondary Email", max_length=255, blank=True, null=True)
    website = models.URLField("Website", max_length=255, blank=True, null=True)
    address = models.TextField("Address", blank=True, null=True)
    payment_term = models.CharField("Payment Term", max_length=255, blank=True, null=True)
    gst_number = models.CharField(max_length=15, blank=True, null=True, verbose_name="GST No")
    pan_number = models.CharField(max_length=10, blank=True, null=True, verbose_name="PAN No")
    state = models.CharField(max_length=50, blank=True, null=True)
    state_code = models.CharField(max_length=2, blank=True, null=True, verbose_name="State Code")
    
    
    
    udyam_certificate_msme = models.FileField(
        "UDYAM Certificate (MSME)",
        upload_to=vendor_document_path,
        blank=True,
        null=True
    )
    gst_certificate = models.FileField(
        "GST Certificate",
        upload_to=vendor_document_path,
        blank=True,
        null=True
    )
    incorporation_certificate = models.FileField(
        "Incorporation Certificate",
        upload_to=vendor_document_path,
        blank=True,
        null=True
    )
    cancelled_cheque = models.FileField(
        "Cancelled Cheque",
        upload_to=vendor_document_path,
        blank=True,
        null=True
    )
    pan_card = models.FileField(
        "PAN Card",
        upload_to=vendor_document_path,
        blank=True,
        null=True
    )
    tan_allotment_letter = models.FileField(
        "TAN Allotment Letter",
        upload_to=vendor_document_path,
        blank=True,
        null=True
    )
    vendor_reg_form = models.FileField(
        "Vendor Registration Form",
        upload_to=vendor_document_path,
        blank=True,
        null=True
    )

    
    status = models.CharField(
        "Status",
        max_length=10,
        choices=STATUS_CHOICES,
        default='pending',
        help_text="Current status of vendor approval"
    )

    remarks = models.TextField("Rejection Remarks", blank=True, null=True, 
                             help_text="Reasons for rejection that need to be addressed")

    def __str__(self):
        return self.vendor_name