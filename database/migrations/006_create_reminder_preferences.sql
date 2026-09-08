CREATE TABLE IF NOT EXISTS reminder_preferences (
    user_id UUID PRIMARY KEY,

    -- Whether the user wants tracking reminders at all.
    reminders_enabled BOOLEAN NOT NULL DEFAULT TRUE,

    -- How often the user is nudged to return and track.
    --   'daily'  -> remind if no entry was logged today
    --   'weekly' -> remind at the beginning of the week if no
    --               entry was logged in the last 7 days
    frequency VARCHAR(10) NOT NULL DEFAULT 'daily',

    -- The last time a reminder was actually sent, used to throttle so a
    -- user is never reminded more than once per cadence.
    last_reminded_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_reminder_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT check_reminder_frequency
        CHECK (frequency IN ('daily', 'weekly'))
);
