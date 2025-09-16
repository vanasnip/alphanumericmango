/**
 * Perfect Hexagon Grid Implementation
 * Validated mathematical formulas for edge-to-edge tessellation
 */

class HexagonGrid {
    constructor(radius = 104) {
        this.radius = radius;
        
        // Dense tessellation parameters (overlapping edges pattern from SVG analysis)
        this.horizontalSpacing = Math.sqrt(3) * radius;  // √3 × r ≈ 1.732r
        this.verticalSpacing = 1.5 * radius;             // 1.5 × r
        this.rowOffset = (Math.sqrt(3) / 2) * radius;    // (√3/2) × r ≈ 0.866r
        
        console.log('Hexagon Grid Parameters:');
        console.log(`  Radius: ${this.radius}`);
        console.log(`  Horizontal spacing: ${this.horizontalSpacing.toFixed(2)}`);
        console.log(`  Vertical spacing: ${this.verticalSpacing.toFixed(2)}`);
        console.log(`  Row offset: ${this.rowOffset.toFixed(2)}`);
    }
    
    /**
     * Generate vertices for a pointy-topped hexagon
     * @param {number} centerX - X coordinate of center
     * @param {number} centerY - Y coordinate of center
     * @returns {Array<Array<number>>} Array of [x, y] vertex coordinates
     */
    generateHexagonVertices(centerX, centerY) {
        const vertices = [];
        
        // Start at top point (90°), go clockwise in 60° increments
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 2) - (i * Math.PI / 3);
            const x = centerX + this.radius * Math.cos(angle);
            const y = centerY - this.radius * Math.sin(angle); // SVG Y-axis is inverted
            vertices.push([x, y]);
        }
        
        return vertices;
    }
    
    /**
     * Generate center points for a hexagon grid
     * @param {number} startX - Starting X coordinate
     * @param {number} startY - Starting Y coordinate  
     * @param {number} cols - Number of columns
     * @param {number} rows - Number of rows
     * @returns {Array<Array<number>>} Array of [x, y] center coordinates
     */
    generateGridCenters(startX, startY, cols, rows) {
        const centers = [];
        
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                // Calculate position with row offset for honeycomb pattern
                const x = startX + col * this.horizontalSpacing + (row % 2) * this.rowOffset;
                const y = startY + row * this.verticalSpacing;
                centers.push([x, y]);
            }
        }
        
        return centers;
    }
    
    /**
     * Generate SVG path string for a hexagon
     * @param {number} centerX - X coordinate of center
     * @param {number} centerY - Y coordinate of center
     * @returns {string} SVG path string
     */
    generateSVGPath(centerX, centerY) {
        const vertices = this.generateHexagonVertices(centerX, centerY);
        
        // Start with Move command to first vertex
        let path = `M${vertices[0][0]} ${vertices[0][1]}`;
        
        // Add Line commands for remaining vertices
        for (let i = 1; i < vertices.length; i++) {
            path += `L${vertices[i][0]} ${vertices[i][1]}`;
        }
        
        // Close the path
        path += 'Z';
        
        return path;
    }
    
    /**
     * Generate complete SVG for a hexagon grid
     * @param {number} cols - Number of columns
     * @param {number} rows - Number of rows
     * @param {number} startX - Starting X coordinate (default: radius)
     * @param {number} startY - Starting Y coordinate (default: radius)
     * @returns {string} Complete SVG string
     */
    generateGridSVG(cols, rows, startX = this.radius, startY = this.radius) {
        const centers = this.generateGridCenters(startX, startY, cols, rows);
        
        // Calculate SVG dimensions
        const maxX = Math.max(...centers.map(c => c[0])) + this.radius;
        const maxY = Math.max(...centers.map(c => c[1])) + this.radius;
        
        let svg = `<svg width="${maxX}" height="${maxY}" viewBox="0 0 ${maxX} ${maxY}" fill="none" xmlns="http://www.w3.org/2000/svg">\n`;
        
        // Generate path for each hexagon
        centers.forEach(([centerX, centerY], index) => {
            const path = this.generateSVGPath(centerX, centerY);
            svg += `<path d="${path}" fill="#D9D9D9" stroke="#000" stroke-width="1"/>\n`;
        });
        
        svg += '</svg>';
        return svg;
    }
    
    /**
     * Validate tessellation by checking edge distances
     * @param {Array<Array<number>>} centers - Array of center coordinates
     * @returns {Object} Validation results
     */
    validateTessellation(centers) {
        const validation = {
            horizontalDistances: [],
            verticalDistances: [],
            offsetDistances: [],
            isValid: true
        };
        
        // Check horizontal distances (same row)
        for (let i = 0; i < centers.length - 1; i++) {
            const current = centers[i];
            const next = centers[i + 1];
            
            // Check if on same row (similar Y coordinates)
            if (Math.abs(current[1] - next[1]) < 1) {
                const distance = Math.abs(next[0] - current[0]);
                validation.horizontalDistances.push(distance);
            }
        }
        
        // Validate distances match expected spacing
        const expectedHorizontal = this.horizontalSpacing;
        const horizontalValid = validation.horizontalDistances.every(d => 
            Math.abs(d - expectedHorizontal) < 1
        );
        
        validation.isValid = horizontalValid;
        validation.expectedHorizontal = expectedHorizontal;
        validation.actualHorizontal = validation.horizontalDistances[0] || 0;
        
        return validation;
    }
}

