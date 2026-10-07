-- Бүртгэлийн төрөл: 'individual' (хувь хүн — ганцаараа) | 'organization' (байгууллага — ажилтантай)
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS type VARCHAR(20) NOT NULL DEFAULT 'organization';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS registration_no VARCHAR(20); -- байгууллагын регистрийн дугаар
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS phone VARCHAR(20);           -- холбогдох утас
