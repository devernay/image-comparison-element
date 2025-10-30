/**
 * Image Comparison Element
 * 
 * A custom HTML element that provides image comparison functionality with wipe interface,
 * multiple composite modes, and interactive controls. This component encapsulates all
 * the functionality of the original single-page application into a reusable element
 * that can be embedded multiple times on any web page.
 * 
 * @example
 * ```html
 * <image-comparison 
 *   image-a="path/to/imageA.jpg"
 *   image-b="path/to/imageB.jpg"
 *   display-mode="Under"
 *   wipe-mode="simple">
 * </image-comparison>
 * ```
 */

import { CompositeMode, HandleType, ImageType, MipMapPyramid } from './types';
import { createMipMaps } from './mip-mapping';
import { calculatePSNRForImages } from './analysis';
import { canvasToImageCoords, getWipePositionInCanvasCoords } from './coordinates';
import { draw as drawCanvas } from './drawing';
import { updateMagnifier } from './magnifier';
import { UI_CONSTANTS, calculateRotationHandlePosition, calculateAlphaSliderPosition } from './ui-constants';
import { ElementState } from './state';

/**
 * Custom HTML element for image comparison functionality.
 * 
 * This element provides a complete image comparison interface with support for:
 * - Multiple composite modes (Under, OnionSkin, Diff, InvDiff, A, B)
 * - Interactive wipe interface (simple and full modes)
 * - Zoom and pan functionality
 * - Magnifier with 8x zoom
 * - Keyboard shortcuts
 * - Drag and drop image loading
 * - PSNR calculation
 * 
 * The component maintains its own isolated state and can be used multiple times
 * on the same page without interference.
 */
export class ImageComparisonElement extends HTMLElement {
    // Shadow DOM root for complete encapsulation
    private shadow: ShadowRoot;
    
    // Element state - mirrors the original global state structure but isolated per instance
    private state: ElementState = {
        /** The main canvas element */
        canvas: null as HTMLCanvasElement | null,
        
        /** The 2D rendering context of the canvas */
        ctx: null as CanvasRenderingContext2D | null,
        
        /** The first image (A) to compare */
        imageA: null as HTMLImageElement | null,
        
        /** The second image (B) to compare */
        imageB: null as HTMLImageElement | null,
        
        /** Pixel data for image A */
        imageAData: null as ImageData | null,
        
        /** Pixel data for image B */
        imageBData: null as ImageData | null,
        
        /** Mip-map pyramid for image A for efficient rendering at different zoom levels */
        imageAMipMaps: null as MipMapPyramid | null,
        
        /** Mip-map pyramid for image B for efficient rendering at different zoom levels */
        imageBMipMaps: null as MipMapPyramid | null,
        
        /** Whether image A has been loaded successfully */
        imageALoaded: false,
        
        /** Whether image B has been loaded successfully */
        imageBLoaded: false,
        
        /** Current zoom scale factor */
        scale: 1,
        
        /** Global X offset for both images */
        offsetX: 0,
        
        /** Global Y offset for both images */
        offsetY: 0,
        
        /** Additional X offset specific to image A */
        offsetAX: 0,
        
        /** Additional Y offset specific to image A */
        offsetAY: 0,
        
        /** Additional X offset specific to image B */
        offsetBX: 0,
        
        /** Additional Y offset specific to image B */
        offsetBY: 0,
        
        /** Whether the wipe interface is enabled */
        isWipeEnabled: true,
        
        /** Whether to use the simple vertical wipe (true) or the full wipe interface (false) */
        isSimpleWipe: false,
        
        /** Angle of the wipe line in degrees */
        wipeAngle: 0,
        
        /** Position of the wipe line center in image A coordinates */
        wipePositionInImageACoords: { x: 0, y: 0 },
        
        /** Alpha blending value for the wipe interface (0-1) */
        wipeAlpha: 1,
        
        /** Whether to show the checkerboard background */
        isCheckerboard: false,
        
        /** Current composite mode for blending images */
        compositeMode: 'Under' as CompositeMode,
        
        /** Whether to show the help screen */
        showHelp: true,
        
        /** Radius of the magnifier in pixels (default: 200) */
        magnifierRadius: 200,
        
        /** Zoom factor for the magnifier (default: 8) */
        magnifierZoomFactor: 8,
        
        /** Border size of the magnifier in pixels (default: 2) */
        magnifierBorderSize: 2,
        
        /** Size of checkerboard squares in pixels (default: 10) */
        checkerboardSquareSize: 10
    };
    
    // Additional component-specific state not in the original global state
    /** Previous wipe angle, stored when switching to simple wipe mode or other modes */
    private previousWipeAngle = 0;
    
    /** Previous wipe alpha, stored when switching to simple wipe mode or other modes */
    private previousWipeAlpha = 1;
    
    /** Previous composite mode, stored when switching to A or B mode */
    private lastCompositeMode: CompositeMode = 'Under';
    
    // Interaction state variables (from original index.ts)
    /** Whether the user is currently dragging */
    private isDragging = false;
    
    /** X coordinate where dragging started */
    private dragStartX = 0;
    
    /** Y coordinate where dragging started */
    private dragStartY = 0;
    
    /** Last recorded mouse X position */
    private lastMouseX = 0;
    
    /** Last recorded mouse Y position */
    private lastMouseY = 0;
    
    /** Whether the magnifier is currently visible */
    private showMagnifier = false;
    
    /** Which handle is currently being dragged (null if none) */
    private activeHandle: HandleType = null;
    
    /** Whether help was manually toggled (vs auto-shown) */
    private manuallyToggledHelp = false;
    
    /** Which side of the wipe is being dragged when shift is held */
    private dragSide: 'A' | 'B' | null = null;
    
    /** Accumulated movement for pixel-perfect positioning */
    private accumulatedDX = 0;
    
    /** Accumulated movement for pixel-perfect positioning */
    private accumulatedDY = 0;
    
    // DOM element references within the shadow DOM
    private magnifierContainer!: HTMLDivElement;
    private magnifierCanvas!: HTMLCanvasElement;
    private dragMessage!: HTMLDivElement;
    private uploadA!: HTMLDivElement;
    private uploadB!: HTMLDivElement;
    private fileInputA!: HTMLInputElement;
    private fileInputB!: HTMLInputElement;
    private filenameA!: HTMLSpanElement;
    private filenameB!: HTMLSpanElement;
    private coordsRgbaA!: HTMLSpanElement;
    private coordsRgbaB!: HTMLSpanElement;
    private psnrInfo!: HTMLDivElement;
    private modeInfo!: HTMLDivElement;
    private helpScreen!: HTMLDivElement;
    private magnifierHelp!: HTMLParagraphElement;
    
    /**
     * Constructor - initializes the web component
     */
    constructor() {
        super();
        
        // Create shadow DOM for complete encapsulation
        this.shadow = this.attachShadow({ mode: 'open' });
        
        // Create the component structure
        this.createComponentStructure();
        
        // Initialize the component
        this.initialize();
    }
    
    /**
     * Defines which attributes to observe for changes.
     * When these attributes change, attributeChangedCallback will be called.
     */
    static get observedAttributes(): string[] {
        return [
            'image-a', 
            'image-b', 
            'display-mode', 
            'wipe-mode', 
            'wipe-position-x', 
            'wipe-position-y', 
            'wipe-angle', 
            'wipe-alpha',
            'magnifier-radius',
            'magnifier-zoom-factor',
            'magnifier-border-size',
            'checkerboard-square-size'
        ];
    }
    
    /**
     * Called when the element is connected to the DOM.
     * Sets up initial state and event listeners.
     */
    connectedCallback(): void {
        // Process initial attributes
        this.processAttributes();
        
        // Set initial canvas size
        this.updateCanvasSize();
        
        // Add resize observer to handle container size changes
        const resizeObserver = new ResizeObserver(() => {
            this.updateCanvasSize();
        });
        resizeObserver.observe(this);
        
        // Show help screen initially if no images are loaded
        this.updateHelpScreenVisibility();
    }
    
    /**
     * Helper method to get image-specific DOM elements and state properties.
     * 
     * This method provides a centralized way to access all DOM elements and state
     * properties associated with a specific image (A or B), eliminating repetitive
     * conditional logic throughout the component. It returns a comprehensive object
     * containing all image-related references:
     * 
     * **State Properties:**
     * - **isLoaded**: Boolean indicating whether the image is currently loaded
     * - **image**: The HTMLImageElement containing the loaded image data
     * - **imageData**: The ImageData object for pixel-level access and analysis
     * 
     * **DOM Elements:**
     * - **coordsRgbaElement**: Span element displaying coordinates and RGBA values
     * - **filenameElement**: Span element showing the loaded image filename
     * - **uploadElement**: Div element representing the upload box UI
     * - **fileInputElement**: Hidden input element for file selection
     * 
     * **Usage Pattern:**
     * This method eliminates the need for repetitive conditional statements like:
     * ```typescript
     * const element = imageType === 'A' ? this.elementA : this.elementB;
     * ```
     * 
     * Instead, it provides a clean destructuring pattern:
     * ```typescript
     * const { isLoaded, image, coordsRgbaElement } = this.getImageElements(imageType);
     * ```
     * 
     * **Type Safety:**
     * The method maintains type safety by using the ImageType parameter to
     * determine which set of elements to return, ensuring consistent access
     * patterns across the component.
     * 
     * Factorized to reduce code duplication in image-related operations and
     * provide a consistent interface for accessing image-specific resources.
     * 
     * @param imageType - The image identifier ('A' or 'B') to get elements for
     * @returns Object containing all DOM elements and state properties for the specified image
     * 
     * @example
     * ```typescript
     * // Get all elements for image A
     * const { isLoaded, image, coordsRgbaElement } = this.getImageElements('A');
     * 
     * // Use in conditional logic
     * if (isLoaded && image) {
     *     coordsRgbaElement.textContent = `[${x},${y}]=(${r},${g},${b},${a})`;
     * }
     * ```
     * 
     * @see {@link updateImageInfo} - Primary consumer of this method
     */
    private getImageElements(imageType: ImageType): {
        isLoaded: boolean;
        image: HTMLImageElement | null;
        imageData: ImageData | null;
        coordsRgbaElement: HTMLSpanElement;
        filenameElement: HTMLSpanElement;
        uploadElement: HTMLDivElement;
        fileInputElement: HTMLInputElement;
    } {
        // Determine if we're working with image A or B
        const isImageA = imageType === 'A';
        
        // Return object with all image-specific elements and state properties
        return {
            // State properties for the specified image
            isLoaded: isImageA ? this.state.imageALoaded : this.state.imageBLoaded,
            image: isImageA ? this.state.imageA : this.state.imageB,
            imageData: isImageA ? this.state.imageAData : this.state.imageBData,
            
            // DOM elements for the specified image
            coordsRgbaElement: isImageA ? this.coordsRgbaA : this.coordsRgbaB,
            filenameElement: isImageA ? this.filenameA : this.filenameB,
            uploadElement: isImageA ? this.uploadA : this.uploadB,
            fileInputElement: isImageA ? this.fileInputA : this.fileInputB
        };
    }
    
