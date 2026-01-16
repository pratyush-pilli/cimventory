from django.db.models.signals import post_save
from django.dispatch import receiver
from indent.models import Requisition
from .models import Master
import logging

logger = logging.getLogger(__name__)
@receiver(post_save, sender=Requisition)
def transfer_to_master_on_approval(sender, instance, created, **kwargs):
    """
    Signal triggered when a Requisition is approved to update the Master table.
    """
    try:
        logger.info(f"Signal triggered for Requisition ID: {instance.id} with approved_status={instance.approved_status}")
        
        if instance.approved_status:  # If approved_status is True
            master_entry, created = Master.objects.get_or_create(
                requisition=instance,
                defaults={
                    'indent_date': instance.requisition_date,
                    'indent_number': "",
                    'cimcon_part_number': instance.cimcon_part_number,
                    'mfg_part_number': instance.mfg_part_number,
                    'material_description': instance.material_description,
                    'make': instance.make,
                    'material_group': instance.material_group,
                    'required_quantity': instance.req_qty,
                    'unit': instance.unit,
                    'required_by': instance.required_by_date,
                    'project_code': instance.project.project_code if instance.project else "UNKNOWN",
                    'project_name': instance.project.client_project_name if instance.project else "UNKNOWN",
                    'remarks': instance.remarks,
                }
            )
            if created:
                logger.info(f"Master entry created for Requisition ID: {instance.id}")
            else:
                master_entry.indent_date = instance.requisition_date
                master_entry.cimcon_part_number = instance.cimcon_part_number
                master_entry.mfg_part_number = instance.mfg_part_number
                master_entry.material_description = instance.material_description
                master_entry.make = instance.make
                master_entry.material_group = instance.material_group
                master_entry.required_quantity = instance.req_qty
                master_entry.unit = instance.unit
                master_entry.required_by = instance.required_by_date
                master_entry.project_code = instance.project.project_code if instance.project else "UNKNOWN"
                master_entry.project_name = instance.project.client_project_name if instance.project else "UNKNOWN"
                master_entry.remarks = instance.remarks
                master_entry.save()
                logger.info(f"Updated Master entry for Requisition ID: {instance.id}")
    except Exception as e:
        logger.error(f"Error transferring Requisition ID: {instance.id} to Master - {e}")
