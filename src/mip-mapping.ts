import { MipMapPyramid } from './types';

/**
 * Creates a mip-map pyramid for an image to improve rendering quality at different zoom levels.
 * 
 * Mip-mapping is a technique that pre-generates multiple versions of an image at different
 * resolutions. Each level in the pyramid is half the size of the previous level. This allows
 * for better quality rendering when zoomed out, as the appropriate resolution can be selected
 * based on the current zoom level.
 * 
 * @param image - The original image to create mip-maps from
 * @returns A promise that resolves to an array of images forming the mip-map pyramid
 */
export function createMipMaps(image: HTMLImageElement): Promise<MipMapPyramid> {
    return new Promise((resolve) => {
        // Start with the original image as level 0
        const mipMaps: MipMapPyramid = [image];
        
        // Track the current dimensions
        let width = image.width;
        let height = image.height;
        
        // If the image is very small, don't create mip-maps
        if (width < 4 || height < 4) {
            resolve(mipMaps);
            return;
        }
        
        /**
         * Recursive function to create the next mip level
         * Each level is half the size of the previous level
         * 
         * @returns void
         */
        const createNextLevel = (): void => {
            // Stop if we've reached a very small size
            if (width <= 1 && height <= 1) {
                resolve(mipMaps);
                return;
            }
            
            // Calculate next mip level size (half size)
            width = Math.max(1, Math.floor(width / 2));
            height = Math.max(1, Math.floor(height / 2));
            
            // Create a temporary canvas for downsampling
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            
            // Handle case where canvas context couldn't be created
            if (!ctx) {
                resolve(mipMaps);
                return;
            }
            
            // Use bilinear interpolation for better quality downsampling
            ctx.imageSmoothingEnabled = true;
            
            // Draw the previous level image at half size
            ctx.drawImage(mipMaps[mipMaps.length - 1], 0, 0, width, height);
            
            // Convert canvas to image
            const img = new Image();
            
            // When the image loads, add it to the pyramid and continue
            img.onload = (): void => {
                mipMaps.push(img);
                createNextLevel(); // Create next level recursively
            };
            
            // Set the image source to the canvas data
            img.src = canvas.toDataURL();
        };
        
        // Start creating mip levels
        createNextLevel();
    });
}
