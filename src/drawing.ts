/**
 * Drawing utilities for the Image Comparison Element.
 * This module provides all the rendering functionality including image drawing,
 * composite modes, wipe interface, and UI elements.
 * 
 * This version is adapted for the web component and takes state as a parameter
 * instead of relying on global state. It matches the original single version
 * clipping and composite algorithms exactly.
 */

import { MipMapPyramid } from './types';
import { getWipePositionInCanvasCoords } from './coordinates';
import { UI_CONSTANTS, calculateRotationHandlePosition, calculateAlphaSliderPosition } from './ui-constants';
import { ElementState } from './state';

/**
 * Main drawing function that renders the entire canvas based on current state.
 * This is the primary entry point for all rendering operations.
 * 
 * @param state - Component state containing all rendering parameters
 * @param drawUI - Whether to draw UI elements (handles, wipe line) - defaults to true
 */
export function draw(state: ElementState, drawUI: boolean = true): void {
    if (!state.ctx || !state.canvas) return;
    
    // Clear the canvas with black background
    state.ctx.fillStyle = 'black';
    state.ctx.fillRect(0, 0, state.canvas.width, state.canvas.height);
    
    // Draw checkerboard background if enabled
    if (state.isCheckerboard) {
        // Keep checkerboard fixed to canvas like the single version
        // No offset needed - pattern stays fixed regardless of pan/zoom
        // Use configurable square size from component state
        const squareSize = state.checkerboardSquareSize || 10;
        drawCheckerboard(state.ctx, state.canvas.width, state.canvas.height, 0, 0, squareSize);
    }
    
    // Determine what to draw based on current mode and loaded images
    if (!state.imageALoaded && !state.imageBLoaded) {
        // No images loaded - help screen will be shown by the component
        return;
    }
    
    // Choose rendering method based on current settings
    if (state.isWipeEnabled && state.imageALoaded && state.imageBLoaded) {
        // Draw wipe interface
        drawWipeView(state, drawUI);
    } else {
        // Draw single image or composite without wipe
        drawSingleView(state);
    }
}

/**
 * Creates a checkerboard pattern that can be used as a fill style.
 * This is more efficient than drawing individual squares and matches the single version.
 * 
 * @param ctx - The canvas rendering context to create the pattern for
 * @param squareSize - Size of each square in the checkerboard (default: 10)
 * @param color1 - First color of the checkerboard (default: black)
 * @param color2 - Second color of the checkerboard (default: grey)
 * @returns A CanvasPattern object that can be used as fillStyle
 */
function createCheckerboardPattern(
    ctx: CanvasRenderingContext2D,
    squareSize: number = 10,
    color1: string = 'black',
    color2: string = '#808080' // grey50 to match single version
): CanvasPattern | null {
    // Create a small canvas for the pattern
    const patternCanvas = document.createElement('canvas');
    patternCanvas.width = squareSize * 2;
    patternCanvas.height = squareSize * 2;
    
    const patternCtx = patternCanvas.getContext('2d');
    if (!patternCtx) return null;
    
    // Draw the pattern - fill entire area with first color
    patternCtx.fillStyle = color1;
    patternCtx.fillRect(0, 0, squareSize * 2, squareSize * 2);
    
    // Draw alternating squares with second color
    patternCtx.fillStyle = color2;
    patternCtx.fillRect(0, 0, squareSize, squareSize);
    patternCtx.fillRect(squareSize, squareSize, squareSize, squareSize);
    
    // Create and return the pattern
    return ctx.createPattern(patternCanvas, 'repeat');
}

// Use a WeakMap to store pattern maps by context, with each map storing patterns by square size
// WeakMap allows the patterns to be garbage collected when the context is no longer used
const checkerboardPatterns = new WeakMap<CanvasRenderingContext2D, Map<string, CanvasPattern>>();

/**
 * Draws a checkerboard pattern background using efficient pattern-based rendering.
 * This matches the implementation in the single version for consistency.
 * Used to indicate transparency or as a neutral background.
 * 
 * @param ctx - Canvas rendering context
 * @param width - Canvas width
 * @param height - Canvas height
 * @param offsetX - Optional X offset for pattern alignment (default: 0)
 * @param offsetY - Optional Y offset for pattern alignment (default: 0)
 * @param squareSize - Size of checkerboard squares in pixels (default: 10)
 */
