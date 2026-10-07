-- Хүлээн авагч ямар бүртгэл (байгууллага / хувь хэрэглэгч) байсныг хадгална.
-- Нэрийг илгээх үеийнхээр нь хадгална (дараа нь нэр солигдох, бүртгэл устсан ч түүх зөв харагдана).
ALTER TABLE message_recipients ADD COLUMN IF NOT EXISTS recipient_org_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL;
ALTER TABLE message_recipients ADD COLUMN IF NOT EXISTS recipient_type VARCHAR(20);   -- organization | individual
ALTER TABLE message_recipients ADD COLUMN IF NOT EXISTS recipient_name VARCHAR(150);

-- Өмнөх илгээлтүүд: харилцагчийн дэвтрээс биш (contact_id байхгүй) мөрийг утсаар нь бүртгэлтэй тулгана
UPDATE message_recipients r
SET recipient_org_id = o.id, recipient_type = o.type, recipient_name = o.name
FROM (
    SELECT DISTINCT ON (phone) id, phone, type, name FROM organizations
    WHERE phone IS NOT NULL ORDER BY phone, id
) o
WHERE r.contact_id IS NULL AND r.recipient_org_id IS NULL AND o.phone = r.phone;

CREATE INDEX IF NOT EXISTS idx_recipients_org ON message_recipients(recipient_org_id);
