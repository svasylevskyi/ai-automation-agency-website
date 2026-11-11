ALTER TABLE enquiries
  ADD COLUMN enquiry_route text CHECK (enquiry_route IN ('enquiry-process review', 'custom automation')),
  ADD COLUMN business_website text NOT NULL DEFAULT '',
  ADD COLUMN current_tools text NOT NULL DEFAULT '';