export function drawCheckerboard(
    ctx: CanvasRenderingContext2D, 
    width: number, 
    height: number, 
    offsetX: number = 0, 
    offsetY: number = 0,
    squareSize: number = 10
): void {
    // Create a unique key for this context and square size combination
    const patternKey = `${squareSize}`;
    let patternMap = checkerboardPatterns.get(ctx);
    
    if (!patternMap) {
        patternMap = new Map();
        checkerboardPatterns.set(ctx, patternMap);
    }
    
    let pattern = patternMap.get(patternKey);
    
    if (!pattern) {
        // Create a new pattern for this context and square size
        const newPattern = createCheckerboardPattern(ctx, squareSize);
        if (!newPattern) return; // Exit if pattern creation failed
        
        pattern = newPattern;
        // Store the pattern for future use with this context and square size
        patternMap.set(patternKey, pattern);
    }
    
    // Save the current context state
    ctx.save();
    
    // Set the pattern as fill style
    ctx.fillStyle = pattern;
    
    const patternSize = squareSize * 2;
    // Apply the offset for pattern alignment (if any)
    if (offsetX !== 0 || offsetY !== 0) {
        // Use pattern size (2 * squareSize) for proper alignment
        ctx.translate(-offsetX % patternSize, -offsetY % patternSize);
    }
    
    // Fill the entire canvas with the pattern.
    // Add patternSize in case an offset was applied.
    ctx.fillRect(0, 0, width + patternSize, height + patternSize);
    
    // Restore the context state
    ctx.restore();
}

/**
 * Draws a single view (no wipe interface).
 * This handles all composite modes when wipe is disabled.
 * 
 * @param state - Component state
 */
function drawSingleView(state: ElementState): void {
    if (!state.ctx || !state.canvas) return;
    
    switch (state.compositeMode) {
        case 'A':
            if (state.imageALoaded && state.imageA) {
                drawSingleImage(state, 'A');
            }
            break;
            
        case 'B':
            if (state.imageBLoaded && state.imageB) {
                drawSingleImage(state, 'B');
            }
            break;
            
        case 'Under':
            // Draw A first, then B with alpha blending (only when both are loaded)
            if (state.imageALoaded && state.imageA) {
                drawSingleImage(state, 'A');
            }
            if (state.imageBLoaded && state.imageB) {
                // Only use alpha blending if both images are loaded
                if (state.imageALoaded && state.imageA) {
                    state.ctx.globalAlpha = state.wipeAlpha;
                }
                drawSingleImage(state, 'B');
                state.ctx.globalAlpha = 1.0;
            }
            break;
            
        case 'OnionSkin':
            // Draw A first, then B with additive blending (only when both are loaded)
            if (state.imageALoaded && state.imageA) {
                drawSingleImage(state, 'A');
            }
            if (state.imageBLoaded && state.imageB) {
                // Only use alpha blending if both images are loaded
                if (state.imageALoaded && state.imageA) {
                    state.ctx.globalAlpha = state.wipeAlpha;
                    const originalCompositeOp = state.ctx.globalCompositeOperation;
                    state.ctx.globalCompositeOperation = 'lighter';
                    drawSingleImage(state, 'B');
                    state.ctx.globalCompositeOperation = originalCompositeOp;
                } else {
                    drawSingleImage(state, 'B');
                }
                state.ctx.globalAlpha = 1.0;
            }
            break;
            
        case 'Diff':
        case 'InvDiff':
            if (state.imageALoaded && state.imageBLoaded && state.imageA && state.imageB) {
                drawDifferenceComposite(state, state.compositeMode === 'InvDiff', 1.0);
            }
            break;
    }
}

/**
 * Draws the wipe view with both images and wipe interface.
 * This uses the correct clipping approach: no clipping for A side, 
 * proper geometric clipping for composite side.
 * 
 * @param state - Component state
 * @param drawUI - Whether to draw UI elements (handles, wipe line)
 */
