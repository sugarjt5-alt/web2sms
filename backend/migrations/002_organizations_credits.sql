-- ================================
-- Байгууллага (organization) + SMS кредит
-- Contact, group, мессеж нь хэрэглэгчийнх биш, байгууллагынх болно.
-- Одоо байгаа хэрэглэгч бүрд өөрийн нэртэй байгууллага үүсгэж, өгөгдлийг нь шилжүүлнэ.
-- ================================

CREATE TABLE IF NOT EXISTS organizations (
    id         SERIAL PRIMARY KEY,
    name       VARCHAR(150) NOT NULL,
    credits    INTEGER NOT NULL DEFAULT 0 CHECK (credits >= 0),
    is_active  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ---- users: байгууллагад харьяалагдана ----
-- org_role: 'owner' (багийг удирдана) | 'member'
ALTER TABLE users ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS org_role VARCHAR(20) NOT NULL DEFAULT 'owner';

DO $$
DECLARE
    u RECORD;
    new_org INTEGER;
BEGIN
    FOR u IN SELECT id, name FROM users WHERE organization_id IS NULL LOOP
        INSERT INTO organizations (name) VALUES (u.name) RETURNING id INTO new_org;
        UPDATE users SET organization_id = new_org, org_role = 'owner' WHERE id = u.id;
    END LOOP;
END $$;

ALTER TABLE users ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE users ALTER COLUMN org_role SET DEFAULT 'member';

-- ---- contacts / contact_groups / messages: байгууллагын өгөгдөл ----
-- user_id нь "хэн үүсгэсэн" гэдгийг л хадгална. Ажилтан устахад өгөгдөл устахгүй (SET NULL).
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE;
UPDATE contacts c SET organization_id = u.organization_id FROM users u
    WHERE u.id = c.user_id AND c.organization_id IS NULL;
ALTER TABLE contacts ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE contacts ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_user_id_fkey;
ALTER TABLE contacts ADD CONSTRAINT contacts_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE contact_groups ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE;
UPDATE contact_groups g SET organization_id = u.organization_id FROM users u
    WHERE u.id = g.user_id AND g.organization_id IS NULL;
ALTER TABLE contact_groups ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE contact_groups ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE contact_groups DROP CONSTRAINT IF EXISTS contact_groups_user_id_fkey;
ALTER TABLE contact_groups ADD CONSTRAINT contact_groups_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE messages ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE;
UPDATE messages m SET organization_id = u.organization_id FROM users u
    WHERE u.id = m.user_id AND m.organization_id IS NULL;
ALTER TABLE messages ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE messages ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_user_id_fkey;
ALTER TABLE messages ADD CONSTRAINT messages_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

-- SMS-ийн хэсгийн тоо (1 хэсэг = кирилл 70 / латин 160 тэмдэгт) болон нийт зарцуулсан кредит
ALTER TABLE messages ADD COLUMN IF NOT EXISTS segments INTEGER NOT NULL DEFAULT 1;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS cost INTEGER NOT NULL DEFAULT 0;

-- ---- Кредитийн гүйлгээний түүх ----
CREATE TABLE IF NOT EXISTS credit_transactions (
    id              SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    amount          INTEGER NOT NULL,              -- + цэнэглэлт/буцаалт, - зарцуулалт
    balance_after   INTEGER NOT NULL,
    type            VARCHAR(20) NOT NULL,          -- topup | sms | refund | adjust
    message_id      INTEGER REFERENCES messages(id) ON DELETE SET NULL,
    note            TEXT,
    created_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_org ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_contacts_org ON contacts(organization_id);
CREATE INDEX IF NOT EXISTS idx_groups_org ON contact_groups(organization_id);
CREATE INDEX IF NOT EXISTS idx_messages_org ON messages(organization_id);
CREATE INDEX IF NOT EXISTS idx_credit_tx_org ON credit_transactions(organization_id);
