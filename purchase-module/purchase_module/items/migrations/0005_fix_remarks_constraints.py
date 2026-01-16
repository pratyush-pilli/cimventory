from django.db import migrations, models

class Migration(migrations.Migration):

    dependencies = [
        ('items', '0004_alter_productrating_name_alter_subcategory_code'),
    ]

    operations = [
        # First, ensure the fields we're working with have the right properties
        migrations.AlterField(
            model_name='remarks',
            name='code',
            field=models.CharField(db_index=True, max_length=4),
            preserve_default=True,
        ),
        # Then, apply any necessary SQL operations
        migrations.RunSQL(
            sql="""
            -- This will only drop the constraint if it exists
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 
                    FROM information_schema.table_constraints 
                    WHERE constraint_name = 'items_remarks_main_category_id_code_uniq'
                    AND table_name = 'items_remarks'
                ) THEN
                    ALTER TABLE items_remarks 
                    DROP CONSTRAINT items_remarks_main_category_id_code_uniq;
                END IF;
            END $$;
            """,
            reverse_sql="""
            -- This will recreate the constraint if needed
            ALTER TABLE items_remarks 
            ADD CONSTRAINT items_remarks_main_category_id_code_uniq 
            UNIQUE (main_category_id, code);
            """,
        ),
    ]