function drawWipeView(state: ElementState, drawUI: boolean = true): void {
    if (!state.ctx || !state.canvas || !state.imageALoaded || !state.imageBLoaded) return;
    
    const canvasWidth = state.canvas.width;
    const canvasHeight = state.canvas.height;
    
    // Calculate the wipe line
    const wipePos = getWipePositionInCanvasCoords(state);
    const wipeAngleRad = state.isSimpleWipe ? 0 : state.wipeAngle * (Math.PI / 180);
    
    // STEP 1: Draw image A as the base layer for the entire canvas (no clipping)
    drawSingleImage(state, 'A');
    
    // STEP 2: Create clipping path for the composite side and draw composite
    state.ctx.save();
    
    // Create clipping path that represents the composite side of the wipe line
    // This is a half-plane defined by the wipe line
    createWipeClippingPath(state.ctx, wipePos, wipeAngleRad, canvasWidth, canvasHeight, state);
    
    // Apply the clipping path
    state.ctx.clip();
    
    // STEP 3: Draw the composite in the clipped region using offscreen canvas
    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = canvasWidth;
    offscreenCanvas.height = canvasHeight;
    const offscreenCtx = offscreenCanvas.getContext('2d');
    
    if (offscreenCtx) {
        // Use effective alpha - for simple wipe always use 1.0, for full wipe use slider value
        const effectiveAlpha = state.isSimpleWipe ? 1.0 : state.wipeAlpha;
        
        // Create temporary state for offscreen rendering
        const offscreenState = {
            ...state,
            ctx: offscreenCtx,
            canvas: offscreenCanvas
        };
        
        // Render composite content to offscreen canvas
        renderCompositeContent(offscreenState, effectiveAlpha);
        
        // Draw the offscreen canvas to the main canvas (in the clipped region)
        state.ctx.globalAlpha = 1.0;
        state.ctx.drawImage(offscreenCanvas, 0, 0);
    }
    
    // Restore the context state after clipping
    state.ctx.restore();
    
    // Draw the wipe line and UI elements only if requested
    if (drawUI) {
        // Draw the wipe line
        drawWipeLine(state.ctx, wipePos, state.wipeAngle);
        
        // Draw wipe UI elements - always draw translation handle, additional handles only for full wipe
        drawWipeUIElements(state.ctx, wipePos, state.wipeAngle, state);
    }
}

/**
 * Creates a clipping path for the composite side of the wipe line.
 * Clips the image B rectangle with the wipe line to get the correct polygon.
 * Result can be: full rectangle, pentagon (cut corner), trapezoid, or triangle.
 * 
 * @param ctx - Canvas rendering context
 * @param wipePos - Wipe position in canvas coordinates
 * @param wipeAngleRad - Wipe angle in radians
 * @param canvasWidth - Canvas width
 * @param canvasHeight - Canvas height
 * @param state - Component state (needed for image B bounds)
 */
