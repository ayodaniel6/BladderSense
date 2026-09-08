/*
 * Pure aggregation helpers used to turn a list of raw tracking entries
 * into a progress summary (e.g. a 30-day monthly report).
 *
 * These functions do not touch the database or the request/response
 * cycle so they can be unit tested in isolation.
 */


// Map the fixed night-time urination options onto numbers so we can
// average them. "3+" is treated as 3 (a conservative lower bound).
const nightTimeUrinationToNumber = (value) => {
    if (value === "3+") {
        return 3;
    }

    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : null;
};


// Map sleep quality onto a 1-3 scale so a simple trend can be computed.
const sleepQualityToNumber = (value) => {
    switch (value) {
        case "Poor":
            return 1;
        case "Fair":
            return 2;
        case "Good":
            return 3;
        default:
            return null;
    }
};


const average = (numbers) => {
    const valid = numbers.filter(
        (n) => typeof n === "number" && Number.isFinite(n)
    );

    if (valid.length === 0) {
        return null;
    }

    const total = valid.reduce((sum, n) => sum + n, 0);

    return Math.round((total / valid.length) * 100) / 100;
};


// Count how often each option appears for a categorical field.
const distribution = (entries, key, options) => {
    const counts = {};

    for (const option of options) {
        counts[option] = 0;
    }

    for (const entry of entries) {
        const value = entry[key];

        if (Object.prototype.hasOwnProperty.call(counts, value)) {
            counts[value] += 1;
        }
    }

    return counts;
};


/*
 * Build a progress summary for a set of tracking entries.
 *
 *   entries    - array of raw DB rows (snake_case columns)
 *   periodDays - length of the tracking window (e.g. 30)
 *   endDate    - the (inclusive) last day of the window, as a Date
 *
 * The entries passed in are expected to already be limited to the
 * window; periodDays is only used to report adherence.
 */
const buildTrackingSummary = (entries, periodDays, endDate) => {
    const end = endDate ? new Date(endDate) : new Date();

    const start = new Date(end);
    start.setDate(start.getDate() - (periodDays - 1));


    const daysTracked = entries.length;

    const adherencePercent =
        periodDays > 0
            ? Math.round((daysTracked / periodDays) * 100)
            : 0;


    // Average nightly urination episodes across the window.
    const nightTimeNumbers = entries.map((entry) =>
        nightTimeUrinationToNumber(entry.night_time_urination)
    );

    const stressNumbers = entries.map((entry) => {
        const parsed = Number(entry.stress_level);

        return Number.isFinite(parsed) ? parsed : null;
    });

    const sleepNumbers = entries.map((entry) =>
        sleepQualityToNumber(entry.sleep_quality)
    );


    /*
     * A very small "progress" signal: compare the first half of the
     * window against the second half for the two headline metrics
     * (nocturia and sleep quality). Entries are assumed to be ordered
     * oldest-first for this to read as first-half vs second-half.
     */
    const ordered = [...entries].sort((a, b) => {
        return new Date(a.entry_date) - new Date(b.entry_date);
    });

    const midpoint = Math.floor(ordered.length / 2);

    const firstHalf = ordered.slice(0, midpoint);
    const secondHalf = ordered.slice(midpoint);

    const trend = (mapper, higherIsBetter) => {
        if (firstHalf.length === 0 || secondHalf.length === 0) {
            return {
                firstHalfAverage: null,
                secondHalfAverage: null,
                direction: "insufficient-data"
            };
        }

        const firstAvg = average(firstHalf.map(mapper));
        const secondAvg = average(secondHalf.map(mapper));

        let direction = "stable";

        if (firstAvg !== null && secondAvg !== null) {
            if (secondAvg > firstAvg) {
                direction = higherIsBetter
                    ? "improving"
                    : "worsening";
            } else if (secondAvg < firstAvg) {
                direction = higherIsBetter
                    ? "worsening"
                    : "improving";
            }
        }

        return {
            firstHalfAverage: firstAvg,
            secondHalfAverage: secondAvg,
            direction
        };
    };


    return {
        period: {
            days: periodDays,
            startDate: start.toISOString().slice(0, 10),
            endDate: end.toISOString().slice(0, 10)
        },

        adherence: {
            daysTracked,
            expectedDays: periodDays,
            percent: adherencePercent
        },

        nightTimeUrination: {
            averagePerNight: average(nightTimeNumbers),
            distribution: distribution(
                entries,
                "night_time_urination",
                ["0", "1", "2", "3+"]
            ),
            // Fewer night-time episodes is better.
            trend: trend(
                (entry) =>
                    nightTimeUrinationToNumber(
                        entry.night_time_urination
                    ),
                false
            )
        },

        eveningFluids: {
            distribution: distribution(
                entries,
                "evening_fluids",
                ["None", "Small", "Moderate", "Large"]
            )
        },

        activityLevel: {
            distribution: distribution(
                entries,
                "activity_level",
                ["None", "Light", "Moderate", "High"]
            )
        },

        stressLevel: {
            average: average(stressNumbers)
        },

        sleepQuality: {
            average: average(sleepNumbers),
            distribution: distribution(
                entries,
                "sleep_quality",
                ["Poor", "Fair", "Good"]
            ),
            // Better sleep quality is better.
            trend: trend(
                (entry) => sleepQualityToNumber(entry.sleep_quality),
                true
            )
        }
    };
};


module.exports = {
    buildTrackingSummary,
    nightTimeUrinationToNumber,
    sleepQualityToNumber,
    average,
    distribution
};
