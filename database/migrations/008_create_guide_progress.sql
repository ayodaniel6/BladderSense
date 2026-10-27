-- Which parts of the guide each user has opened, so progress follows
-- the user across browsers and devices. One row per (user, section);
-- rows are only ever added, never removed (except with the account).
CREATE TABLE IF NOT EXISTS guide_progress (
    user_id UUID NOT NULL,

    section_id VARCHAR(50) NOT NULL,

    read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (user_id, section_id),

    CONSTRAINT fk_guide_progress_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);