export function createWipeClippingPath(
    ctx: CanvasRenderingContext2D,
    wipePos: {x: number, y: number},
    wipeAngleRad: number,
    canvasWidth: number,
    canvasHeight: number,
    state: ElementState
): void {
    if (!state.imageB) return;
    
    // Calculate image B rectangle in canvas coordinates
    const imageBWidth = state.imageB.width * state.scale;
    const imageBHeight = state.imageB.height * state.scale;
    const imageBX = state.offsetX + state.offsetBX;
    const imageBY = state.offsetY + state.offsetBY;
    
    // Define the four corners of image B rectangle
    const rectCorners = [
        {x: imageBX, y: imageBY}, // top-left
        {x: imageBX + imageBWidth, y: imageBY}, // top-right
        {x: imageBX + imageBWidth, y: imageBY + imageBHeight}, // bottom-right
        {x: imageBX, y: imageBY + imageBHeight} // bottom-left
    ];
    
    // Calculate wipe line normal vector (pointing to composite side)
    const normalX = Math.cos(wipeAngleRad);
    const normalY = Math.sin(wipeAngleRad);
    
    // Classify each corner: is it on the composite side of the wipe line?
    const cornerSides = rectCorners.map(corner => {
        const dx = corner.x - wipePos.x;
        const dy = corner.y - wipePos.y;
        const dotProduct = dx * normalX + dy * normalY;
        return {
            corner,
            onCompositeSide: dotProduct > 0,
            distance: dotProduct
        };
    });
    
    // Get corners on composite side
    const compositeCorners = cornerSides.filter(c => c.onCompositeSide).map(c => c.corner);
    
    // If no corners are on composite side, no clipping needed (empty region)
    if (compositeCorners.length === 0) {
        // Create empty clipping path
        ctx.beginPath();
        ctx.rect(0, 0, 0, 0);
        return;
    }
    
    // If all corners are on composite side, use the full rectangle
    if (compositeCorners.length === 4) {
        ctx.beginPath();
        ctx.moveTo(rectCorners[0].x, rectCorners[0].y);
        ctx.lineTo(rectCorners[1].x, rectCorners[1].y);
        ctx.lineTo(rectCorners[2].x, rectCorners[2].y);
        ctx.lineTo(rectCorners[3].x, rectCorners[3].y);
        ctx.closePath();
        return;
    }
    
    // We need to find intersections of the wipe line with rectangle edges
    const intersections: {x: number, y: number}[] = [];
    
    // Calculate wipe line direction vector
    const lineX = -Math.sin(wipeAngleRad);
    const lineY = Math.cos(wipeAngleRad);
    
    // Check intersection with each rectangle edge
    const edges = [
        // Top edge: from top-left to top-right
        {start: rectCorners[0], end: rectCorners[1]},
        // Right edge: from top-right to bottom-right
        {start: rectCorners[1], end: rectCorners[2]},
        // Bottom edge: from bottom-right to bottom-left
        {start: rectCorners[2], end: rectCorners[3]},
        // Left edge: from bottom-left to top-left
        {start: rectCorners[3], end: rectCorners[0]}
    ];
    
    for (const edge of edges) {
        const intersection = findLineIntersection(
            wipePos.x, wipePos.y, wipePos.x + lineX, wipePos.y + lineY,
            edge.start.x, edge.start.y, edge.end.x, edge.end.y
        );
        
        if (intersection && 
            intersection.x >= Math.min(edge.start.x, edge.end.x) - 1e-6 &&
            intersection.x <= Math.max(edge.start.x, edge.end.x) + 1e-6 &&
            intersection.y >= Math.min(edge.start.y, edge.end.y) - 1e-6 &&
            intersection.y <= Math.max(edge.start.y, edge.end.y) + 1e-6) {
            intersections.push(intersection);
        }
    }
    
    // Remove duplicate intersections
    const uniqueIntersections: {x: number, y: number}[] = [];
    for (const intersection of intersections) {
        const isDuplicate = uniqueIntersections.some(existing => 
            Math.abs(existing.x - intersection.x) < 1e-6 && 
            Math.abs(existing.y - intersection.y) < 1e-6
        );
        if (!isDuplicate) {
            uniqueIntersections.push(intersection);
        }
    }
    
    // Create the clipping polygon
    ctx.beginPath();
    
    if (uniqueIntersections.length >= 2) {
        // Build the polygon by combining composite corners and intersections
        // We need to traverse the rectangle boundary and include the right points
        
        const allPoints: {x: number, y: number, type: 'corner' | 'intersection'}[] = [];
        
        // Add composite corners
        for (const corner of compositeCorners) {
            allPoints.push({...corner, type: 'corner'});
        }
        
        // Add intersections
        for (const intersection of uniqueIntersections) {
            allPoints.push({...intersection, type: 'intersection'});
        }
        
        // Sort points to form a proper polygon
        // For simplicity, we'll use a different approach: trace the rectangle boundary
        
        const polygonPoints: {x: number, y: number}[] = [];
        
        // Start from first composite corner and trace boundary
        if (compositeCorners.length > 0) {
            // Add all composite corners
            polygonPoints.push(...compositeCorners);
            
            // Add intersections
            polygonPoints.push(...uniqueIntersections);
            
            // Sort points by angle from centroid to create proper polygon
            const centroidX = polygonPoints.reduce((sum, p) => sum + p.x, 0) / polygonPoints.length;
            const centroidY = polygonPoints.reduce((sum, p) => sum + p.y, 0) / polygonPoints.length;
            
            polygonPoints.sort((a, b) => {
                const angleA = Math.atan2(a.y - centroidY, a.x - centroidX);
                const angleB = Math.atan2(b.y - centroidY, b.x - centroidX);
                return angleA - angleB;
            });
        }
        
        // Draw the polygon
        if (polygonPoints.length > 0) {
            ctx.moveTo(polygonPoints[0].x, polygonPoints[0].y);
            for (let i = 1; i < polygonPoints.length; i++) {
                ctx.lineTo(polygonPoints[i].x, polygonPoints[i].y);
            }
            ctx.closePath();
        }
    } else {
        // Fallback: just use composite corners if we can't find intersections
        if (compositeCorners.length > 0) {
            ctx.moveTo(compositeCorners[0].x, compositeCorners[0].y);
            for (let i = 1; i < compositeCorners.length; i++) {
                ctx.lineTo(compositeCorners[i].x, compositeCorners[i].y);
            }
            ctx.closePath();
        }
    }
}

