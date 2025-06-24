/**
 * Magnifier functionality for the Image Comparison Element.
 * This module provides configurable zoom magnification functionality that shows
 * a detailed view of the area around the mouse cursor.
 */

import { drawSingleImage, renderCompositeContent, createWipeClippingPath, drawWipeLine, drawCheckerboard } from './drawing';
import { getWipePositionInCanvasCoords } from './coordinates';
import { ElementState } from './state';

/**
 * Updates the magnifier position and content.
 * 
 * @param magnifierContainer - The container element for the magnifier
 * @param magnifierCanvas - The canvas element for rendering the magnified content
 * @param x - X coordinate of the mouse pointer in canvas coordinates
 * @param y - Y coordinate of the mouse pointer in canvas coordinates
 * @param state - Element state
 */
export function updateMagnifier(
    magnifierContainer: HTMLDivElement,
    magnifierCanvas: HTMLCanvasElement,
    x: number,
    y: number,
    state: ElementState
): void {
    // Use configurable magnifier properties from state (with fallbacks for backward compatibility)
    const magnifierRadius = state.magnifierRadius || 200;
    const zoom = state.magnifierZoomFactor || 8;
    const borderSize = state.magnifierBorderSize || 2;
    
    // Skip magnifier update if zoom factor is <= 0 (disabled)
    if (zoom <= 0) return;
    
    // Position magnifier container - center it on the mouse position, accounting for border
    magnifierContainer.style.left = `${x - magnifierRadius - borderSize}px`;
    magnifierContainer.style.top = `${y - magnifierRadius - borderSize}px`;
    
    // Ensure the magnifier canvas has the correct size (diameter = radius * 2)
    const magnifierDiameter = magnifierRadius * 2;
    if (magnifierCanvas.width !== magnifierDiameter || magnifierCanvas.height !== magnifierDiameter) {
        magnifierCanvas.width = magnifierDiameter;
        magnifierCanvas.height = magnifierDiameter;
    }
    
    // Get the 2D rendering context for the magnifier canvas
    const magCtx = magnifierCanvas.getContext('2d');
    if (!magCtx) return;
    
    // Clear previous content and set default black background
    magCtx.fillStyle = 'black';
    magCtx.fillRect(0, 0, magnifierDiameter, magnifierDiameter);
    
    // Create a circular clipping path for the magnifier content
    magCtx.save();
    magCtx.beginPath();
    magCtx.arc(magnifierRadius, magnifierRadius, magnifierRadius, 0, Math.PI * 2);
    magCtx.clip();
    
    // Calculate the world coordinates that should be at the center of the magnifier
    // This is the key to proper magnifier centering
    const worldX = (x - state.offsetX) / state.scale;
    const worldY = (y - state.offsetY) / state.scale;
    
    // Calculate the offset needed to center the world coordinates in the magnifier
    const magnifierOffsetX = magnifierRadius - worldX * state.scale * zoom;
    const magnifierOffsetY = magnifierRadius - worldY * state.scale * zoom;
    
    // Draw checkerboard background if enabled
    if (state.isCheckerboard) {
        // Calculate offset to make magnifier checkerboard align with main canvas pattern
        // The magnifier should show the checkerboard as if we're looking at the main canvas
        // through a magnifying glass - the pattern should be continuous
        
        // The mouse position (x, y) represents where we're looking on the main canvas
        // The magnifier shows this area zoomed in, so the checkerboard pattern should
        // align as if this area was extracted from the main canvas
        const offsetX = x - magnifierRadius;
        const offsetY = y - magnifierRadius;
        
        // Use configurable square size from component state
        const squareSize = state.checkerboardSquareSize || 10;
        drawCheckerboard(magCtx, magnifierDiameter, magnifierDiameter, offsetX, offsetY, squareSize);
    }
    
    // Create a temporary state for magnifier rendering with adjusted offsets
    const magnifierState: ElementState = {
        canvas: magnifierCanvas,
        ctx: magCtx,
        imageA: state.imageA,
        imageB: state.imageB,
        imageAData: state.imageAData,
        imageBData: state.imageBData,
        imageAMipMaps: state.imageAMipMaps,
        imageBMipMaps: state.imageBMipMaps,
        imageALoaded: state.imageALoaded,
        imageBLoaded: state.imageBLoaded,
        scale: state.scale * zoom,
        offsetX: magnifierOffsetX,
        offsetY: magnifierOffsetY,
        offsetAX: state.offsetAX * zoom,
        offsetAY: state.offsetAY * zoom,
        offsetBX: state.offsetBX * zoom,
        offsetBY: state.offsetBY * zoom,
        wipePositionInImageACoords: state.wipePositionInImageACoords,
        wipeAngle: state.wipeAngle,
        wipeAlpha: state.wipeAlpha,
        isWipeEnabled: state.isWipeEnabled,
        isSimpleWipe: state.isSimpleWipe,
        isCheckerboard: state.isCheckerboard,
        compositeMode: state.compositeMode,
        showHelp: state.showHelp,
        magnifierRadius: state.magnifierRadius,
        magnifierZoomFactor: state.magnifierZoomFactor
    };
    
    // Render the appropriate content based on the current mode
    if (state.compositeMode === 'A') {
        // Show only image A
        if (state.imageA && state.imageALoaded) {
            drawSingleImage(magnifierState, 'A');
        }
    } else if (state.compositeMode === 'B') {
        // Show only image B
        if (state.imageB && state.imageBLoaded) {
            drawSingleImage(magnifierState, 'B');
        }
    } else {
        // Composite modes (Under, OnionSkin, Diff, InvDiff)
        if (state.isWipeEnabled) {
            // Apply wipe effect using the same logic as the main drawing function
            const wipeCanvasCoords = getWipePositionInCanvasCoords(magnifierState);
            
            // STEP 1: Draw image A as the base layer (no clipping)
            if (state.imageA && state.imageALoaded) {
                drawSingleImage(magnifierState, 'A');
            }
            
            // STEP 2: Create clipping path for the composite side and draw composite
            magCtx.save();
            
            // Create clipping path that represents the composite side of the wipe line
            createWipeClippingPath(magCtx, wipeCanvasCoords, state.wipeAngle * Math.PI / 180, 
                                 magnifierDiameter, magnifierDiameter, magnifierState);
            
            // Apply the clipping path
            magCtx.clip();
            
            // STEP 3: Draw the composite in the clipped region
            if (state.imageA && state.imageALoaded && state.imageB && state.imageBLoaded) {
                // Use effective alpha - for simple wipe always use 1.0, for full wipe use slider value
                const effectiveAlpha = state.isSimpleWipe ? 1.0 : state.wipeAlpha;
                
                // Create temporary state for composite rendering with effective alpha
                const compositeState: ElementState = {
                    ...magnifierState,
                    wipeAlpha: effectiveAlpha
                };
                
                renderCompositeContent(compositeState, effectiveAlpha);
            }
            
            magCtx.restore();
            
            // STEP 4: Draw wipe line
            drawWipeLine(magCtx, wipeCanvasCoords, state.wipeAngle * Math.PI / 180);
        } else {
            // No wipe - render composite content directly
            if (state.imageA && state.imageALoaded && state.imageB && state.imageBLoaded) {
                renderCompositeContent(magnifierState, state.wipeAlpha);
            }
        }
    }
    
    // Restore the context to remove the clipping path
    magCtx.restore();
    
    // Draw crosshair in the center of the magnifier
    magCtx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    magCtx.lineWidth = 1;
    
    // Horizontal line
    magCtx.beginPath();
    magCtx.moveTo(0, magnifierRadius);
    magCtx.lineTo(magnifierDiameter, magnifierRadius);
    magCtx.stroke();
    
    // Vertical line
    magCtx.beginPath();
    magCtx.moveTo(magnifierRadius, 0);
    magCtx.lineTo(magnifierRadius, magnifierDiameter);
    magCtx.stroke();
}
