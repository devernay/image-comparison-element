/**
 * Coordinate conversion utilities for the Image Comparison Element.
 * This module provides functions for converting between image and canvas coordinates,
 * taking into account the current pan, zoom, and individual image offsets.
 * 
 * This version is adapted for the web component and takes state as a parameter
 * instead of relying on global state.
 */

import { ImageType } from './types';
import { ElementState } from './state';

/**
 * Converts image coordinates to canvas coordinates.
 * This takes into account the current pan and zoom settings.
 * 
 * @param imageX - X coordinate in image space
 * @param imageY - Y coordinate in image space
 * @param imageType - Which image's coordinate system to use ('A' or 'B')
 * @param state - Component state containing scale and offset information
 * @returns The corresponding coordinates in canvas space
 */
function imageToCanvasCoords(
    imageX: number, 
    imageY: number, 
    imageType: ImageType = 'A',
    state: ElementState
): { x: number, y: number } {
    const offsetX = imageType === 'A' ? state.offsetAX : state.offsetBX;
    const offsetY = imageType === 'A' ? state.offsetAY : state.offsetBY;
    
    return {
        x: imageX * state.scale + state.offsetX + offsetX,
        y: imageY * state.scale + state.offsetY + offsetY
    };
}

/**
 * Converts canvas coordinates to image coordinates.
 * This takes into account the current pan and zoom settings.
 * 
 * @param canvasX - X coordinate in canvas space
 * @param canvasY - Y coordinate in canvas space
 * @param imageType - Which image's coordinate system to use ('A' or 'B')
 * @param state - Component state containing scale and offset information
 * @returns The corresponding coordinates in image space
 */
export function canvasToImageCoords(
    canvasX: number, 
    canvasY: number, 
    imageType: ImageType = 'A',
    state: ElementState
): { x: number, y: number } {
    const offsetX = imageType === 'A' ? state.offsetAX : state.offsetBX;
    const offsetY = imageType === 'A' ? state.offsetAY : state.offsetBY;
    
    return {
        x: (canvasX - state.offsetX - offsetX) / state.scale,
        y: (canvasY - state.offsetY - offsetY) / state.scale
    };
}

/**
 * Gets the wipe position in canvas coordinates.
 * Converts the wipe position from image A coordinates to canvas coordinates.
 * 
 * @param state - Component state containing wipe position and transformation info
 * @returns The wipe position in canvas coordinates
 */
export function getWipePositionInCanvasCoords(state: ElementState): { x: number, y: number } {
    return imageToCanvasCoords(
        state.wipePositionInImageACoords.x,
        state.wipePositionInImageACoords.y,
        'A',
        state
    );
}