/**
 * Finds the intersection point of two lines defined by two points each.
 * Returns null if lines are parallel or don't intersect.
 */
function findLineIntersection(
    x1: number, y1: number, x2: number, y2: number,
    x3: number, y3: number, x4: number, y4: number
): {x: number, y: number} | null {
    const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    
    if (Math.abs(denom) < 1e-10) {
        return null; // Lines are parallel
    }
    
    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
    
    return {
        x: x1 + t * (x2 - x1),
        y: y1 + t * (y2 - y1)
    };
}

/**
 * Renders composite content based on the current mode.
 * This matches the original renderCompositeContent function.
 * 
 * @param state - Component state (can be offscreen)
 * @param alpha - Alpha value for blending
 */
export function renderCompositeContent(state: ElementState, alpha: number): void {
    if (!state.ctx) return;
    
    switch (state.compositeMode) {
        case 'Under':
            // Draw A first, then B with alpha blending
            drawSingleImage(state, 'A');
            state.ctx.globalAlpha = alpha;
            drawSingleImage(state, 'B');
            state.ctx.globalAlpha = 1.0;
            break;
            
        case 'OnionSkin': {
            // Draw A first, then B with additive blending
            drawSingleImage(state, 'A');
            state.ctx.globalAlpha = alpha;
            const originalCompositeOp = state.ctx.globalCompositeOperation;
            state.ctx.globalCompositeOperation = 'lighter';
            drawSingleImage(state, 'B');
            state.ctx.globalCompositeOperation = originalCompositeOp;
            state.ctx.globalAlpha = 1.0;
            break;
        }
            
        case 'A':
            drawSingleImage(state, 'A');
            break;
            
        case 'B':
            drawSingleImage(state, 'B');
            break;
            
        case 'Diff':
        case 'InvDiff':
            drawDifferenceComposite(state, state.compositeMode === 'InvDiff', alpha);
            break;
    }
}

/**
 * Draws a single image (A or B) to the canvas.
 * 
 * @param state - Component state
 * @param imageType - Which image to draw ('A' or 'B')
 */
export function drawSingleImage(
    state: ElementState,
    imageType: 'A' | 'B'
): void {
    if (!state.ctx) return;
    
    const image = imageType === 'A' ? state.imageA : state.imageB;
    const mipMaps = imageType === 'A' ? state.imageAMipMaps : state.imageBMipMaps;
    const offsetX = imageType === 'A' ? state.offsetAX : state.offsetBX;
    const offsetY = imageType === 'A' ? state.offsetAY : state.offsetBY;
    
    if (!image) return;
    
    // Calculate image position
    const imageX = state.offsetX + offsetX;
    const imageY = state.offsetY + offsetY;
    const imageWidth = image.width * state.scale;
    const imageHeight = image.height * state.scale;
    
    // Use mip-maps if available for better quality
    if (mipMaps && mipMaps.length > 0) {
        renderImageWithMipMaps(
            state.ctx,
            image,
            mipMaps,
            imageX,
            imageY,
            imageWidth,
            imageHeight,
            state.scale
        );
    } else {
        // Fallback to direct rendering
        // Use nearest neighbor interpolation when zoomed in (scale >= 1)
        // Use bilinear interpolation when zoomed out (scale < 1)
        state.ctx.imageSmoothingEnabled = state.scale < 1;
        
        state.ctx.drawImage(
            image,
            0, 0, image.width, image.height,
            imageX, imageY, imageWidth, imageHeight
        );
    }
}