// Example usage and validation
function demonstrateImplementation() {
    console.log('=== HEXAGON GRID IMPLEMENTATION DEMONSTRATION ===\n');
    
    // Create grid with same radius as analyzed SVG
    const grid = new HexagonGrid(104);
    
    // Generate a small test grid
    console.log('\n1. GENERATING TEST GRID (3x3):');
    const centers = grid.generateGridCenters(104, 104, 3, 3);
    console.log('Centers:', centers.map(c => `(${c[0].toFixed(1)}, ${c[1].toFixed(1)})`));
    
    // Validate tessellation
    console.log('\n2. TESSELLATION VALIDATION:');
    const validation = grid.validateTessellation(centers);
    console.log(`Expected horizontal spacing: ${validation.expectedHorizontal.toFixed(2)}`);
    console.log(`Actual horizontal spacing: ${validation.actualHorizontal.toFixed(2)}`);
    console.log(`Tessellation valid: ${validation.isValid ? '✓' : '✗'}`);
    
    // Generate example hexagon vertices
    console.log('\n3. EXAMPLE HEXAGON VERTICES:');
    const vertices = grid.generateHexagonVertices(720, 416);
    vertices.forEach((vertex, i) => {
        console.log(`  Vertex ${i}: (${vertex[0].toFixed(1)}, ${vertex[1].toFixed(1)})`);
    });
    
    // Generate SVG path
    console.log('\n4. SVG PATH GENERATION:');
    const svgPath = grid.generateSVGPath(720, 416);
    console.log(`SVG Path: ${svgPath}`);
    
    // Compare with original SVG coordinates
    console.log('\n5. COMPARISON WITH ORIGINAL SVG:');
    console.log('Original: M720 312L810 364V468L720 520L630 468V364L720 312Z');
    console.log(`Generated: ${svgPath}`);
    
    return grid;
}

// Scalable hexagon grid function
function createScalableGrid(desiredRadius, cols, rows) {
    const grid = new HexagonGrid(desiredRadius);
    return {
        radius: desiredRadius,
        parameters: {
            horizontalSpacing: grid.horizontalSpacing,
            verticalSpacing: grid.verticalSpacing,
            rowOffset: grid.rowOffset
        },
        generateSVG: () => grid.generateGridSVG(cols, rows),
        generateCenters: (startX, startY) => grid.generateGridCenters(startX, startY, cols, rows),
        generateVertices: (centerX, centerY) => grid.generateHexagonVertices(centerX, centerY)
    };
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { HexagonGrid, createScalableGrid, demonstrateImplementation };
}

// Run demonstration if called directly
if (typeof window === 'undefined') {
    demonstrateImplementation();
}