    /**
     * Helper method to parse and set numeric attribute values with validation.
     * 
     * This method provides centralized handling for all numeric attributes in the
     * web component, eliminating code duplication and ensuring consistent parsing
     * and validation behavior. It implements a comprehensive attribute processing
     * workflow:
     * 
     * **Input Validation:**
     * - Performs null/undefined checks to handle missing attribute values
     * - Uses parseFloat for robust numeric parsing that handles various formats
     * - Validates parsed values using isNaN to reject invalid numeric inputs
     * - Provides early return for invalid inputs to prevent error propagation
     * 
     * **Attribute Processing:**
     * - Maps attribute names to their corresponding setter methods
     * - Maintains type safety through proper method delegation
     * - Supports all numeric configuration attributes of the component
     * 
     * **Supported Attributes:**
     * - **wipe-position-x**: X coordinate for wipe line positioning
     * - **wipe-position-y**: Y coordinate for wipe line positioning  
     * - **wipe-angle**: Rotation angle for wipe line in degrees
     * - **wipe-alpha**: Alpha blending factor (0-1) for wipe operations
     * - **magnifier-radius**: Radius of the magnification circle in pixels
     * - **magnifier-zoom-factor**: Zoom multiplier for magnification (0 to disable)
     * 
     * **Error Handling:**
     * The method gracefully handles invalid inputs by returning early without
     * throwing exceptions, ensuring robust component behavior even with malformed
     * attribute values.
     * 
     * Factorized to reduce code duplication in attributeChangedCallback and
     * provide consistent numeric attribute processing across the component.
     * 
     * @param name - The name of the numeric attribute to process
     * @param value - The string value of the attribute to parse and apply
     * 
     * @example
     * ```typescript
     * // Called internally during attribute change processing
     * this.setNumericAttribute('magnifier-radius', '150');
     * this.setNumericAttribute('wipe-alpha', '0.5');
     * this.setNumericAttribute('wipe-angle', '45');
     * ```
     * 
     * @see {@link attributeChangedCallback} - Uses this method for numeric attribute processing
     */
    private setNumericAttribute(name: string, value: string | null): void {
        // Early return for null or undefined values
        if (!value) return;
        
        // Parse the string value to a floating-point number
        const numValue = parseFloat(value);
        
        // Validate the parsed number and return early if invalid
        if (isNaN(numValue)) return;
        
        // Delegate to the appropriate setter method based on attribute name
        switch (name) {
            case 'wipe-position-x':
                this.setWipePositionX(numValue);
                break;
            case 'wipe-position-y':
                this.setWipePositionY(numValue);
                break;
            case 'wipe-angle':
                this.setWipeAngle(numValue);
                break;
            case 'wipe-alpha':
                this.setWipeAlpha(numValue);
                break;
            case 'magnifier-radius':
                this.setMagnifierRadius(numValue);
                break;
            case 'magnifier-zoom-factor':
                this.setMagnifierZoomFactor(numValue);
                break;
            case 'magnifier-border-size':
                this.setMagnifierBorderSize(numValue);
                break;
            case 'checkerboard-square-size':
                this.setCheckerboardSquareSize(numValue);
                break;
        }
    }
    
    /**
     * Called when observed attributes change.
     * Updates the component state based on attribute changes.
     */
    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
        if (oldValue === newValue) return;
        