/**
 * Renders an image with mip-mapping for better quality at different zoom levels.
 * 
 * @param ctx - Canvas rendering context
 * @param originalImage - Original full-resolution image
 * @param mipMaps - Mip-map pyramid
 * @param destX - Destination X coordinate
 * @param destY - Destination Y coordinate
 * @param destWidth - Destination width
 * @param destHeight - Destination height
 * @param scale - Current scale factor
 */
function renderImageWithMipMaps(
    ctx: CanvasRenderingContext2D,
    originalImage: HTMLImageElement,
    mipMaps: MipMapPyramid,
    destX: number,
    destY: number,
    destWidth: number,
    destHeight: number,
    scale: number
): void {
    // Select appropriate mip level based on scale
    let mipLevel = 0;
    let currentScale = scale;
    
    while (currentScale < 0.5 && mipLevel < mipMaps.length - 1) {
        currentScale *= 2;
        mipLevel++;
    }
    
    const imageToUse = mipLevel === 0 ? originalImage : mipMaps[mipLevel - 1];
    
    // Use nearest neighbor interpolation when zoomed in (scale >= 1)
    // Use bilinear interpolation when zoomed out (scale < 1)
    ctx.imageSmoothingEnabled = scale < 1;
    
    ctx.drawImage(
        imageToUse,
        0, 0, imageToUse.width, imageToUse.height,
        destX, destY, destWidth, destHeight
    );
}

/**
 * Draws the wipe line itself.
 * Centers the line segment on the projection of canvas center onto the wipe line.
 * 
 * @param ctx - Canvas rendering context
 * @param wipePos - Wipe position in canvas coordinates (not used for centering)
 * @param wipeAngleDeg - Wipe angle in degrees
 */
export function drawWipeLine(ctx: CanvasRenderingContext2D, wipePos: {x: number, y: number}, wipeAngleDeg: number): void {
    ctx.save();
    
    // Set styles for the wipe line
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 1;
    ctx.shadowColor = 'black';
    ctx.shadowBlur = 2;
    
    // Calculate canvas center
    const canvasCenterX = ctx.canvas.width / 2;
    const canvasCenterY = ctx.canvas.height / 2;
    
    // Convert angle to radians and calculate wipe line direction vector
    const wipeAngleRad = wipeAngleDeg * (Math.PI / 180);
    const lineX = -Math.sin(wipeAngleRad);
    const lineY = Math.cos(wipeAngleRad);
    
    // Project canvas center onto the wipe line
    // Vector from wipe position to canvas center
    const toCenterX = canvasCenterX - wipePos.x;
    const toCenterY = canvasCenterY - wipePos.y;
    
    // Project this vector onto the wipe line direction
    const projectionLength = toCenterX * lineX + toCenterY * lineY;
    
    // Find the projection point on the wipe line
    const projectionX = wipePos.x + projectionLength * lineX;
    const projectionY = wipePos.y + projectionLength * lineY;
    
    // Calculate line endpoints centered on the projection point
    // Use a length that ensures the line extends across the entire canvas
    const lineLength = Math.max(ctx.canvas.width, ctx.canvas.height) * 2;
    const x1 = projectionX - lineX * lineLength;
    const y1 = projectionY - lineY * lineLength;
    const x2 = projectionX + lineX * lineLength;
    const y2 = projectionY + lineY * lineLength;
    
    // Draw the wipe line
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    
    ctx.restore();
}

