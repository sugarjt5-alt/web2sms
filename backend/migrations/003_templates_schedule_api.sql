-- ================================
-- SMS загвар, {нэр}-ээр хувийн мессеж, хуваарьт илгээлт, API түлхүүр
-- ================================

-- ---- Мессежийн загварууд (байгууллагынх) ----
CREATE TABLE IF NOT EXISTS message_templates (
    id              SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id         INTEGER REFERENCES users(id) ON DELETE SET NULL,
    name            VARCHAR(150) NOT NULL,
    content         TEXT NOT NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_templates_org ON message_templates(organization_id);

-- ---- API түлхүүрүүд ----
-- Түлхүүрийг өөрийг нь хадгалахгүй, зөвхөн SHA-256 hash-ийг нь хадгална (нууц үг шиг).
CREATE TABLE IF NOT EXISTS api_keys (
    id              SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name            VARCHAR(100) NOT NULL,
    key_prefix      VARCHAR(20) NOT NULL,            -- танихад зориулсан эхний хэсэг: w2s_ab12cd34
    key_hash        CHAR(64) NOT NULL UNIQUE,
    created_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    last_used_at    TIMESTAMP,
    revoked_at      TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_api_keys_org ON api_keys(organization_id);

-- ---- messages: хуваарь, эх сурвалж ----
-- status-д шинээр: 'scheduled' (хуваарьт), 'cancelled' (цуцлагдсан)
ALTER TABLE messages ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS source VARCHAR(10) NOT NULL DEFAULT 'web'; -- web | api
ALTER TABLE messages ADD COLUMN IF NOT EXISTS api_key_id INTEGER REFERENCES api_keys(id) ON DELETE SET NULL;

-- ---- message_recipients: хүн бүрийн бодит текст, SMS-ийн тоо ----
-- {нэр} орлуулсны дараах текст хүн бүрт өөр урттай байж болох тул тус тусад нь хадгална
ALTER TABLE message_recipients ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE message_recipients ADD COLUMN IF NOT EXISTS segments INTEGER NOT NULL DEFAULT 1;
UPDATE message_recipients r SET segments = m.segments
    FROM messages m WHERE m.id = r.message_id AND r.segments <> m.segments;

CREATE INDEX IF NOT EXISTS idx_messages_scheduled ON messages(status, scheduled_at);
