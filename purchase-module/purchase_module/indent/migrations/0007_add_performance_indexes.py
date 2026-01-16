from django.db import migrations, models

class Migration(migrations.Migration):

    dependencies = [
        ('indent', '0006_alter_requisition_cimcon_part_number'),
    ]

    operations = [
        # Add individual field indexes
        migrations.RunSQL(
            "CREATE INDEX IF NOT EXISTS idx_project_client_name ON indent_project(client_project_name);",
            reverse_sql="DROP INDEX IF EXISTS idx_project_client_name;"
        ),
        migrations.RunSQL(
            "CREATE INDEX IF NOT EXISTS idx_requisition_batch_id ON indent_requisition(batch_id);",
            reverse_sql="DROP INDEX IF EXISTS idx_requisition_batch_id;"
        ),
        migrations.RunSQL(
            "CREATE INDEX IF NOT EXISTS idx_requisition_cimcon_part ON indent_requisition(cimcon_part_number);",
            reverse_sql="DROP INDEX IF EXISTS idx_requisition_cimcon_part;"
        ),
        migrations.RunSQL(
            "CREATE INDEX IF NOT EXISTS idx_requisition_status ON indent_requisition(status);",
            reverse_sql="DROP INDEX IF EXISTS idx_requisition_status;"
        ),
        migrations.RunSQL(
            "CREATE INDEX IF NOT EXISTS idx_requisition_approved ON indent_requisition(approved_status);",
            reverse_sql="DROP INDEX IF EXISTS idx_requisition_approved;"
        ),
        migrations.RunSQL(
            "CREATE INDEX IF NOT EXISTS idx_history_field_name ON indent_requisitionhistory(field_name);",
            reverse_sql="DROP INDEX IF EXISTS idx_history_field_name;"
        ),
        migrations.RunSQL(
            "CREATE INDEX IF NOT EXISTS idx_history_changed_at ON indent_requisitionhistory(changed_at);",
            reverse_sql="DROP INDEX IF EXISTS idx_history_changed_at;"
        ),
        
        # Add composite indexes
        migrations.RunSQL(
            "CREATE INDEX IF NOT EXISTS idx_requisition_batch_status ON indent_requisition(batch_id, status);",
            reverse_sql="DROP INDEX IF EXISTS idx_requisition_batch_status;"
        ),
        migrations.RunSQL(
            "CREATE INDEX IF NOT EXISTS idx_requisition_project_approved ON indent_requisition(project_id, approved_status);",
            reverse_sql="DROP INDEX IF EXISTS idx_requisition_project_approved;"
        ),
        migrations.RunSQL(
            "CREATE INDEX IF NOT EXISTS idx_history_req_field ON indent_requisitionhistory(requisition_id, field_name);",
            reverse_sql="DROP INDEX IF EXISTS idx_history_req_field;"
        ),
    ]
