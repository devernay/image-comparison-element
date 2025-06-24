# Image Comparison Element

An HTML element for comparing two images with various compositing modes and a wipe interface, that can be embedded in any web page.

Demo: https://devernay.github.io/image-comparison-element/

## Features

- **Multiple Composite Modes**: Under, OnionSkin, Diff, InvDiff, A-only, B-only
- **Interactive Wipe Interface**: Simple vertical wipe or full rotatable wipe with alpha control
- **Zoom & Pan**: Mouse wheel zoom, click-drag navigation, shift-drag for individual images
- **Magnifier**: Configurable magnifying glass with adjustable zoom and size
- **Drag & Drop**: Load images by dragging files onto the component
- **Keyboard Shortcuts**: Quick mode switching and view controls
- **PSNR Calculation**: Quantitative image comparison metrics
- **Checkerboard Background**: Configurable transparency indicator
- **Quality Assurance**: Automated code quality checks and documentation standards

## Installation

1. Make sure you have [Node.js](https://nodejs.org/) installed on your system.
2. Clone this repository or download the source code.
3. Navigate to the project directory in your terminal.
4. Install the dependencies:

```bash
npm install
```

## Building the Application

### Build

```bash
npm run build
```

### Production Build (Minified)

```bash
npm run build:prod
```

### Quality Assurance

```bash
# Run comprehensive quality checks
npm run quality-check

# Individual checks
npm run lint          # ESLint code quality
npm run dead-code     # Find unused exports
npm run type-check    # TypeScript compilation
```

## Running the Application

1. Build the application and start the server:

```bash
npm run build && npm start
```

2. Open your web browser and navigate to:
   - `http://localhost:3000` - Sample gallery and navigation hub
   - `http://localhost:3000/component.html` - Web component interface

## Web Component Usage

The image comparison element is a custom HTML element `<image-comparison>` that can be embedded in any web page.

### Basic Usage

```html
<!DOCTYPE html>
<html>
<head>
    <title>My Page</title>
</head>
<body>
    <image-comparison 
        image-a="path/to/imageA.jpg"
        image-b="path/to/imageB.jpg"
        display-mode="Under"
        wipe-mode="simple"
        magnifier-radius="150"
        magnifier-zoom-factor="12"
        magnifier-border-size="2"
        checkerboard-square-size="10">
    </image-comparison>
    
    <script type="module" src="js/image-comparison-element.js"></script>
</body>
</html>
```

### Component Attributes

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `image-a` | string | - | URL or path to the first image |
| `image-b` | string | - | URL or path to the second image |
| `display-mode` | string | "Under" | Composite mode: "A", "B", "Under", "OnionSkin", "Diff", "InvDiff" |
| `wipe-mode` | string | "simple" | Wipe interface: "simple" or "full" |
| `wipe-position-x` | number | center | X position of wipe line in image A coordinates |
| `wipe-position-y` | number | center | Y position of wipe line in image A coordinates |
| `wipe-angle` | number | 0 | Angle of wipe line in degrees |
| `wipe-alpha` | number | 1 | Alpha blending factor (0-1) for full wipe mode |
| `magnifier-radius` | number | 200 | Radius of the magnifier in pixels |
| `magnifier-zoom-factor` | number | 8 | Zoom factor for magnification (e.g., 8 for 8x zoom, 0 to disable) |
| `magnifier-border-size` | number | 2 | Border size of the magnifier in pixels (e.g., 0 for no border, 5 for thick border) |
| `checkerboard-square-size` | number | 10 | Size of checkerboard squares in pixels (e.g., 5 for small, 20 for large) |

### Dynamic Control

You can change component attributes dynamically using JavaScript:

```javascript
const element = document.querySelector('image-comparison');

// Change images
element.setAttribute('image-a', 'new-image-a.jpg');
element.setAttribute('image-b', 'new-image-b.jpg');

// Change display mode
element.setAttribute('display-mode', 'Diff');

// Switch wipe mode
element.setAttribute('wipe-mode', 'full');

// Adjust magnifier settings
element.setAttribute('magnifier-radius', '100');
element.setAttribute('magnifier-zoom-factor', '16');
element.setAttribute('magnifier-border-size', '0');

// Adjust checkerboard appearance
element.setAttribute('checkerboard-square-size', '15');

// Disable magnifier
element.setAttribute('magnifier-zoom-factor', '0');
```

### Multiple Components

You can use multiple image comparison elements on the same page. Each maintains its own independent state:

```html
<div style="display: flex; gap: 20px;">
    <image-comparison 
        image-a="imageA1.jpg" 
        image-b="imageB1.jpg"
        magnifier-radius="100"
        magnifier-zoom-factor="4"
        magnifier-border-size="0"
        checkerboard-square-size="5"
        style="width: 400px; height: 300px;">
    </image-comparison>
    
    <image-comparison 
        image-a="imageA2.jpg" 
        image-b="imageB2.jpg"
        display-mode="OnionSkin"
        magnifier-radius="150"
        magnifier-zoom-factor="12"
        magnifier-border-size="5"
        checkerboard-square-size="20"
        style="width: 400px; height: 300px;">
    </image-comparison>
</div>
```

## User Interface

### Loading Images

- Click on the "A" or "B" boxes in the bottom banner to upload images
- Drag and drop images anywhere in the application:
  - Single image dropped anywhere (except B box): Loads as image A
  - Multiple images dropped anywhere: First loads as A, second as B
  - Image dropped directly on A or B box: Loads to that specific slot
- Or specify images using URL parameters or component attributes

### Navigation

- **Click and drag**: Move both images together
- **Shift + click and drag** on the "A" side: Move only image A
- **Shift + click and drag** on the "B" side: Move only image B
- **Mouse wheel**: Zoom in/out, centered on the mouse pointer
- **Ctrl/Cmd key**: Show magnifying glass at mouse pointer position (configurable zoom and size)

### Wipe Interface

- **Translation handle** (center dot): Click and drag to move the wipe line
- **Rotation handle** (smaller dot): Click and drag to rotate the wipe line
- **Alpha slider** (dot on arc): Adjust blending between images

### Keyboard Shortcuts

- **v**: Switch to simple vertical wipe
- **w**: Switch to full wipe interface
- **a**: Show only image A
- **b**: Show only image B
- **u**: "Under" composite mode (default)
- **o**: "OnionSkin" composite mode
- **d**: "Diff" composite mode
- **i**: "InvDiff" composite mode
- **c**: Toggle checkerboard background
- **r**: Reset view (position, zoom, wipe settings)
- **h** or **?**: Toggle help screen

### Bottom Banner Information

- Image upload boxes with filenames
- Mouse position in image A coordinates
- RGBA values from image A at mouse position
- Mouse position in image B coordinates
- RGBA values from image B at mouse position
- PSNR error between images
- Current wipe mode
- Brief help message

## Loading Images from URL Parameters

You can specify which images to load directly from the URL using query parameters:

```
http://localhost:3000/?A=path/to/imageA.jpg&B=path/to/imageB.jpg
```

Where:
- `A` is the URL or path to the first image
- `B` is the URL or path to the second image

Both parameters are optional. The paths can be:
- Relative to the index.html file (e.g., `images/photo.jpg`)
- Absolute URLs (e.g., `https://example.com/images/photo.jpg`)

Example:
```
http://localhost:3000/component.html?A=examples/before.jpg&B=examples/after.jpg
```

Note: When loading images from external domains, those servers must have CORS headers properly configured.

## Sample Pages

The project includes several sample pages demonstrating different use cases:

- `sample-dual-comparison.html` - Two comparison elements side by side
- `sample-multiple-settings.html` - Multiple elements with different settings
- `sample-dynamic-switching.html` - Dynamic image switching with buttons
- `test-component-full.html` - Comprehensive testing interface

## Development

For development with automatic recompilation:

```bash
npm run dev
```

This will:
- Watch for changes in TypeScript files and recompile them automatically
- Restart the server when files change
- Serve the application at `http://localhost:3000`

## Project Structure

```
├── src/                  # TypeScript source code
│   ├── image-comparison-element.ts  # Main web component
│   ├── drawing.ts        # Canvas rendering engine
│   ├── ui-constants.ts   # UI element constants and positioning
│   ├── coordinates.ts    # Coordinate transformation utilities
│   ├── magnifier.ts      # Magnifier functionality
│   ├── mip-mapping.ts    # Image mip-mapping for performance
│   ├── analysis.ts       # PSNR calculation and image analysis
│   └── types.ts          # TypeScript type definitions
├── public/
│   ├── js/              # Compiled JavaScript output
│   ├── examples/        # Example images
│   ├── index.html       # Sample gallery and navigation hub
│   ├── component.html   # Web component interface
│   └── sample-*.html    # Sample pages
├── scripts/             # Build and quality assurance scripts
│   └── quality-check-new.js # Comprehensive quality validation using standard tools
├── .husky/              # Git hooks for quality enforcement
│   └── pre-commit       # Automatic quality checks before commits
├── dist/                # Distribution archives
├── webpack.config.js    # Webpack bundling configuration
└── tsconfig.json        # TypeScript compilation configuration
```

## Cleaning the Project

To clean the project directory from downloaded or generated files:

```bash
npm run clean
```

This will remove:
- `node_modules/` directory (downloaded dependencies)
- `public/js/` directory (compiled JavaScript files)
- Any other generated files

## Creating a Distribution Archive

To create a distribution archive containing all source files, documentation, and auxiliary files:

```bash
npm run dist
```

This will:
- Build the project with quality checks
- Create a ZIP archive in the `dist/` directory
- Include a timestamp in the filename for versioning

The distribution file will be named `image-comparison_YYYY-MM-DD_HH-MM-SS.zip`.

**Note**: Distribution archives are automatically created after successful quality checks.

## Deploying to Any Static Web Server

The application is entirely client-side and can be deployed to any web server that serves static files.

### Standard Build

1. Build the project:

```bash
npm run build
```

2. Copy the following files and directories to your web server:
   - `public/index.html` (sample gallery and navigation hub)
   - `public/component.html` (web component interface)
   - `public/js/` (compiled JavaScript)
   - `public/styles.css` (styling)
   - `public/examples/` (example images, optional)
   - `public/sample-*.html` (sample pages, optional)

### Production Build (Minified)

For smaller file sizes and better performance in production:

1. Build with minification:

```bash
npm run build:prod
```

2. The minified files will be available as `image-comparison-element.min.js`

No server-side code is required - any static file server will work.

## Browser Compatibility

The web component requires modern browsers that support:
- Custom Elements (Web Components)
- ES2020 features
- Canvas 2D API
- File API (for drag and drop)

Supported browsers:
- Chrome 67+
- Firefox 63+
- Safari 13.1+
- Edge 79+

## Architecture

### Component-Based Design
The element is built as a single web component with:
- **Shadow DOM**: Complete encapsulation and style isolation
- **Custom Elements**: Standard web component API
- **TypeScript**: Type-safe development with comprehensive documentation
- **Modular Architecture**: Separated concerns for rendering, coordinates, analysis, and UI

### Performance Optimizations
- **Mip-Mapping**: Pre-scaled image versions for smooth zooming
- **Canvas Rendering**: Hardware-accelerated 2D graphics
- **Efficient Event Handling**: Optimized mouse and keyboard interactions
- **Memory Management**: Proper cleanup of resources and event listeners

### Code Quality
- **44.24% Comment Ratio**: Comprehensive inline documentation
- **100% TSDoc Coverage**: All functions and types documented
- **Automated Quality Gates**: Pre-commit hooks ensure standards
- **Zero Dead Code**: Factorized and optimized implementations

## License

This project is open source. See the license file for details.

## Quality Assurance

This project maintains high code quality standards through automated checks:

### Automated Quality Checks
- **ESLint**: Code quality, style consistency, and JSDoc enforcement
- **TypeScript Compilation**: Strict mode compilation without errors
- **Dead Code Detection**: ts-prune identifies unused exports
- **Build Verification**: Successful webpack bundling
- **Distribution Creation**: Automatic archive generation

### Git Hooks
Pre-commit hooks automatically run quality checks before each commit:
```bash
# Manually run pre-commit checks
npm run precommit
```

### Quality Scripts
```bash
# Run all quality checks
npm run quality-check

# Individual quality checks
npm run lint          # ESLint for code quality and standards
npm run dead-code     # ts-prune for unused code detection
npm run type-check    # TypeScript compilation validation
```

## Contributing

Contributions are welcome! The automated quality system ensures:
- ESLint rules for code quality and consistency
- JSDoc comments on exported functions and classes
- TypeScript compilation passes without errors
- No unused code or duplicate implementations
- Distribution snapshots are created after changes

Quality checks run automatically on commit via Git hooks.
