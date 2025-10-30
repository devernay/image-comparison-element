/**
 * Analysis utilities for the Image Comparison Element.
 * This module provides functions for calculating image quality metrics
 * and performing pixel-level comparisons between images.
 * 
 * This version is adapted for the web component and doesn't rely on global state.
 */

/**
 * Calculates the Peak Signal-to-Noise Ratio (PSNR) between two images.
 * 
 * PSNR is a quality metric that measures the similarity between two images.
 * Higher values indicate more similar images. The calculation takes into account
 * the current position and offset of both images, and only compares the
 * overlapping regions.
 * 
 * @param imageAData - Pixel data for image A
 * @param imageBData - Pixel data for image B
 * @param imageA - Image A element (for dimensions)
 * @param imageB - Image B element (for dimensions)
 * @param offsetAX - X offset for image A
 * @param offsetAY - Y offset for image A
 * @param offsetBX - X offset for image B
 * @param offsetBY - Y offset for image B
 * @param scale - Current scale factor
 * @param callback - Callback to receive the result asynchronously
 */
export function calculatePSNRForImages(
    imageAData: ImageData | null,
    imageBData: ImageData | null,
    imageA: HTMLImageElement | null,
    imageB: HTMLImageElement | null,
    offsetAX: number,
    offsetAY: number,
    offsetBX: number,
    offsetBY: number,
    scale: number,
    callback: (result: string) => void
): void {
    // Check if we have both images and their data
    if (!imageAData || !imageBData || !imageA || !imageB) {
        callback("PSNR: N/A");
        return;
    }
    
    // Calculate the overlapping region between the two images
    const overlapInfo = calculateImageOverlap(
        imageA.width, imageA.height, offsetAX, offsetAY,
        imageB.width, imageB.height, offsetBX, offsetBY,
        scale
    );
    
    if (!overlapInfo || overlapInfo.width <= 0 || overlapInfo.height <= 0) {
        callback("PSNR: No overlap");
        return;
    }
    
    // Calculate MSE (Mean Squared Error) over the overlapping region
    // Process in chunks to keep UI responsive
    let mse = 0;
    let pixelCount = 0;
    let currentRow = 0;
    const rowsPerChunk = 50; // Process 50 rows at a time
    
    const processChunk = (): void => {
        const endRow = Math.min(currentRow + rowsPerChunk, overlapInfo.height);
        
        for (let y = currentRow; y < endRow; y++) {
            for (let x = 0; x < overlapInfo.width; x++) {
                // Calculate pixel positions in each image
                const aX = Math.floor(overlapInfo.aStartX + x);
                const aY = Math.floor(overlapInfo.aStartY + y);
                const bX = Math.floor(overlapInfo.bStartX + x);
                const bY = Math.floor(overlapInfo.bStartY + y);
                
                // Check bounds
                if (aX >= 0 && aX < imageA.width && aY >= 0 && aY < imageA.height &&
                    bX >= 0 && bX < imageB.width && bY >= 0 && bY < imageB.height) {
                    
                    // Get pixel indices
                    const aIndex = (aY * imageA.width + aX) * 4;
                    const bIndex = (bY * imageB.width + bX) * 4;
                    
                    // Calculate squared differences for RGB channels
                    const rDiff = imageAData.data[aIndex] - imageBData.data[bIndex];
                    const gDiff = imageAData.data[aIndex + 1] - imageBData.data[bIndex + 1];
                    const bDiff = imageAData.data[aIndex + 2] - imageBData.data[bIndex + 2];
                    
                    mse += rDiff * rDiff + gDiff * gDiff + bDiff * bDiff;
                    pixelCount++;
                }
            }
        }
        
        currentRow = endRow;
        
        if (currentRow < overlapInfo.height) {
            // More rows to process - schedule next chunk
            setTimeout(processChunk, 0);
        } else {
            // All rows processed - calculate final result
            if (pixelCount === 0) {
                callback("PSNR: No valid pixels");
                return;
            }
            
            // Calculate average MSE
            mse = mse / (pixelCount * 3); // Divide by 3 for RGB channels
            
            if (mse === 0) {
                callback("PSNR: ∞ (identical)");
                return;
            }
            
            // Calculate PSNR: 20 * log10(MAX_I) - 10 * log10(MSE)
            // where MAX_I is the maximum possible pixel value (255 for 8-bit)
            const psnr = 20 * Math.log10(255) - 10 * Math.log10(mse);
            callback(`PSNR: ${psnr.toFixed(2)} dB`);
        }
    };
    
    // Start processing
    processChunk();
}

/**
 * Calculates the overlapping region between two images given their positions and offsets.
 * 
 * @param aWidth - Width of image A
 * @param aHeight - Height of image A
 * @param aOffsetX - X offset of image A
 * @param aOffsetY - Y offset of image A
 * @param bWidth - Width of image B
 * @param bHeight - Height of image B
 * @param bOffsetX - X offset of image B
 * @param bOffsetY - Y offset of image B
 * @param scale - Current scale factor
 * @returns Overlap information or null if no overlap
 */
function calculateImageOverlap(
    aWidth: number, aHeight: number, aOffsetX: number, aOffsetY: number,
    bWidth: number, bHeight: number, bOffsetX: number, bOffsetY: number,
    scale: number
): {
    width: number;
    height: number;
    aStartX: number;
    aStartY: number;
    bStartX: number;
    bStartY: number;
} | null {
    // Convert offsets from screen coordinates to image coordinates
    const aImageOffsetX = aOffsetX / scale;
    const aImageOffsetY = aOffsetY / scale;
    const bImageOffsetX = bOffsetX / scale;
    const bImageOffsetY = bOffsetY / scale;
    
    // Calculate the bounds of each image in a common coordinate system
    const aLeft = aImageOffsetX;
    const aTop = aImageOffsetY;
    const aRight = aLeft + aWidth;
    const aBottom = aTop + aHeight;
    
    const bLeft = bImageOffsetX;
    const bTop = bImageOffsetY;
    const bRight = bLeft + bWidth;
    const bBottom = bTop + bHeight;
    
    // Calculate overlap bounds
    const overlapLeft = Math.max(aLeft, bLeft);
    const overlapTop = Math.max(aTop, bTop);
    const overlapRight = Math.min(aRight, bRight);
    const overlapBottom = Math.min(aBottom, bBottom);
    
    // Check if there's actually an overlap
    if (overlapLeft >= overlapRight || overlapTop >= overlapBottom) {
        return null;
    }
    
    return {
        width: overlapRight - overlapLeft,
        height: overlapBottom - overlapTop,
        aStartX: overlapLeft - aLeft,
        aStartY: overlapTop - aTop,
        bStartX: overlapLeft - bLeft,
        bStartY: overlapTop - bTop
    };
}