/**
 * Draws the wipe UI elements (handles and controls).
 * 
 * @param ctx - Canvas rendering context
 * @param wipePos - Wipe position in canvas coordinates
 * @param wipeAngleDeg - Wipe angle in degrees
 * @param state - Component state
 */
function drawWipeUIElements(
    ctx: CanvasRenderingContext2D,
    wipePos: {x: number, y: number},
    wipeAngleDeg: number,
    state: ElementState
): void {
    ctx.save();
    
    // Set styles for UI elements - match original exactly
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 1;
    ctx.shadowColor = 'black';
    ctx.shadowBlur = 2;
    ctx.fillStyle = 'white';
    
    // Draw translation handle (center dot)
    ctx.beginPath();
    ctx.arc(wipePos.x, wipePos.y, UI_CONSTANTS.TRANSLATION_HANDLE_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    
    // If using the full wipe interface (not simple wipe), draw additional controls
    if (!state.isSimpleWipe) {
        // Calculate rotation handle position
        const rotHandlePos = calculateRotationHandlePosition(wipePos, wipeAngleDeg);
        
        // Draw line to rotation handle
        ctx.beginPath();
        ctx.moveTo(wipePos.x, wipePos.y);
        ctx.lineTo(rotHandlePos.x, rotHandlePos.y);
        ctx.stroke();
        
        // Draw rotation handle
        ctx.beginPath();
        ctx.arc(rotHandlePos.x, rotHandlePos.y, UI_CONSTANTS.ROTATION_HANDLE_RADIUS, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // Draw alpha arc - match original arc extent
        const wipeAngleRad = wipeAngleDeg * (Math.PI / 180);
        const startAngle = wipeAngleRad - (UI_CONSTANTS.ALPHA_ARC_START_ANGLE * Math.PI / 180);
        const endAngle = wipeAngleRad - (UI_CONSTANTS.ALPHA_ARC_END_ANGLE * Math.PI / 180);
        
        ctx.beginPath();
        ctx.arc(wipePos.x, wipePos.y, UI_CONSTANTS.ALPHA_ARC_RADIUS, startAngle, endAngle);
        ctx.stroke();
        
        // Calculate alpha slider position
        const alphaSliderPos = calculateAlphaSliderPosition(wipePos, wipeAngleDeg, state.wipeAlpha);
        
        // Draw alpha slider
        ctx.beginPath();
        ctx.arc(alphaSliderPos.x, alphaSliderPos.y, UI_CONSTANTS.ALPHA_HANDLE_RADIUS, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    }
    
    ctx.restore();
}

/**
 * Draws difference composite between two images.
 * 
 * @param state - Component state
 * @param inverted - Whether to invert the difference
 * @param alpha - Alpha value for blending (0-1)
 */
function drawDifferenceComposite(state: ElementState, inverted: boolean, alpha: number = 1.0): void {
    if (!state.ctx || !state.imageA || !state.imageB) return;
    
    // Create an offscreen canvas for the difference calculation
    const offCanvas = document.createElement('canvas');
    offCanvas.width = state.canvas!.width;
    offCanvas.height = state.canvas!.height;
    const offCtx = offCanvas.getContext('2d');
    
    if (!offCtx) return;
    
    if (inverted) {
        // Fill with white for inverted difference
        offCtx.fillStyle = 'white';
        offCtx.fillRect(0, 0, offCanvas.width, offCanvas.height);
    }
    
    // Draw image B
    drawSingleImage({ ...state, ctx: offCtx, canvas: offCanvas }, 'B');
    
    // Set difference blend mode
    offCtx.globalCompositeOperation = 'difference';
    
    // Draw image A
    drawSingleImage({ ...state, ctx: offCtx, canvas: offCanvas }, 'A');
    
    if (inverted) {
        // Invert the difference
        offCtx.globalCompositeOperation = 'difference';
        offCtx.fillStyle = 'white';
        offCtx.fillRect(0, 0, offCanvas.width, offCanvas.height);
    }
    
    // Draw the result to the main canvas with alpha
    state.ctx.globalAlpha = alpha;
    state.ctx.drawImage(offCanvas, 0, 0);
    state.ctx.globalAlpha = 1.0; // Reset alpha
}
