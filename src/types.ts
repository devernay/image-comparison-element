/**
 * Defines the available composite modes for image blending.
 * - 'Under': B over A (Porter-Duff over)
 * - 'OnionSkin': Add B to A with lighter blend
 * - 'Diff': Show absolute difference between A and B
 * - 'InvDiff': Show inverted difference between A and B
 * - 'A': Show only image A
 * - 'B': Show only image B
 */
export type CompositeMode = 'Under' | 'OnionSkin' | 'Diff' | 'InvDiff' | 'A' | 'B';

/**
 * Defines the types of interactive handles in the wipe interface.
 * - 'translation': The center dot that moves the wipe line
 * - 'rotation': The handle that rotates the wipe line
 * - 'alpha': The slider that adjusts blending between images
 * - null: No handle is currently active
 */
export type HandleType = 'translation' | 'rotation' | 'alpha' | null;

/**
 * Represents a pyramid of progressively smaller versions of an image.
 * Used for efficient rendering at different zoom levels.
 * The first element is the original image, and each subsequent element
 * is half the size of the previous one.
 */
export type MipMapPyramid = HTMLImageElement[];

/**
 * Defines which image is being referenced (A or B).
 * Used throughout the application to specify which image to operate on.
 */
export type ImageType = 'A' | 'B';
