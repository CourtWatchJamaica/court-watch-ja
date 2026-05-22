CREATE TABLE IF NOT EXISTS admin_logs (
    id              SERIAL PRIMARY KEY,
    admin_user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    action          TEXT    NOT NULL,
    target_type     TEXT,
    target_id       INTEGER,
    details         JSONB,
    ip_address      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at    ON admin_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_logs_admin_user_id ON admin_logs (admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_action        ON admin_logs (action);