        switch (name) {
            case 'image-a':
                if (newValue) this.loadImage(newValue, 'A');
                break;
            case 'image-b':
                if (newValue) this.loadImage(newValue, 'B');
                break;
            case 'display-mode':
                if (newValue) this.setDisplayMode(newValue as CompositeMode);
                break;
            case 'wipe-mode':
                this.setWipeMode(newValue === 'simple');
                break;
            case 'wipe-position-x':
            case 'wipe-position-y':
            case 'wipe-angle':
            case 'wipe-alpha':
            case 'magnifier-radius':
            case 'magnifier-zoom-factor':
            case 'magnifier-border-size':
            case 'checkerboard-square-size':
                this.setNumericAttribute(name, newValue);
                break;
        }
    }
    
    /**
     * Creates the component structure in the shadow DOM.
     * This replicates the exact HTML structure from the original index.html
     * but encapsulated within the shadow DOM for isolation.
     */
    private createComponentStructure(): void {
        // Add styles to shadow DOM - copied and adapted from original styles.css
        const style = document.createElement('style');
        style.textContent = this.getComponentStyles();
        this.shadow.appendChild(style);
        
        // Create the exact same structure as the original HTML
        const container = document.createElement('div');
        container.className = 'image-comparison-container';
        container.innerHTML = `
            <div id="canvas-container">
                <canvas id="imageCanvas"></canvas>
                <div id="magnifier-container" class="hidden">
                    <canvas id="magnifierCanvas"></canvas>
                </div>
                <div id="drag-message"></div>
                <div id="help-screen">
                    <h1>Image Comparison Element</h1>
                    <p>Upload images by clicking on the A or B boxes in the bottom banner</p>
                    <p>or drag and drop image files anywhere in the application:</p>
                    <ul>
                        <li>Drag and drop a single image anywhere (except B box): loads as image A</li>
                        <li>Drag and drop multiple images anywhere: loads first as A, second as B</li>
                        <li>Drag and drop directly onto A or B boxes: loads to that specific slot</li>
                    </ul>
                    <p>Use mouse wheel to zoom, click and drag to move both images.</p>
                    <p>Use Shift+click and drag to move only one image (A or B).</p>
                    <p>Press "v" for simple wipe, "w" for full wipe interface.</p>
                    <p>Press "u", "o", "d", "i" to change composite modes.</p>
                    <p>Press "a" to show only image A, "b" to show only image B.</p>
                    <p>Press "c" to toggle checkerboard background.</p>
                    <p>Press "r" to reset view (position, zoom, wipe settings).</p>
                    <p>Press "h" or "?" to toggle this help screen.</p>
                    <p id="magnifier-help">Hold Ctrl to show magnifying glass at mouse pointer position.</p>
                </div>
            </div>
            <div id="bottom-banner">
                <div class="banner-section">
                    <div id="upload-container">
                        <div id="upload-a" class="upload-box">
                            <span>A: </span>
                            <span id="filename-a">No file</span>
                            <span id="coords-rgba-a"></span>
                            <input type="file" id="file-a" accept="image/*" style="display:none">
                        </div>
                        <div id="upload-b" class="upload-box">
                            <span>B: </span>
                            <span id="filename-b">No file</span>
                            <span id="coords-rgba-b"></span>
                            <input type="file" id="file-b" accept="image/*" style="display:none">
                        </div>
                    </div>
                </div>
                <div class="banner-section">
                    <div id="psnr-info">PSNR: -</div>
                </div>
                <div class="banner-section">
                    <div id="mode-container">
                        <span>Mode: </span>
                        <span id="mode-info">Under</span>
                    </div>
                </div>
                <div class="banner-section">
                    <div id="help-info">Help: press "h"</div>
                </div>
            </div>
        `;
        
        this.shadow.appendChild(container);
    }
    
    /**
     * Returns the CSS styles for the component.
     * These styles are adapted from the original styles.css but scoped to the component.
     */
    private getComponentStyles(): string {
        return `
            :host {
                display: block;
                width: 100%;
                height: 100%;
                min-height: 400px;
                font-family: Arial, sans-serif;
                color: #fff;
                background-color: #333;
                position: relative;
                overflow: hidden;
            }
            
            .image-comparison-container {
                width: 100%;
                height: 100%;
                display: flex;
                flex-direction: column;
                position: relative;
            }
            
            #canvas-container {
                flex: 1;
                position: relative;
                overflow: hidden;
            }
            
            #imageCanvas {
                width: 100%;
                height: 100%;
                display: block;
                background-color: black;
                cursor: move;
            }
            
            #magnifier-container {
                position: absolute;
                width: var(--magnifier-diameter, 400px);
                height: var(--magnifier-diameter, 400px);
                border-radius: 50%;
                overflow: hidden;
                pointer-events: none;
                box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
                border: 2px solid white;
                cursor: none;
                will-change: transform;
                transform: translateZ(0);
                backface-visibility: hidden;
                z-index: 1000;
                background-color: black;
            }
            
            #magnifierCanvas {
                width: 100%;
                height: 100%;
                display: block;
            }
            
            .hidden {
                display: none;
            }
            
            #drag-message {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background-color: rgba(0, 0, 0, 0.7);
                color: white;
                padding: 15px 25px;
                border-radius: 8px;
                font-size: 18px;
                z-index: 1000;
                pointer-events: none;
                box-shadow: 0 0 15px rgba(0, 0, 0, 0.5);
                border: 1px solid rgba(255, 255, 255, 0.3);
                max-width: 80%;
                text-align: center;
                opacity: 0;
                transition: opacity 0.3s;
            }
            
            #help-screen {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 40px;
                background-color: rgba(0, 0, 0, 0.6);
                color: white;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                z-index: 100;
                text-align: center;
                padding: 15px;
                box-sizing: border-box;
                overflow-y: auto;
            }
            
            #help-screen h1 {
                font-size: 18px;
                margin-bottom: 15px;
                margin-top: 0;
            }
            
            #help-screen p {
                font-size: 12px;
                margin: 3px 0;
                max-width: 90%;
                line-height: 1.3;
            }
            
            #help-screen ul {
                text-align: left;
                max-width: 90%;
                font-size: 12px;
                margin: 8px 0;
                padding-left: 20px;
                line-height: 1.3;
            }
            
            #help-screen li {
                margin: 2px 0;
            }
            
            #magnifier-help {
                font-size: 12px;
                margin: 8px 0 3px 0;
                max-width: 90%;
                line-height: 1.3;
            }
            
            #bottom-banner {
                height: 40px;
                background-color: #222;
                display: flex;
                align-items: center;
                padding: 0 10px;
                box-shadow: 0 -2px 5px rgba(0, 0, 0, 0.3);
                font-size: 12px;
            }
            
            .banner-section {
                margin-right: 10px;
                display: flex;
                align-items: center;
            }
            
            #upload-container {
                display: flex;
            }
            
            .upload-box {
                background-color: #555;
                padding: 5px 10px;
                margin-right: 10px;
                border-radius: 3px;
                cursor: pointer;
                transition: background-color 0.2s;
                white-space: nowrap;
                font-size: 12px;
                min-width: 150px;
                flex-shrink: 0;
            }
            
            .upload-box:hover {
                background-color: #777;
            }
            
            .info-section {
                font-size: 12px;
                color: #fff;
            }
            
            #image-a-info, #image-b-info {
                margin-right: 5px;
            }
        `;
    }
    
    /**
     * Initialize the component after DOM structure is created.
     * Sets up DOM references, canvas context, and event listeners.
     */
    private initialize(): void {
        // Get references to DOM elements within shadow DOM
        this.initDomReferences();
        
        // Initialize the canvas and context
        this.initCanvas();
        
        // Set up event listeners
        this.setupEventListeners();
    }
    
    /**
     * Initialize references to DOM elements within the shadow DOM.
     * This allows us to interact with the encapsulated elements.
     */
    private initDomReferences(): void {
        this.state.canvas = this.shadow.getElementById('imageCanvas') as HTMLCanvasElement;
        this.magnifierContainer = this.shadow.getElementById('magnifier-container') as HTMLDivElement;
        this.magnifierCanvas = this.shadow.getElementById('magnifierCanvas') as HTMLCanvasElement;
        this.dragMessage = this.shadow.getElementById('drag-message') as HTMLDivElement;
        this.uploadA = this.shadow.getElementById('upload-a') as HTMLDivElement;
        this.uploadB = this.shadow.getElementById('upload-b') as HTMLDivElement;
        this.fileInputA = this.shadow.getElementById('file-a') as HTMLInputElement;
        this.fileInputB = this.shadow.getElementById('file-b') as HTMLInputElement;
        this.filenameA = this.shadow.getElementById('filename-a') as HTMLSpanElement;
        this.filenameB = this.shadow.getElementById('filename-b') as HTMLSpanElement;
        this.coordsRgbaA = this.shadow.getElementById('coords-rgba-a') as HTMLSpanElement;
        this.coordsRgbaB = this.shadow.getElementById('coords-rgba-b') as HTMLSpanElement;
        this.psnrInfo = this.shadow.getElementById('psnr-info') as HTMLDivElement;
        this.modeInfo = this.shadow.getElementById('mode-info') as HTMLDivElement;
        this.helpScreen = this.shadow.getElementById('help-screen') as HTMLDivElement;
        this.magnifierHelp = this.shadow.getElementById('magnifier-help') as HTMLDivElement;
    }
    
    /**
     * Initialize canvas and set up the rendering context.
     * This sets up the canvas for drawing operations.
     */
    private initCanvas(): void {
        if (!this.state.canvas) {
            console.error('Canvas element not found');
            return;
        }
        
        // Get the 2D rendering context with alpha disabled for better performance
        this.state.ctx = this.state.canvas.getContext('2d', { alpha: false });
        
        if (!this.state.ctx) {
            console.error('Failed to get canvas context');
            return;
        }
    }
    
    /**
     * Process attributes when the element is connected or attributes change.
     * This reads the initial attribute values and applies them to the component.
     */
    private processAttributes(): void {
        const imageA = this.getAttribute('image-a');
        const imageB = this.getAttribute('image-b');
        
        if (imageA) this.loadImage(imageA, 'A');
        if (imageB) this.loadImage(imageB, 'B');
        
        const displayMode = this.getAttribute('display-mode');
        if (displayMode) this.setDisplayMode(displayMode as CompositeMode);
        
        const wipeMode = this.getAttribute('wipe-mode');
        if (wipeMode) this.setWipeMode(wipeMode === 'simple');
        
        const wipeX = this.getAttribute('wipe-position-x');
        const wipeY = this.getAttribute('wipe-position-y');
        if (wipeX) this.setWipePositionX(parseFloat(wipeX));
        if (wipeY) this.setWipePositionY(parseFloat(wipeY));
        
        const wipeAngle = this.getAttribute('wipe-angle');
        if (wipeAngle) this.setWipeAngle(parseFloat(wipeAngle));
        
        const wipeAlpha = this.getAttribute('wipe-alpha');
        if (wipeAlpha) this.setWipeAlpha(parseFloat(wipeAlpha));
        
        // Process magnifier attributes
        const magnifierRadius = this.getAttribute('magnifier-radius');
        if (magnifierRadius) {
            this.setMagnifierRadius(parseFloat(magnifierRadius));
        }
        
        const magnifierZoomFactor = this.getAttribute('magnifier-zoom-factor');
        if (magnifierZoomFactor) {
            this.setMagnifierZoomFactor(parseFloat(magnifierZoomFactor));
        }
        
        const magnifierBorderSize = this.getAttribute('magnifier-border-size');
        if (magnifierBorderSize) {
            this.setMagnifierBorderSize(parseFloat(magnifierBorderSize));
        }
        
        const checkerboardSquareSize = this.getAttribute('checkerboard-square-size');
        if (checkerboardSquareSize) {
            this.setCheckerboardSquareSize(parseFloat(checkerboardSquareSize));
        }
    }
    
    /**
     * Update canvas size based on container size.
     * This ensures the canvas matches the component's dimensions.
     */
    private updateCanvasSize(): void {
        if (!this.state.canvas) return;
        
        const width = this.clientWidth;
        const height = this.clientHeight - 40; // Account for bottom banner
        
        if (width > 0 && height > 0) {
            this.state.canvas.width = width;
            this.state.canvas.height = height;
            
            if (this.magnifierCanvas) {
                this.magnifierCanvas.width = 400;
                this.magnifierCanvas.height = 400;
            }
            
            // Redraw with new size
            this.draw();
        }
    }
    
    /**
     * Update help screen visibility based on whether images are loaded and showHelp state.
     * Shows help screen when no images are loaded OR when manually toggled on.
     * Auto-hides when at least one image is loaded (unless manually toggled on).
     */
    private updateHelpScreenVisibility(): void {
        const imagesLoaded = (this.state.imageALoaded ? 1 : 0) + (this.state.imageBLoaded ? 1 : 0);
        
        // Auto-hide help when at least one image is loaded for the first time
        if (imagesLoaded >= 1) {
            // If help was auto-shown (not manually toggled), hide it and set showHelp to false
            if (this.state.showHelp && !this.manuallyToggledHelp) {
                this.state.showHelp = false;
                this.helpScreen.style.display = 'none';
            }
            // If manually toggled on, keep it visible
            else if (this.state.showHelp) {
                this.helpScreen.style.display = 'flex';
            }
            // If manually toggled off, keep it hidden
            else {
                this.helpScreen.style.display = 'none';
            }
        }
        // Show help screen if no images are loaded
        else {
            this.helpScreen.style.display = 'flex';
            // Reset manual toggle flag when auto-showing
            this.manuallyToggledHelp = false;
        }
        
        // Update magnifier help visibility
        this.updateMagnifierHelpVisibility();
    }
    
    /**
     * Updates the visibility of the magnifier help text based on the current zoom factor.
     * Hides the help text when magnifier is disabled (zoom factor <= 0).
     */
    private updateMagnifierHelpVisibility(): void {
        if (this.magnifierHelp) {
            if (this.state.magnifierZoomFactor && this.state.magnifierZoomFactor > 0) {
                this.magnifierHelp.style.display = 'block';
                
                // Update the help text to include the current zoom factor
                this.magnifierHelp.textContent = `Hold Ctrl to show magnifying glass (${this.state.magnifierZoomFactor}x zoom) at mouse pointer position.`;
            } else {
                this.magnifierHelp.style.display = 'none';
            }
        }
    }

    /**
     * Shared implementation for loading images A and B.
     * 
     * @param url - The URL to load the image from (can be web URL or blob URL)
     * @param imageType - Which image slot to load into ('A' or 'B')
     * @param filename - Optional filename to display in UI (used for uploaded files)
     * 
     * @returns Promise that resolves when image loading and processing is complete
     * 
     * @throws Will reject the promise if image loading fails or processing encounters errors
     * 
     * @remarks
     * This method performs the complete image loading pipeline:
     * 1. Image loading via HTML Image element
     * 2. Canvas-based pixel data extraction for analysis
     * 3. Mip-map generation for performance optimization
     * 4. UI updates with proper filename handling
     * 5. Layout adjustments and redraw operations
     * 
     * The imageType parameter determines which state properties are updated,
     * allowing the same logic to handle both image A and image B loading.
     */
    private async loadImage(url: string, imageType: ImageType, filename?: string): Promise<void> {
        // Clear old resources immediately
        if (imageType === 'A') {
            this.state.imageA = null;
            this.state.imageAData = null;
            this.state.imageAMipMaps = null;
            this.state.imageALoaded = false;
        } else {
            this.state.imageB = null;
            this.state.imageBData = null;
            this.state.imageBMipMaps = null;
            this.state.imageBLoaded = false;
        }
        
        // Redraw immediately to clear old image
        this.draw();
        
        // Show loading message only if not already visible (to preserve plural form)
        if (this.dragMessage.style.opacity !== '1') {
            this.dragMessage.textContent = 'Loading image...';
            this.dragMessage.style.opacity = '1';
        }
        
        // Log the loading operation for debugging and monitoring
        console.log(`Loading image ${imageType} from URL:`, url);
        
        // Create new Image element for loading - this provides better control than direct canvas loading
        const img = new Image();
        
        // Return a Promise to handle the asynchronous image loading process
        return new Promise((resolve, reject) => {
            // Configure success handler - called when image loads successfully
            img.onload = async (): Promise<void> => {
                try {
                    // Store the loaded image in component state for rendering operations
                    // Update the appropriate state properties based on imageType
                    if (imageType === 'A') {
                        this.state.imageA = img;
                        this.state.imageALoaded = true;
                    } else {
                        this.state.imageB = img;
                        this.state.imageBLoaded = true;
                    }
                    
                    // Create temporary canvas for pixel data extraction
                    // This is necessary for pixel-level analysis operations like PSNR calculation
                    const tempCanvas = document.createElement('canvas');
                    
                    // Set canvas dimensions to match the loaded image exactly
                    // This ensures pixel-perfect data extraction without scaling artifacts
                    tempCanvas.width = img.width;
                    tempCanvas.height = img.height;
                    const tempCtx = tempCanvas.getContext('2d');
                    
                    // Verify canvas context creation succeeded before proceeding
                    if (tempCtx) {
                        // Draw the image to canvas at original size for pixel data extraction
                        // This creates the ImageData needed for analysis operations
                        tempCtx.drawImage(img, 0, 0);
                        
                        // Extract pixel data for analysis operations (PSNR, color sampling, etc.)
                        // ImageData provides direct access to RGBA values for each pixel
                        // Store in the appropriate state property based on imageType
                        if (imageType === 'A') {
                            this.state.imageAData = tempCtx.getImageData(0, 0, img.width, img.height);
                        } else {
                            this.state.imageBData = tempCtx.getImageData(0, 0, img.width, img.height);
                        }
                    }
                    
                    // Update filename display with intelligent fallback handling
                    // Priority: provided filename > URL extraction > default fallback
                    // This fixes the "Uploaded file" issue for drag-and-drop operations
                    const displayFilename = filename || this.extractFilename(url);
                    const filenameElement = imageType === 'A' ? this.filenameA : this.filenameB;
                    filenameElement.textContent = displayFilename;
                    
                    // Update help screen visibility based on current loading state
                    // The help screen should hide when images are successfully loaded
                    this.updateHelpScreenVisibility();
                    
                    // Perform automatic layout adjustments for optimal viewing experience
                    // Center the wipe position to provide balanced comparison view
                    this.centerWipePosition();
                    
                    // Fit images to viewport for optimal initial viewing
                    // This ensures both images are visible and properly scaled
                    this.fitImagesToViewport();
                    
                    // Only redraw if both images are loaded, or if only one image exists
                    if (this.state.imageALoaded && this.state.imageBLoaded) {
                        // Both images loaded - draw and calculate PSNR
                        this.draw();
                        this.updatePSNR();
                    } else if ((imageType === 'A' && !this.state.imageBLoaded) || 
                               (imageType === 'B' && !this.state.imageALoaded)) {
                        // Only one image loaded so far - draw it
                        this.draw();
                    }
                    
                    // Hide loading message
                    this.dragMessage.style.opacity = '0';
                    
                    // Generate mip-maps asynchronously in the background
                    // This doesn't block the UI and improves rendering quality later
                    createMipMaps(img).then(mipMaps => {
                        if (imageType === 'A') {
                            this.state.imageAMipMaps = mipMaps;
                        } else {
                            this.state.imageBMipMaps = mipMaps;
                        }
                        // Redraw with mipmaps available
                        this.draw();
                    });
                    
                    // Don't calculate PSNR on load - only on user interaction
                    // This prevents blocking the UI with expensive pixel calculations
                    
                    // Resolve the promise to indicate successful completion
                    resolve();
                } catch (error) {
                    // Handle any errors during image processing (mip-map generation, etc.)
                    console.error(`Error processing image ${imageType}:`, error);
                    reject(error);
                }
            };
            
            // Configure error handler for image loading failures
            img.onerror = (error): void => {
                // Hide loading message
                this.dragMessage.style.opacity = '0';
                
                // Log the error for debugging purposes
                console.error(`Error loading image ${imageType}:`, error);
                
                // Update UI to show error state with helpful filename information
                // Extract filename from URL for better error messaging
                const filenameElement = imageType === 'A' ? this.filenameA : this.filenameB;
                filenameElement.textContent = "Error loading " + (url.split('/').pop() || url);
                
                // Reject the promise to indicate loading failure
                reject(error);
            };
            
            // Configure CORS handling for cross-origin images
            // This allows loading images from different domains when properly configured
            img.crossOrigin = 'anonymous';
            
            // Initiate the image loading process by setting the source URL
            // This triggers the onload or onerror handlers defined above
            img.src = url;
        });
    }

    /**
     * Set the display mode for image composition.
     * Updates the composite mode and redraws the canvas.
     */
    private setDisplayMode(mode: CompositeMode): void {
        const previousMode = this.state.compositeMode;
        
        // Store previous mode if switching to A or B
        if ((mode === 'A' || mode === 'B') && 
            this.state.compositeMode !== 'A' && this.state.compositeMode !== 'B') {
            this.lastCompositeMode = this.state.compositeMode;
            
            // Store wipe settings when switching to A or B mode
            if (this.state.isWipeEnabled) {
                this.previousWipeAngle = this.state.wipeAngle;
                this.previousWipeAlpha = this.state.wipeAlpha;
            }
        }
        
        this.state.compositeMode = mode;
        this.modeInfo.textContent = mode;
        
        // When switching to A or B mode, disable wipe
        if (mode === 'A' || mode === 'B') {
            this.state.isWipeEnabled = false;
        } else {
            // When switching back to a composite mode, restore wipe
            this.state.isWipeEnabled = true;
            
            // Only restore wipe settings if coming from A or B mode
            // If already in a composite mode, keep current wipe settings
            if (previousMode === 'A' || previousMode === 'B') {
                if (this.state.isSimpleWipe) {
                    this.state.wipeAngle = 0; // Simple wipe always has angle 0
                } else {
                    this.state.wipeAngle = this.previousWipeAngle;
                    this.state.wipeAlpha = this.previousWipeAlpha;
                }
            }
            // If switching between composite modes, keep current wipe settings unchanged
        }
        
        this.draw();
    }
    
    /**
     * Set the wipe mode (simple or full).
     * Updates the wipe interface type and preserves angle and alpha settings.
     */
    private setWipeMode(isSimple: boolean): void {
        // Store the current wipe angle and alpha if switching to simple mode
        if (isSimple && !this.state.isSimpleWipe) {
            this.previousWipeAngle = this.state.wipeAngle;
            this.previousWipeAlpha = this.state.wipeAlpha;
        }
        
        this.state.isWipeEnabled = true;
        this.state.isSimpleWipe = isSimple;
        
        // If switching to simple mode, set angle to 0
        if (isSimple) {
            this.state.wipeAngle = 0;
            // Alpha remains the same in simple mode
        } else {
            // If switching back to full mode, restore the previous angle and alpha
            this.state.wipeAngle = this.previousWipeAngle;
            this.state.wipeAlpha = this.previousWipeAlpha;
        }
        
        // If we're in A or B mode, restore the previous composite mode
        if (this.state.compositeMode === 'A' || this.state.compositeMode === 'B') {
            this.state.compositeMode = this.lastCompositeMode;
            this.modeInfo.textContent = this.lastCompositeMode;
        }
        
        this.draw();
    }
    
    /**
     * Set the X position of the wipe line in image A coordinates.
     */
    private setWipePositionX(x: number): void {
        this.state.wipePositionInImageACoords.x = x;
        this.draw();
    }
    
    /**
     * Set the Y position of the wipe line in image A coordinates.
     */
    private setWipePositionY(y: number): void {
        this.state.wipePositionInImageACoords.y = y;
        this.draw();
    }
    
    /**
     * Set the angle of the wipe line in degrees.
     */
    private setWipeAngle(angle: number): void {
        this.state.wipeAngle = angle;
        this.previousWipeAngle = angle;
        this.draw();
    }
    
    /**
     * Set the alpha blending factor for the wipe interface.
     */
    private setWipeAlpha(alpha: number): void {
        alpha = Math.max(0, Math.min(1, alpha));
        this.state.wipeAlpha = alpha;
        this.previousWipeAlpha = alpha; // Store for mode switching
        this.draw();
    }
    
    /**
     * Sets the magnifier radius in pixels.
     * 
     * @param radius - The radius of the magnifier in pixels
     */
    private setMagnifierRadius(radius: number): void {
        if (radius <= 0) return; // Prevent invalid values
        
        this.state.magnifierRadius = radius;
        
        // Update CSS variable for magnifier diameter (radius * 2)
        this.style.setProperty('--magnifier-diameter', `${radius * 2}px`);
        
        // Update magnifier if it's currently visible
        if (this.showMagnifier && this.lastMouseX !== 0 && this.lastMouseY !== 0) {
            this.updateMagnifier(this.lastMouseX, this.lastMouseY);
        }
    }
    
    /**
     * Sets the magnifier zoom factor.
     * 
     * @param zoomFactor - The zoom factor for the magnifier (e.g., 8 for 8x zoom)
     *                    - Set to 0 or negative to disable the magnifier functionality
     */
    private setMagnifierZoomFactor(zoomFactor: number): void {
        this.state.magnifierZoomFactor = zoomFactor;
        
        // Update the help text to reflect the current zoom factor or hide it if disabled
        this.updateMagnifierHelpVisibility();
        
        // If zoom factor is <= 0, disable magnifier functionality
        if (zoomFactor <= 0 && this.showMagnifier) {
            this.showMagnifier = false;
            this.magnifierContainer.classList.add('hidden');
        }
        // Otherwise update magnifier if it's currently visible
        else if (zoomFactor > 0 && this.showMagnifier && this.lastMouseX !== 0 && this.lastMouseY !== 0) {
            this.updateMagnifier(this.lastMouseX, this.lastMouseY);
        }
    }
    
    /**
     * Sets the magnifier border size.
     * 
     * @param borderSize - Border size of the magnifier in pixels
     *                   - Must be non-negative (0 or positive)
     *                   - Typical values: 0-5 pixels
     *                   - Default: 2 pixels
     */
    private setMagnifierBorderSize(borderSize: number): void {
        // Validate border size (must be non-negative)
        if (borderSize < 0) {
            console.warn('Magnifier border size must be non-negative, using default value of 2');
            borderSize = 2;
        }
        
        this.state.magnifierBorderSize = borderSize;
        
        // Update magnifier if it's currently visible
        if (this.showMagnifier && this.lastMouseX !== 0 && this.lastMouseY !== 0) {
            this.updateMagnifier(this.lastMouseX, this.lastMouseY);
        }
    }
    
    /**
     * Sets the checkerboard square size.
     * 
     * @param squareSize - Size of checkerboard squares in pixels
     *                   - Must be positive (minimum 1 pixel)
     *                   - Typical values: 5-20 pixels
     *                   - Default: 10 pixels
     */
    private setCheckerboardSquareSize(squareSize: number): void {
        // Validate square size (must be positive)
        if (squareSize <= 0) {
            console.warn('Checkerboard square size must be positive, using default value of 10');
            squareSize = 10;
        }
        
        this.state.checkerboardSquareSize = squareSize;
        
        // Redraw if checkerboard is currently visible
        if (this.state.isCheckerboard) {
            this.draw();
        }
    }
    
    /**
     * Center the wipe position on the canvas.
     * Converts canvas center coordinates to image A coordinates.
     */
    private centerWipePosition(): void {
        if (!this.state.canvas) return;
        
        // Get the center of the canvas in canvas coordinates
        const canvasCenterX = this.state.canvas.width / 2;
        const canvasCenterY = this.state.canvas.height / 2;
        
        // Convert canvas center to image A coordinates
        const imageCoords = this.canvasToImageCoords(canvasCenterX, canvasCenterY, 'A');
        
        // Update wipe position in image A coordinates
        this.state.wipePositionInImageACoords.x = imageCoords.x;
        this.state.wipePositionInImageACoords.y = imageCoords.y;
        
        // Update attributes to reflect the change
        this.setAttribute('wipe-position-x', imageCoords.x.toString());
        this.setAttribute('wipe-position-y', imageCoords.y.toString());
        
        // Redraw with the new wipe position
        this.draw();
    }
    
    /**
     * Fit images to viewport by adjusting scale and position.
     * Ensures images are visible and properly centered.
     */
    private fitImagesToViewport(): void {
        if (!this.state.canvas || (!this.state.imageALoaded && !this.state.imageBLoaded)) return;
        
        // Get image dimensions
        const imageWidth = this.state.imageALoaded ? this.state.imageA!.width : 
                          (this.state.imageBLoaded ? this.state.imageB!.width : 0);
        const imageHeight = this.state.imageALoaded ? this.state.imageA!.height : 
                           (this.state.imageBLoaded ? this.state.imageB!.height : 0);
        
        if (imageWidth === 0 || imageHeight === 0) return;
        
        // Calculate scale to fit
        const scaleX = this.state.canvas.width / imageWidth;
        const scaleY = this.state.canvas.height / imageHeight;
        
        // Use the smaller scale to ensure the entire image fits
        this.state.scale = Math.min(scaleX, scaleY) * 0.9; // 90% to leave some margin
        
        // Center the images
        this.state.offsetX = (this.state.canvas.width - imageWidth * this.state.scale) / 2;
        this.state.offsetY = (this.state.canvas.height - imageHeight * this.state.scale) / 2;
    }
    
    /**
     * Update PSNR display using the component's isolated state.
     */
    private updatePSNR(): void {
        // Show PSNR: N/A immediately while computing
        this.psnrInfo.textContent = 'PSNR: N/A';
        
        // Calculate PSNR asynchronously with callback
        calculatePSNRForImages(
            this.state.imageAData,
            this.state.imageBData,
            this.state.imageA,
            this.state.imageB,
            this.state.offsetAX,
            this.state.offsetAY,
            this.state.offsetBX,
            this.state.offsetBY,
            this.state.scale,
            (result) => {
                this.psnrInfo.textContent = result;
            }
        );
    }
    
    /**
     * Sets up canvas mouse and wheel event listeners for image interaction.
     * 
     * This method configures all canvas-related event handling within the web component,
     * enabling users to interact with the image comparison interface through mouse
     * and wheel operations. It establishes the complete canvas interaction system:
     * 
     * **Mouse Event Handling:**
     * - **Mouse Down**: Initiates drag operations for image panning and wipe control
     * - **Mouse Move**: Handles active dragging, cursor tracking, and coordinate updates
     * - **Mouse Up**: Terminates drag operations and finalizes interactions
     * - **Mouse Leave**: Ensures drag operations are properly terminated when cursor exits canvas
     * 
     * **Wheel Event Handling:**
     * - Configures zoom functionality with passive event prevention
     * - Enables smooth zooming centered on the mouse cursor position
     * - Maintains proper event handling for cross-browser compatibility
     * 
     * **Component Integration:**
     * - Includes null safety check to prevent errors during initialization
     * - Properly binds event handlers to maintain component context
     * - Integrates with the component's state management system
     * 
     * **Event Handler Binding:**
     * All event handlers are bound to the component instance to ensure proper
     * access to component state and methods during event processing.
     * 
     * Factorized to reduce code duplication in setupEventListeners and provide
     * centralized canvas event configuration with proper error handling.
     * 
     * @example
     * ```typescript
     * // Called during component initialization after canvas is available
     * this.setupCanvasEventListeners();
     * ```
     * 
     * @see {@link handleMouseDown} - Processes mouse down events for drag initiation
     * @see {@link handleMouseMove} - Handles mouse movement for dragging and tracking
     * @see {@link handleMouseUp} - Terminates drag operations
     * @see {@link handleWheel} - Processes wheel events for zoom functionality
     */
    private setupCanvasEventListeners(): void {
        // Ensure canvas is available before setting up event listeners
        if (!this.state.canvas) return;
        
        // Configure mouse down events for drag operation initiation
        this.state.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        
        // Configure mouse move events for dragging and coordinate tracking
        this.state.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        
        // Add global mousemove listener to handle dragging outside canvas
        document.addEventListener('mousemove', this.handleMouseMove.bind(this));
        
        // Configure mouse up events for drag operation termination
        this.state.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
        
        // Add global mouseup listener to handle mouse releases outside the canvas
        document.addEventListener('mouseup', this.handleMouseUp.bind(this));
        
        // Configure wheel events for zoom functionality with passive prevention
        this.state.canvas.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
    }
    
    /**
     * Sets up file upload event listeners for both image A and B upload boxes.
     * 
     * This method configures the file upload user interface by establishing
     * event listeners for both image A and image B upload boxes within the
     * web component. It handles the complete file upload workflow:
     * 
     * **Click Event Handling:**
     * - Configures upload box click events to trigger hidden file input dialogs
     * - Provides intuitive user interaction by making upload boxes clickable
     * - Maintains consistent behavior between both A and B upload boxes
     * 
     * **File Selection Processing:**
     * - Sets up change event listeners on hidden file input elements
     * - Delegates file processing to specialized handler methods
     * - Ensures proper binding of event handler context to the component instance
     * 
     * **Component Integration:**
     * - Integrates with the component's shadow DOM structure
     * - Maintains encapsulation by using component instance methods
     * - Provides consistent file upload behavior across component instances
     * 
     * This method eliminates code duplication by centralizing the setup logic
     * that would otherwise be repeated for both upload boxes, while maintaining
     * the specialized behavior required for each image slot.
     * 
     * Factorized to reduce code duplication in setupEventListeners and provide
     * a centralized location for file upload configuration within the component.
     * 
     * @example
     * ```typescript
     * // Called during component initialization
     * this.setupFileUploadListeners();
     * ```
     * 
     * @see {@link handleFileInputA} - Handles file selection for image A
     * @see {@link handleFileInputB} - Handles file selection for image B
     */
    private setupFileUploadListeners(): void {
        // Configure upload box click handlers to trigger file selection dialogs
        this.uploadA.addEventListener('click', () => this.fileInputA.click());
        this.uploadB.addEventListener('click', () => this.fileInputB.click());
        
        // Configure file input change handlers with proper context binding
        this.fileInputA.addEventListener('change', this.handleFileInputA.bind(this));
        this.fileInputB.addEventListener('change', this.handleFileInputB.bind(this));
    }
    
    /**
     * Set up event listeners for the component.
     * This includes file uploads, canvas interactions, drag and drop, and keyboard events.
     */
    private setupEventListeners(): void {
        if (!this.state.canvas) return;
        
        // File upload event listeners - factorized setup
        this.setupFileUploadListeners();
        
        // Canvas mouse event listeners - factorized setup
        this.setupCanvasEventListeners();
        
        // Drag and drop event listeners
        this.addEventListener('dragover', this.handleDragOver.bind(this));
        this.addEventListener('drop', this.handleDrop.bind(this));
        this.addEventListener('dragleave', this.handleDragLeave.bind(this));
        
        // Add specific drag/drop listeners to upload boxes for better detection
        this.uploadA.addEventListener('dragover', this.handleUploadBoxDragOver.bind(this, 'A'));
        this.uploadA.addEventListener('dragleave', this.handleUploadBoxDragLeave.bind(this, 'A'));
        this.uploadA.addEventListener('drop', this.handleUploadBoxDrop.bind(this, 'A'));
        
        this.uploadB.addEventListener('dragover', this.handleUploadBoxDragOver.bind(this, 'B'));
        this.uploadB.addEventListener('dragleave', this.handleUploadBoxDragLeave.bind(this, 'B'));
        this.uploadB.addEventListener('drop', this.handleUploadBoxDrop.bind(this, 'B'));
        
        // Keyboard event listeners - only when this component has focus
        this.addEventListener('keydown', this.handleKeyDown.bind(this));
        this.addEventListener('keyup', this.handleKeyUp.bind(this));
        
        // Make the component focusable
        this.tabIndex = 0;
        
        // Focus on mouse enter to capture keyboard events
        this.addEventListener('mouseenter', () => this.focus());
    }
    
    /**
     * Handle mouse down events on the canvas.
     * Starts dragging operations and handle interactions.
     */
    private handleMouseDown(e: MouseEvent): void {
        e.preventDefault();
        
        // Get mouse position relative to canvas
        const rect = this.state.canvas!.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Reset accumulated movement values
        this.accumulatedDX = 0;
        this.accumulatedDY = 0;
        
        // Check if clicking on wipe UI elements
        if (this.state.isWipeEnabled && this.state.imageALoaded && this.state.imageBLoaded) {
            const wipePos = getWipePositionInCanvasCoords(this.state);
            
            // Check translation handle (center dot)
            const distToTranslation = Math.sqrt(
                Math.pow(x - wipePos.x, 2) + 
                Math.pow(y - wipePos.y, 2)
            );
            
            if (distToTranslation <= UI_CONSTANTS.TRANSLATION_HANDLE_RADIUS) {
                this.activeHandle = 'translation';
                this.dragStartX = x;
                this.dragStartY = y;
                this.state.canvas!.style.cursor = 'grabbing';
                return;
            }
            
            // For full wipe interface, check additional handles
            if (!this.state.isSimpleWipe) {
                // Check rotation handle
                const { x: rotX, y: rotY } = calculateRotationHandlePosition(wipePos, this.state.wipeAngle);
                
                const distToRotation = Math.sqrt(
                    Math.pow(x - rotX, 2) + 
                    Math.pow(y - rotY, 2)
                );
                
                if (distToRotation <= UI_CONSTANTS.ROTATION_HANDLE_RADIUS) {
                    this.activeHandle = 'rotation';
                    this.dragStartX = x;
                    this.dragStartY = y;
                    this.state.canvas!.style.cursor = 'grabbing';
                    return;
                }
                
                // Check alpha handle
                const alphaSliderPos = calculateAlphaSliderPosition(wipePos, this.state.wipeAngle, this.state.wipeAlpha);
                const alphaX = alphaSliderPos.x;
                const alphaY = alphaSliderPos.y;
                
                const distToAlpha = Math.sqrt(
                    Math.pow(x - alphaX, 2) + 
                    Math.pow(y - alphaY, 2)
                );
                
                if (distToAlpha <= UI_CONSTANTS.ALPHA_HANDLE_RADIUS) {
                    this.activeHandle = 'alpha';
                    this.dragStartX = x;
                    this.dragStartY = y;
                    this.state.canvas!.style.cursor = 'grabbing';
                    return;
                }
            }
        }
        
        // Start dragging images
        this.isDragging = true;
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;
        
        // Determine which side was clicked for shift+drag
        if (e.shiftKey && this.state.isWipeEnabled && 
            this.state.imageALoaded && this.state.imageBLoaded) {
            
            const wipePos = getWipePositionInCanvasCoords(this.state);
            const angle = this.state.wipeAngle * (Math.PI / 180);
            const mouseX = x - wipePos.x;
            const mouseY = y - wipePos.y;
            
            // Calculate which side of the wipe line we're on
            const dotProduct = mouseX * Math.cos(angle) + mouseY * Math.sin(angle);
            this.dragSide = dotProduct < 0 ? 'A' : 'B';
            
            this.state.canvas!.style.cursor = 'grabbing';
        } else {
            this.state.canvas!.style.cursor = 'move';
        }
    }
    
    /**
     * Handle mouse move events on the canvas.
     * Updates mouse info, handles dragging, and manages cursor states.
     */
    private handleMouseMove(e: MouseEvent): void {
        const rect = this.state.canvas!.getBoundingClientRect();
        let x = e.clientX - rect.left;
        let y = e.clientY - rect.top;
        
        // Clamp coordinates to canvas bounds when dragging
        if (this.isDragging || this.activeHandle) {
            x = Math.max(0, Math.min(x, rect.width));
            y = Math.max(0, Math.min(y, rect.height));
            
            // Maintain cursor style when dragging outside canvas
            if (this.isDragging) {
                document.body.style.cursor = this.dragSide ? 'grabbing' : 'move';
            } else if (this.activeHandle) {
                document.body.style.cursor = this.activeHandle === 'translation' ? 'move' : 
                                            this.activeHandle === 'rotation' ? 'crosshair' : 'ew-resize';
            }
        } else {
            document.body.style.cursor = '';
        }
        
        // Store current mouse position
        this.lastMouseX = x;
        this.lastMouseY = y;
        
        // Update mouse position info and color values (only if inside canvas)
        if (e.clientX >= rect.left && e.clientX <= rect.right && 
            e.clientY >= rect.top && e.clientY <= rect.bottom) {
            this.updateMouseInfo(x, y);
        }
        
        // Handle wipe UI interaction
        if (this.activeHandle) {
            this.handleWipeUIInteraction(x, y);
            return;
        }
        
        // Handle dragging images
        if (this.isDragging) {
            const dx = e.clientX - this.dragStartX;
            const dy = e.clientY - this.dragStartY;
            
            if (e.shiftKey && this.state.isWipeEnabled && 
                this.state.imageALoaded && this.state.imageBLoaded && this.dragSide) {
                
                // Move only one image - accumulate fractional movements
                this.accumulatedDX += dx / this.state.scale;
                this.accumulatedDY += dy / this.state.scale;
                
                // Apply integer pixel movements
                const intDX = Math.round(this.accumulatedDX);
                const intDY = Math.round(this.accumulatedDY);
                
                if (intDX !== 0 || intDY !== 0) {
                    if (this.dragSide === 'A') {
                        // Move only image A by integer pixels scaled appropriately
                        this.state.offsetAX += intDX * this.state.scale;
                        this.state.offsetAY += intDY * this.state.scale;
                    } else {
                        // Move only image B by integer pixels scaled appropriately
                        this.state.offsetBX += intDX * this.state.scale;
                        this.state.offsetBY += intDY * this.state.scale;
                    }
                    
                    // Remove the applied movement from accumulated values
                    this.accumulatedDX -= intDX;
                    this.accumulatedDY -= intDY;
                    
                    this.draw();
                    this.updatePSNR();
                }
            } else {
                // Move both images together
                this.state.offsetX += dx;
                this.state.offsetY += dy;
                this.draw();
            }
            
            // Update drag start position for next movement
            this.dragStartX = e.clientX;
            this.dragStartY = e.clientY;
        } else {
            // Update cursor based on what's under the mouse
            this.updateCursor(x, y, e.shiftKey);
        }
        
        // Handle magnifier
        if ((e.ctrlKey || e.metaKey) && this.state.magnifierZoomFactor && this.state.magnifierZoomFactor > 0) {
            this.showMagnifier = true;
            this.updateMagnifier(x, y);
        } else {
            this.showMagnifier = false;
            this.magnifierContainer.classList.add('hidden');
        }
    }
    
    /**
     * Handle mouse up events - stops dragging operations.
     */
    private handleMouseUp(_e: MouseEvent): void {
        this.isDragging = false;
        this.activeHandle = null;
        this.dragSide = null;
        this.showMagnifier = false;
        this.magnifierContainer.classList.add('hidden');
        
        // Reset cursors
        document.body.style.cursor = '';
        if (this.state.canvas) {
            this.state.canvas.style.cursor = 'move';
        }
    }
    
    /**
     * Handle wheel events for zooming.
     * Uses the original zoom calculation for smooth trackpad support.
     */
    private handleWheel(e: WheelEvent): void {
        e.preventDefault();
        
        // Do nothing if no images are loaded
        if (!this.state.imageALoaded && !this.state.imageBLoaded) return;
        
        const rect = this.state.canvas!.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        // Store old scale for ratio calculation
        const oldScale = this.state.scale;
        
        // Use the original zoom calculation for smooth trackpad support
        // zoomPerWheelDelta = 1.00152 provides smooth zooming on trackpads
        const zoomPerWheelDelta = 1.00152;
        const zoomFactor = Math.pow(zoomPerWheelDelta, -e.deltaY);
        
        // Apply the calculated zoom factor to the current scale
        this.state.scale *= zoomFactor;
        
        // Calculate the scale ratio between new and old scale
        // This is used to adjust offsets proportionally
        const scaleRatio = this.state.scale / oldScale;
        
        // Update the global offset to keep the mouse point fixed during zoom
        // This creates the effect of zooming centered on the mouse position
        // The formula ensures that the point under the mouse remains stationary
        this.state.offsetX = mouseX - scaleRatio * (mouseX - this.state.offsetX);
        this.state.offsetY = mouseY - scaleRatio * (mouseY - this.state.offsetY);
        
        // Scale the individual image offsets by the same ratio
        // This maintains the relative positioning of images A and B
        this.state.offsetAX *= scaleRatio;
        this.state.offsetAY *= scaleRatio;
        this.state.offsetBX *= scaleRatio;
        this.state.offsetBY *= scaleRatio;
        
        // Redraw the canvas with the new scale and offsets
        this.draw();
        
        // Update magnifier if it's currently active to reflect the new zoom level
        // The magnifier content needs to be refreshed when the underlying scale changes
        if (this.showMagnifier) {
            this.updateMagnifier(mouseX, mouseY);
        }
    }
    
    /**
     * Handle wipe UI interactions (dragging handles).
     * Matches the original handleWipeUIInteraction function exactly.
     */
    private handleWipeUIInteraction(x: number, y: number): void {
        const wipePos = getWipePositionInCanvasCoords(this.state);
        
        if (this.activeHandle === 'translation') {
            // Update image coordinates directly - match original exactly
            // Canvas coordinates will be computed on-demand from these
            this.state.wipePositionInImageACoords = this.canvasToImageCoords(x, y, 'A');
            
        } else if (this.activeHandle === 'rotation') {
            // Calculate angle from wipe position to mouse position
            const dx = x - wipePos.x;
            const dy = y - wipePos.y;
            
            // Convert from radians to degrees (0° is right, 90° is down)
            this.state.wipeAngle = Math.atan2(dy, dx) * (180 / Math.PI);
            
        } else if (this.activeHandle === 'alpha') {
            // Calculate angle from wipe position to mouse position
            const dx = x - wipePos.x;
            const dy = y - wipePos.y;
            
            // Calculate the absolute angle in degrees from the wipe center to the mouse position
            // atan2 returns angle in radians (-π to π), convert to degrees (-180° to 180°)
            const clickAngle = Math.atan2(dy, dx) * (180 / Math.PI);
            
            // Calculate relative angle from the wipe angle
            // This gives us the angle in the wipe's coordinate system where:
            // - 0° is along the wipe line
            // - 90° is perpendicular to the wipe line
            // Add 360° and use modulo to ensure the result is in the range 0-360°
            const relativeAngle = 360 - ((clickAngle - this.state.wipeAngle + 360) % 360);
            
            // Map the angle to alpha value:
            // - The alpha slider arc spans from 20° to 70° relative to the wipe line
            // - 20° corresponds to alpha = 1.0 (fully opaque)
            // - 70° corresponds to alpha = 0.0 (fully transparent)
            if (relativeAngle >= UI_CONSTANTS.ALPHA_ARC_END_ANGLE && relativeAngle <= UI_CONSTANTS.ALPHA_ARC_START_ANGLE) {
                // Linear mapping from angle to alpha within the valid range
                // Formula: alpha = 1 - (angle - minAngle) / (maxAngle - minAngle)
                this.state.wipeAlpha = 1 - ((relativeAngle - UI_CONSTANTS.ALPHA_ARC_END_ANGLE) / (UI_CONSTANTS.ALPHA_ARC_START_ANGLE - UI_CONSTANTS.ALPHA_ARC_END_ANGLE));
            } else if (relativeAngle < UI_CONSTANTS.ALPHA_ARC_START_ANGLE || relativeAngle > ((UI_CONSTANTS.ALPHA_ARC_START_ANGLE + UI_CONSTANTS.ALPHA_ARC_END_ANGLE)/2 + 180) % 360) {
                // If the angle is less than 20° or greater than 225°,
                // set to maximum alpha (1.0)
                // This creates a "snap to max" behavior when the mouse is in these regions
                this.state.wipeAlpha = 1;
            } else if (relativeAngle > UI_CONSTANTS.ALPHA_ARC_END_ANGLE) {
                // If the angle is greater than 70° but less than 225°,
                // set to minimum alpha (0.0)
                // This creates a "snap to min" behavior when the mouse is in this region
                this.state.wipeAlpha = 0;
            }
        }
        
        // Redraw the canvas with the updated wipe settings
        this.draw();
    }
    
    /**
     * Updates position and RGBA information for a specific image at the given canvas coordinates.
     * 
     * This shared function handles the common logic for both image A and image B information display,
     * eliminating code duplication while maintaining type safety and proper state management.
     * The function calculates image coordinates, validates bounds, extracts pixel data, and updates
     * the corresponding DOM elements with position and color information.
     * 
     * @param x - Canvas X coordinate where the mouse is positioned
     * @param y - Canvas Y coordinate where the mouse is positioned  
     * @param imageType - Which image to process ('A' or 'B')
     * 
     * @remarks
     * This method performs several operations:
     * 1. Converts canvas coordinates to image coordinates
     * 2. Validates that coordinates are within image bounds
     * 3. Extracts RGBA pixel data at the specified location
     * 4. Updates position and color display elements
     * 5. Handles edge cases with appropriate fallback values
     * 
     * The function uses conditional logic to access the correct state properties
     * and DOM elements based on the imageType parameter, ensuring type safety
     * while sharing the common coordinate and pixel extraction logic.
     * 
     * @example
     * ```typescript
     * // Update info for image A
     * this.updateImageInfo(mouseX, mouseY, 'A');
     * 
     * // Update info for image B
     * this.updateImageInfo(mouseX, mouseY, 'B');
     * ```
     */
    private updateImageInfo(x: number, y: number, imageType: ImageType): void {
        // Get image-specific elements and state using factorized helper
        const { isLoaded, image, imageData, coordsRgbaElement } = this.getImageElements(imageType);
        
        // Process image information if the image is loaded and available
        if (isLoaded && image) {
            // Convert canvas coordinates to image coordinates for the specified image type
            const imageCoords = this.canvasToImageCoords(x, y, imageType);
            const imageX = Math.floor(imageCoords.x);
            const imageY = Math.floor(imageCoords.y);
            
            // Extract and display RGBA values if image data is available and coordinates are valid
            if (imageData && 
                imageCoords.x >= 0 && imageCoords.x < image.width &&
                imageCoords.y >= 0 && imageCoords.y < image.height) {
                
                // Calculate pixel index in the ImageData array (4 bytes per pixel: RGBA)
                const pixelIndex = (imageY * image.width + imageX) * 4;
                
                // Extract individual color channel values from the ImageData
                const r = String(imageData.data[pixelIndex]).padStart(3, '0');
                const g = String(imageData.data[pixelIndex + 1]).padStart(3, '0');
                const b = String(imageData.data[pixelIndex + 2]).padStart(3, '0');
                const a = String(imageData.data[pixelIndex + 3]).padStart(3, '0');
                
                // Display the combined coordinates and RGBA values in the requested format
                coordsRgbaElement.textContent = ` [${imageX},${imageY}]=(${r},${g},${b},${a})`;
            } else {
                // Display placeholder when coordinates are outside image bounds
                coordsRgbaElement.textContent = ` [${imageX},${imageY}]=(-,-,-,-)`;
            }
        } else {
            // Clear display when image is not loaded
            coordsRgbaElement.textContent = '';
        }
    }

    /**
     * Update mouse information display and cursor.
     */
    private updateMouseInfo(x: number, y: number): void {
        // Update position and color information for both images using the shared function
        // This eliminates code duplication while maintaining identical functionality
        this.updateImageInfo(x, y, 'A');
        this.updateImageInfo(x, y, 'B');
    }
    
    /**
     * Updates the mouse cursor appearance based on the current mouse position and interaction context.
     * 
     * This method determines the appropriate cursor style by analyzing what UI elements or interactive
     * areas are under the mouse pointer. It handles various cursor states including:
     * - Move cursor for general canvas interaction
     * - Grab cursor for interactive handles (wipe controls)
     * - Grabbing cursor during active drag operations
     * - Hidden cursor when magnifier is active
     * 
     * The cursor update is skipped entirely when the magnifier is active to maintain the hidden
     * cursor state that provides a clean magnification experience without visual distractions.
     * 
     * @param x - Mouse X coordinate in canvas coordinate system
     * @param y - Mouse Y coordinate in canvas coordinate system  
     * @param shiftKey - Whether the Shift key is currently pressed (affects cursor for image-specific dragging)
     * 
     * @remarks
     * This method is called frequently during mouse movement and must be performant. It uses
     * early returns to avoid unnecessary calculations when the magnifier is active or when
     * the canvas is not available.
     * 
     * @example
     * ```typescript
     * // Called from mouse move handler
     * this.updateCursor(mouseX, mouseY, event.shiftKey);
     * ```
     */
    private updateCursor(x: number, y: number, shiftKey: boolean): void {
        // Early exit if canvas is not available - prevents null reference errors
        if (!this.state.canvas) return;
        
        // Critical: Don't update cursor when magnifier is active - it should stay hidden
        // The magnifier provides a clean viewing experience without cursor distractions
        // This prevents the updateCursor method from overriding the 'none' cursor style
        // that was set when the magnifier was activated via Control key press
        if (this.showMagnifier) {
            return;
        }
        
        // Default cursor for general canvas interaction - indicates draggable content
        let cursor = 'move';
        
        // Check if over a wipe handle
        if (this.state.isWipeEnabled && this.state.imageALoaded && this.state.imageBLoaded) {
            const wipePos = getWipePositionInCanvasCoords(this.state);
            
            // Check translation handle (center dot) - available in both simple and full wipe modes
            const distToCenter = Math.sqrt(
                Math.pow(x - wipePos.x, 2) + 
                Math.pow(y - wipePos.y, 2)
            );
            
            if (distToCenter <= UI_CONSTANTS.TRANSLATION_HANDLE_RADIUS) {
                cursor = 'grab';
            } else if (!this.state.isSimpleWipe) {
                // For full wipe interface, check additional handles
                
                // Check rotation handle
                const { x: rotX, y: rotY } = calculateRotationHandlePosition(wipePos, this.state.wipeAngle);
                
                const distToRotHandle = Math.sqrt(
                    Math.pow(x - rotX, 2) + 
                    Math.pow(y - rotY, 2)
                );
                
                if (distToRotHandle <= UI_CONSTANTS.ROTATION_HANDLE_RADIUS) {
                    cursor = 'grab';
                } else {
                    // Check alpha handle
                    const alphaSliderPos = calculateAlphaSliderPosition(wipePos, this.state.wipeAngle, this.state.wipeAlpha);
                    const alphaX = alphaSliderPos.x;
                    const alphaY = alphaSliderPos.y;
                    
                    const distToAlphaHandle = Math.sqrt(
                        Math.pow(x - alphaX, 2) + 
                        Math.pow(y - alphaY, 2)
                    );
                    
                    if (distToAlphaHandle <= UI_CONSTANTS.ALPHA_HANDLE_RADIUS) {
                        cursor = 'grab';
                    }
                }
            }
        }
        
        // Modify cursor for shift key
        if (shiftKey && this.state.isWipeEnabled && 
            this.state.imageALoaded && this.state.imageBLoaded) {
            cursor = 'grab';
        }
        
        this.state.canvas.style.cursor = cursor;
    }
    
    /**
     * Update magnifier position and content.
     */
    private updateMagnifier(x: number, y: number): void {
        if (!this.showMagnifier) return;
        
        // Position and render the magnifier using the dedicated module
        updateMagnifier(this.magnifierContainer, this.magnifierCanvas, x, y, this.state);
        this.magnifierContainer.classList.remove('hidden');
    }
    
    /**
     * Handle drag over events for file dropping.
     */
    private handleDragOver(e: DragEvent): void {
        e.preventDefault();
        if (e.dataTransfer?.types.includes('Files')) {
            const fileCount = e.dataTransfer.files?.length || e.dataTransfer.items?.length || 1;
            
            if (fileCount > 2) {
                this.dragMessage.textContent = 'Drop only up to 2 images';
            } else if (fileCount === 1) {
                this.dragMessage.textContent = 'Drop to load as image A';
            } else {
                this.dragMessage.textContent = 'Drop to load as images A and B';
            }
            this.dragMessage.style.opacity = '1';
        }
    }
    
    /**
     * Handle drag leave events for the main component.
     */
    private handleDragLeave(e: DragEvent): void {
        // Only hide message if leaving the component entirely
        if (!this.contains(e.relatedTarget as Node)) {
            this.dragMessage.style.opacity = '0';
        }
    }
    
    /**
     * Handle drag over events specifically for upload boxes.
     */
    private handleUploadBoxDragOver(imageType: 'A' | 'B', e: DragEvent): void {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer?.types.includes('Files')) {
            const uploadBox = imageType === 'A' ? this.uploadA : this.uploadB;
            uploadBox.style.backgroundColor = '#888';
            this.dragMessage.textContent = `Drop to load as image ${imageType}`;
            this.dragMessage.style.opacity = '1';
        }
    }
    
    /**
     * Handle drag leave events for upload boxes.
     */
    private handleUploadBoxDragLeave(imageType: 'A' | 'B', e: DragEvent): void {
        e.preventDefault();
        e.stopPropagation();
        const uploadBox = imageType === 'A' ? this.uploadA : this.uploadB;
        uploadBox.style.backgroundColor = '';
    }
    
    /**
     * Handle drop events specifically for upload boxes.
     */
    private handleUploadBoxDrop(imageType: 'A' | 'B', e: DragEvent): void {
        e.preventDefault();
        e.stopPropagation();
        this.dragMessage.style.opacity = '0';
        
        const uploadBox = imageType === 'A' ? this.uploadA : this.uploadB;
        uploadBox.style.backgroundColor = '';
        
        if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            const url = URL.createObjectURL(file);
            this.loadImage(url, imageType, file.name);
        }
    }
    
    /**
     * Handle drop events for file dropping.
     */
    private handleDrop(e: DragEvent): void {
        e.preventDefault();
        this.dragMessage.style.opacity = '0';
        
        if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
            // Don't load if more than 2 files
            if (e.dataTransfer.files.length > 2) {
                return;
            }
            
            // Show appropriate loading message
            if (e.dataTransfer.files.length === 2) {
                this.dragMessage.textContent = 'Loading images...';
                this.dragMessage.style.opacity = '1';
            }
            
            // Drop anywhere else - load first as A, second as B
            if (e.dataTransfer.files.length >= 1) {
                const fileA = e.dataTransfer.files[0];
                const urlA = URL.createObjectURL(fileA);
                this.loadImage(urlA, 'A', fileA.name);
            }
            
            if (e.dataTransfer.files.length >= 2) {
                const fileB = e.dataTransfer.files[1];
                const urlB = URL.createObjectURL(fileB);
                this.loadImage(urlB, 'B', fileB.name);
            }
        }
    }
    
    /**
     * Handle keyboard events - only when component has focus.
     */
    private handleKeyDown(e: KeyboardEvent): void {
        // Prevent default to avoid browser shortcuts
        e.preventDefault();
        
        switch (e.key.toLowerCase()) {
            case 'v':
                // Simple wipe mode
                if (this.state.isSimpleWipe) {
                    // Already in simple wipe, center the wipe
                    this.centerWipePosition();
                } else {
                    this.setWipeMode(true);
                }
                break;
                
            case 'w':
                // Full wipe mode
                if (!this.state.isSimpleWipe && this.state.isWipeEnabled) {
                    // Already in full wipe, center the wipe
                    this.centerWipePosition();
                } else {
                    this.setWipeMode(false);
                }
                break;
                
            case 'a':
                this.setDisplayMode('A');
                break;
                
            case 'b':
                this.setDisplayMode('B');
                break;
                
            case 'u':
                this.setDisplayMode('Under');
                break;
                
            case 'o':
                this.setDisplayMode('OnionSkin');
                break;
                
            case 'd':
                this.setDisplayMode('Diff');
                break;
                
            case 'i':
                this.setDisplayMode('InvDiff');
                break;
                
            case 'c':
                this.state.isCheckerboard = !this.state.isCheckerboard;
                this.draw();
                break;
                
            case 'r':
                // Reset view
                this.resetView();
                break;
                
            case 'h':
            case '?':
                // Toggle help screen
                this.state.showHelp = !this.state.showHelp;
                this.manuallyToggledHelp = true;
                this.updateHelpScreenVisibility();
                break;
                
            case 'control':
                // Show magnifier only if zoom factor is greater than 0
                if (this.state.magnifierZoomFactor && this.state.magnifierZoomFactor > 0) {
                    this.showMagnifier = true;
                    this.magnifierContainer.classList.remove('hidden');
                    
                    // Hide cursor when magnifier is active
                    this.state.canvas!.style.cursor = 'none';
                    
                    // Use the last known mouse position
                    if (this.lastMouseX !== 0 && this.lastMouseY !== 0) {
                        this.updateMagnifier(this.lastMouseX, this.lastMouseY);
                    } else if (this.state.canvas) {
                        // If no mouse position is known, use the center of the canvas
                        const x = this.state.canvas.width / 2;
                        const y = this.state.canvas.height / 2;
                        this.updateMagnifier(x, y);
                    }
                }
                break;
        }
    }
    
    /**
     * Handle key up events.
     */
    private handleKeyUp(e: KeyboardEvent): void {
        // Update cursor when shift key is released
        if (e.key === 'Shift') {
            this.updateCursor(this.lastMouseX, this.lastMouseY, false);
        } else if (e.key.toLowerCase() === 'control') {
            // Hide magnifier when Control key is released
            this.showMagnifier = false;
            this.magnifierContainer.classList.add('hidden');
            
            // Restore appropriate cursor
            this.updateCursor(this.lastMouseX, this.lastMouseY, false);
        }
    }
    
    /**
     * Extract filename from URL, handling blob URLs properly.
     */
    private extractFilename(url: string): string {
        // If it's a blob URL, we can't extract the original filename
        if (url.startsWith('blob:')) {
            return 'Uploaded file';
        }
        
        // For regular URLs, extract the filename
        const parts = url.split('/');
        const filename = parts[parts.length - 1];
        
        // Remove query parameters if present
        const cleanFilename = filename.split('?')[0];
        
        return cleanFilename || 'Unknown file';
    }
    
    /**
     * Reset view to fit images and center wipe.
     * Matches the original resetView function exactly.
     */
    private resetView(): void {
        // Do nothing if no images are loaded
        if (!this.state.imageALoaded && !this.state.imageBLoaded) return;
        
        // Reset zoom and position
        this.state.scale = 1;
        this.state.offsetX = 0;
        this.state.offsetY = 0;
        this.state.offsetAX = 0;
        this.state.offsetAY = 0;
        this.state.offsetBX = 0;
        this.state.offsetBY = 0;
        
        // Reset wipe settings
        this.state.wipeAngle = 0;
        this.state.wipeAlpha = 1;
        this.state.isSimpleWipe = false;
        
        // Update attributes to reflect reset state
        this.setAttribute('wipe-angle', '0');
        this.setAttribute('wipe-alpha', '1');
        this.setAttribute('wipe-mode', 'full');
        
        // Center the image(s) - match original logic exactly
        if (this.state.imageALoaded && this.state.imageA && this.state.canvas) {
            // Center image A
            const targetWidth = this.state.imageA.width;
            const targetHeight = this.state.imageA.height;
            
            // Calculate scale to fit 90% of the canvas
            this.state.scale = Math.min(
                this.state.canvas.width / targetWidth, 
                this.state.canvas.height / targetHeight
            ) * 0.9;
            
            // Center the image
            this.state.offsetX = (this.state.canvas.width - targetWidth * this.state.scale) / 2;
            this.state.offsetY = (this.state.canvas.height - targetHeight * this.state.scale) / 2;
        } else if (this.state.imageBLoaded && this.state.imageB && this.state.canvas) {
            // Center image B
            const targetWidth = this.state.imageB.width;
            const targetHeight = this.state.imageB.height;
            
            // Calculate scale to fit 90% of the canvas
            this.state.scale = Math.min(
                this.state.canvas.width / targetWidth, 
                this.state.canvas.height / targetHeight
            ) * 0.9;
            
            // Center the image
            this.state.offsetX = (this.state.canvas.width - targetWidth * this.state.scale) / 2;
            this.state.offsetY = (this.state.canvas.height - targetHeight * this.state.scale) / 2;
        }
        
        // Set wipe position to center of image A
        if (this.state.imageALoaded && this.state.canvas) {
            this.centerWipePosition();
        }
        
        // Redraw the canvas and update PSNR
        this.draw();
        this.updatePSNR();
    }
    
    // Placeholder methods for file input handling and coordinate conversion
    /**
     * Generic file input handler that processes file selection for both image A and B.
     * 
     * This method provides a unified approach to handling file input events from
     * both upload boxes within the web component, eliminating code duplication and
     * ensuring consistent file processing behavior. It performs comprehensive
     * file handling operations:
     * 
     * **Input Validation and Safety:**
     * - Safely casts the event target to HTMLInputElement for type safety
     * - Verifies that files exist and at least one file was selected
     * - Provides robust error handling for invalid or missing file inputs
     * 
     * **File Processing Workflow:**
     * 1. **File Extraction**: Safely extracts the first selected file from the input
     * 2. **URL Generation**: Creates an object URL for the file to enable loading
     * 3. **Image Loading**: Delegates to the loadImage method with proper parameters
     * 4. **Filename Preservation**: Passes the original filename for display purposes
     * 
     * **Component Integration:**
     * - Integrates seamlessly with the component's image loading system
     * - Maintains proper context and state management within the component
     * - Supports both A and B image slots through the imageType parameter
     * 
     * **Memory Management:**
     * The method creates object URLs that should be properly cleaned up by the
     * loadImage method to prevent memory leaks from accumulated blob URLs.
     * 
     * Factorized from separate handleFileInputA and handleFileInputB methods
     * to reduce code duplication and provide a single point of maintenance
     * for file input processing logic within the component.
     * 
     * @param e - The file input change event containing the selected file(s)
     * @param imageType - The target image slot ('A' or 'B') for the loaded image
     * 
     * @example
     * ```typescript
     * // Used internally by the component for both A and B file inputs
     * this.handleFileInput(event, 'A'); // Load into image A slot
     * this.handleFileInput(event, 'B'); // Load into image B slot
     * ```
     * 
     * @see {@link loadImage} - The method that actually loads and processes the image file
     * @see {@link handleFileInputA} - Wrapper method for image A file input
     * @see {@link handleFileInputB} - Wrapper method for image B file input
     */
    private handleFileInput(e: Event, imageType: ImageType): void {
        // Cast the event target to HTMLInputElement for type safety and access to files
        const input = e.target as HTMLInputElement;
        
        // Verify that files exist and at least one file was selected
        if (input.files && input.files[0]) {
            const file = input.files[0]; // Extract the first selected file
            const url = URL.createObjectURL(file); // Create object URL for loading
            
            // Load the image with the generated URL, target slot, and original filename
            this.loadImage(url, imageType, file.name);
        }
    }
    
    /**
     * Handles file input events specifically for image A upload box.
     * 
     * This method serves as a specialized wrapper around the generic handleFileInput
     * method, providing a dedicated entry point for image A file selection events.
     * It maintains the existing method signature for backward compatibility while
     * leveraging the factorized file handling logic.
     * 
     * @param e - The file input change event from the image A file input element
     * 
     * @see {@link handleFileInput} - The generic file handler this method delegates to
     */
    private handleFileInputA(e: Event): void {
        this.handleFileInput(e, 'A');
    }
    
    /**
     * Handles file input events specifically for image B upload box.
     * 
     * This method serves as a specialized wrapper around the generic handleFileInput
     * method, providing a dedicated entry point for image B file selection events.
     * It maintains the existing method signature for backward compatibility while
     * leveraging the factorized file handling logic.
     * 
     * @param e - The file input change event from the image B file input element
     * 
     * @see {@link handleFileInput} - The generic file handler this method delegates to
     */
    private handleFileInputB(e: Event): void {
        this.handleFileInput(e, 'B');
    }
    
    /**
     * Convert canvas coordinates to image coordinates.
     * @param canvasX - X coordinate in canvas space
     * @param canvasY - Y coordinate in canvas space
     * @param imageType - Which image coordinate system to use
     * @returns Image coordinates
     */
    private canvasToImageCoords(canvasX: number, canvasY: number, imageType: ImageType): { x: number, y: number } {
        return canvasToImageCoords(canvasX, canvasY, imageType, this.state);
    }
    
    /**
     * Draw the canvas using the comprehensive drawing module.
     */
    private draw(): void {
        if (!this.state.ctx || !this.state.canvas) return;
        
        // Use the comprehensive drawing module
        drawCanvas(this.state);
    }
}

// Register the custom element
customElements.define('image-comparison', ImageComparisonElement);
