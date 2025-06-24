/**
 * UI element constants for wipe interface.
 * Contains all the sizing and positioning constants used for drawing UI elements.
 */
export const UI_CONSTANTS = {
    // Handle radii
    TRANSLATION_HANDLE_RADIUS: 6,
    ROTATION_HANDLE_RADIUS: 4,
    ALPHA_HANDLE_RADIUS: 4,
    
    // Distances and positions
    ROTATION_HANDLE_DISTANCE: 60,
    ALPHA_ARC_RADIUS: 40,
    
    // Alpha arc angles (in degrees)
    ALPHA_ARC_START_ANGLE: 70,
    ALPHA_ARC_END_ANGLE: 20,
} as const;

/**
 * Calculates the position of the rotation handle based on wipe position and angle.
 * 
 * @param wipePos - The center position of the wipe effect
 * @param wipeAngleDeg - The rotation angle of the wipe in degrees
 * @returns Position coordinates for the rotation handle
 */
export function calculateRotationHandlePosition(
    wipePos: { x: number; y: number },
    wipeAngleDeg: number
): { x: number; y: number } {
    const wipeAngleRad = wipeAngleDeg * (Math.PI / 180);
    return {
        x: wipePos.x + Math.cos(wipeAngleRad) * UI_CONSTANTS.ROTATION_HANDLE_DISTANCE,
        y: wipePos.y + Math.sin(wipeAngleRad) * UI_CONSTANTS.ROTATION_HANDLE_DISTANCE
    };
}

/**
 * Calculates the position of the alpha slider handle based on wipe position, angle and alpha value.
 * 
 * @param wipePos - The center position of the wipe effect
 * @param wipeAngleDeg - The rotation angle of the wipe in degrees
 * @param wipeAlpha - The alpha/opacity value between 0 and 1
 * @returns Position coordinates for the alpha slider handle
 */
export function calculateAlphaSliderPosition(
    wipePos: { x: number; y: number },
    wipeAngleDeg: number,
    wipeAlpha: number
): { x: number; y: number } {
    const wipeAngleRad = wipeAngleDeg * (Math.PI / 180);
    const alphaAngle = wipeAngleRad - ((UI_CONSTANTS.ALPHA_ARC_END_ANGLE + (1 - wipeAlpha) * (UI_CONSTANTS.ALPHA_ARC_START_ANGLE - UI_CONSTANTS.ALPHA_ARC_END_ANGLE)) * Math.PI / 180);
    return {
        x: wipePos.x + Math.cos(alphaAngle) * UI_CONSTANTS.ALPHA_ARC_RADIUS,
        y: wipePos.y + Math.sin(alphaAngle) * UI_CONSTANTS.ALPHA_ARC_RADIUS
    };
}
