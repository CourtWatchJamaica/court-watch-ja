CREATE TABLE promos (
    id               SERIAL PRIMARY KEY,
    title            TEXT NOT NULL,
    message          TEXT NOT NULL,
    url              TEXT,
    url_text         TEXT,
    display_frequency TEXT NOT NULL DEFAULT 'once',
    starts_at        TIMESTAMP,
    ends_at          TIMESTAMP,
    enabled          BOOLEAN NOT NULL DEFAULT true,
    created_at       TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE promo_dismissals (
    user_id      INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    promo_id     INT NOT NULL REFERENCES promos(id) ON DELETE CASCADE,
    dismissed_at TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, promo_id)
);
