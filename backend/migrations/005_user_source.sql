-- Хэрэглэгч хэрхэн үүссэн: register (өөрөө бүртгүүлсэн) | admin (admin нэмсэн) |
-- import (admin CSV-ээр оруулсан) | team (байгууллагын эзэн ажилтнаар нэмсэн)
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_via VARCHAR(10) NOT NULL DEFAULT 'register';
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
