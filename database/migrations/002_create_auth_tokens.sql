CREATE TABLE IF NOT EXISTS auth_tokens (
    id UUID PRIMARY KEY,

    user_id UUID NOT NULL,

    token VARCHAR(255) NOT NULL,

    purpose VARCHAR(50) NOT NULL,

    expires_at TIMESTAMPTZ NOT NULL,

    used BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT auth_tokens_user_id_fkey
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);