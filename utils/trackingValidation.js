const allowedNightTimeUrination = [
    "0",
    "1",
    "2",
    "3+"
];

const allowedEveningFluids = [
    "None",
    "Small",
    "Moderate",
    "Large"
];

const allowedActivityLevels = [
    "None",
    "Light",
    "Moderate",
    "High"
];

const allowedStressLevels = [
    "1",
    "2",
    "3",
    "4",
    "5"
];

const allowedSleepQualities = [
    "Poor",
    "Fair",
    "Good"
];


const validateTrackingEntry = (data) => {
    const errors = {};

    /*
     * Required fields
     */

    if (!data.entryDate) {
        errors.entryDate = "Entry date is required";
    }

    if (!data.nightTimeUrination) {
        errors.nightTimeUrination =
            "Night-time urination is required";
    }

    if (!data.eveningFluids) {
        errors.eveningFluids =
            "Evening fluid intake is required";
    }

    if (!data.activityLevel) {
        errors.activityLevel =
            "Activity level is required";
    }

    if (!data.stressLevel) {
        errors.stressLevel =
            "Stress level is required";
    }

    if (!data.sleepQuality) {
        errors.sleepQuality =
            "Sleep quality is required";
    }


    /*
     * Fixed option validation
     */

    if (
        data.nightTimeUrination &&
        !allowedNightTimeUrination.includes(
            data.nightTimeUrination
        )
    ) {
        errors.nightTimeUrination =
            "Invalid night-time urination value";
    }

    if (
        data.eveningFluids &&
        !allowedEveningFluids.includes(
            data.eveningFluids
        )
    ) {
        errors.eveningFluids =
            "Invalid evening fluid intake value";
    }

    if (
        data.activityLevel &&
        !allowedActivityLevels.includes(
            data.activityLevel
        )
    ) {
        errors.activityLevel =
            "Invalid activity level";
    }

    if (
        data.stressLevel &&
        !allowedStressLevels.includes(
            data.stressLevel
        )
    ) {
        errors.stressLevel =
            "Invalid stress level";
    }

    if (
        data.sleepQuality &&
        !allowedSleepQualities.includes(
            data.sleepQuality
        )
    ) {
        errors.sleepQuality =
            "Invalid sleep quality";
    }


    /*
     * Notes are optional.
     */

    if (
        data.notes !== undefined &&
        data.notes !== null &&
        typeof data.notes !== "string"
    ) {
        errors.notes = "Notes must be text";
    }


    return errors;
};


module.exports = {
    validateTrackingEntry
};