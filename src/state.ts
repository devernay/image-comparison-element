/**
 * Shared element state interface for the Image Comparison Element Web Element.
 * This interface defines the complete state structure used throughout the element
 * and its modules, eliminating duplicate interface definitions.
 */

import { CompositeMode, MipMapPyramid } from './types';

/**
 * Complete element state interface used by the web element and all its modules.
 * This represents the full state of an image comparison element instance.
 */
export interface ElementState {
    /** The main canvas element */
    canvas: HTMLCanvasElement | null;
    
    /** The 2D rendering context of the canvas */
    ctx: CanvasRenderingContext2D | null;
    
    /** The first image (A) to compare */
    imageA: HTMLImageElement | null;
    
    /** The second image (B) to compare */
    imageB: HTMLImageElement | null;
    
    /** Pixel data for image A */
    imageAData: ImageData | null;
    
    /** Pixel data for image B */
    imageBData: ImageData | null;
    
    /** Mip-map pyramid for image A for efficient rendering at different zoom levels */
    imageAMipMaps: MipMapPyramid | null;
    
    /** Mip-map pyramid for image B for efficient rendering at different zoom levels */
    imageBMipMaps: MipMapPyramid | null;
    
    /** Whether image A has been loaded successfully */
    imageALoaded: boolean;
    
    /** Whether image B has been loaded successfully */
    imageBLoaded: boolean;
    
    /** Current zoom scale factor */
    scale: number;
    
    /** Global X offset for both images */
    offsetX: number;
    
    /** Global Y offset for both images */
    offsetY: number;
    
    /** Additional X offset specific to image A */
    offsetAX: number;
    
    /** Additional Y offset specific to image A */
    offsetAY: number;
    
    /** Additional X offset specific to image B */
    offsetBX: number;
    
    /** Additional Y offset specific to image B */
    offsetBY: number;
    
    /** Whether the wipe interface is enabled */
    isWipeEnabled: boolean;
    
    /** Whether to use the simple vertical wipe (true) or the full wipe interface (false) */
    isSimpleWipe: boolean;
    
    /** Angle of the wipe line in degrees */
    wipeAngle: number;
    
    /** Position of the wipe line center in image A coordinates */
    wipePositionInImageACoords: { x: number, y: number };
    
    /** Alpha blending value for the wipe interface (0-1) */
    wipeAlpha: number;
    
    /** Whether to show the checkerboard background */
    isCheckerboard: boolean;
    
    /** Size of checkerboard squares in pixels (default: 10) */
    checkerboardSquareSize?: number;
    
    /** Current composite mode for blending images */
    compositeMode: CompositeMode;
    
    /** Whether to show the help screen */
    showHelp: boolean;
    
    /** Radius of the magnifier in pixels (default: 200) */
    magnifierRadius?: number;
    
    /** Zoom factor for the magnifier (default: 8) */
    magnifierZoomFactor?: number;
    
    /** Border size of the magnifier in pixels (default: 2) */
    magnifierBorderSize?: number;
}