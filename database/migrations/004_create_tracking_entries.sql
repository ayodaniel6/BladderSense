CREATE TABLE IF NOT EXISTS tracking_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL,

    entry_date DATE NOT NULL,

    night_time_urination VARCHAR(20) NOT NULL,

    evening_fluids VARCHAR(20) NOT NULL,

    activity_level VARCHAR(20) NOT NULL,

    stress_level VARCHAR(20) NOT NULL,

    sleep_quality VARCHAR(20) NOT NULL,

    notes TEXT,

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_user_tracking_date
        UNIQUE (user_id, entry_date),

    CONSTRAINT fk_tracking_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT check_night_time_urination
        CHECK (
            night_time_urination IN ('0', '1', '2', '3+')
        ),

    CONSTRAINT check_evening_fluids
        CHECK (
            evening_fluids IN ('None', 'Small', 'Moderate', 'Large')
        ),

    CONSTRAINT check_activity_level
        CHECK (
            activity_level IN ('None', 'Light', 'Moderate', 'High')
        ),

    CONSTRAINT check_stress_level
        CHECK (
            stress_level IN ('1', '2', '3', '4', '5')
        ),

    CONSTRAINT check_sleep_quality
        CHECK (
            sleep_quality IN ('Poor', 'Fair', 'Good')
        )
);