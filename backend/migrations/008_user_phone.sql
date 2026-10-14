-- Утасны дугаарыг хэрэглэгч бүр дээр хадгална (өмнө нь бүртгэл/байгууллага дээр нэг л дугаар байсан).
-- SMS-ийг хэрэглэгч бүрийн утас руу илгээнэ.
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20);

-- Одоо байгаа дугаар: бүртгэл бүрийн хамгийн эхний хэрэглэгчид оноох
-- (хувь хүн бол тэр өөрөө; импортолсон байгууллагын хувьд дугаар нь эхний мөрийнх байсан)
UPDATE users u SET phone = o.phone
FROM (
    SELECT DISTINCT ON (u2.organization_id) u2.id AS user_id, org.phone
    FROM users u2 JOIN organizations org ON org.id = u2.organization_id
    WHERE org.phone IS NOT NULL AND u2.role <> 'admin'
    ORDER BY u2.organization_id, u2.created_at, u2.id
) o
WHERE u.id = o.user_id AND u.phone IS NULL;

-- Илгээлтийн хүлээн авагч ямар хэрэглэгч байсныг хадгална
ALTER TABLE message_recipients ADD COLUMN IF NOT EXISTS recipient_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_recipients_user ON message_recipients(recipient_user_id);
