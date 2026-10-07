-- ================================
-- Кредитийн багц, захиалга (нэхэмжлэх), системийн тохиргоо
-- ================================

-- ---- Багцууд (admin тохируулна) ----
CREATE TABLE IF NOT EXISTS packages (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    credits     INTEGER NOT NULL CHECK (credits > 0),
    price       INTEGER NOT NULL CHECK (price >= 0),    -- төгрөгөөр
    description TEXT,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Жишээ багцууд — үнийг admin "Багцууд" хэсгээс өөрчилнө
INSERT INTO packages (name, credits, price, description, sort_order)
SELECT * FROM (VALUES
    ('Эхлэл',    1000,   25000, 'Жижиг бизнес, туршилтад', 1),
    ('Бизнес',   5000,  110000, 'Тогтмол мэдэгдэл илгээдэг байгууллагад', 2),
    ('Корпорац', 20000, 400000, 'Их хэмжээний илгээлттэй байгууллагад', 3)
) AS v(name, credits, price, description, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM packages);

-- ---- Захиалга / нэхэмжлэх ----
-- status: pending (төлбөр хүлээгдэж буй) | paid (батлагдаж кредит орсон) | rejected | cancelled
CREATE TABLE IF NOT EXISTS credit_orders (
    id              SERIAL PRIMARY KEY,
    invoice_no      VARCHAR(20) UNIQUE,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    package_id      INTEGER REFERENCES packages(id) ON DELETE SET NULL,
    package_name    VARCHAR(100) NOT NULL,   -- захиалах үеийн нэр, кредит, үнийг хадгална
    credits         INTEGER NOT NULL,
    price           INTEGER NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    decided_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
    decided_at      TIMESTAMP,
    admin_note      TEXT
);
CREATE INDEX IF NOT EXISTS idx_orders_org ON credit_orders(organization_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON credit_orders(status);

-- ---- Системийн тохиргоо (key/value) ----
CREATE TABLE IF NOT EXISTS settings (
    key        VARCHAR(100) PRIMARY KEY,
    value      TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
INSERT INTO settings (key, value) VALUES
    ('payment_instructions', 'Банк: ...
Дансны дугаар: ...
Хүлээн авагч: ...
Гүйлгээний утга дээр нэхэмжлэхийн дугаараа заавал бичнэ үү.')
ON CONFLICT (key) DO NOTHING;
