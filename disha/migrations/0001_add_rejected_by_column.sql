-- Add rejected_by column to factory_itemrequest table
ALTER TABLE factory_itemrequest ADD COLUMN rejected_by VARCHAR(100);
