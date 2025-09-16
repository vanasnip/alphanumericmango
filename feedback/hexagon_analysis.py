#!/usr/bin/env python3
"""
Mathematical Analysis of Hexagon Grid Tessellation
Analyzing the filled.svg coordinates to validate tessellation parameters
"""

import math
import numpy as np
from typing import List, Tuple, Dict

class HexagonAnalysis:
    def __init__(self):
        # Extract sample hexagon coordinates from the SVG
        self.sample_hexagons = [
            # Format: [(center_x, center_y), vertices]
            # Hexagon 1: M720 312L810 364V468L720 520L630 468V364L720 312Z
            (720, 416, [(720, 312), (810, 364), (810, 468), (720, 520), (630, 468), (630, 364)]),
            # Hexagon 2: M900 312L990 364V468L900 520L810 468V364L900 312Z  
            (900, 416, [(900, 312), (990, 364), (990, 468), (900, 520), (810, 468), (810, 364)]),
            # Hexagon 3: M630 468L720 520V624L630 676L540 624V520L630 468Z
            (630, 572, [(630, 468), (720, 520), (720, 624), (630, 676), (540, 624), (540, 520)]),
            # Hexagon 4: M810 468L900 520V624L810 676L720 624V520L810 468Z
            (810, 572, [(810, 468), (900, 520), (900, 624), (810, 676), (720, 624), (720, 520)]),
        ]
    
    def analyze_hexagon_geometry(self, center_x: float, center_y: float, vertices: List[Tuple[float, float]]) -> Dict:
        """Analyze a single hexagon's geometric properties"""
        # Calculate radius (distance from center to vertex)
        radius = math.sqrt((vertices[0][0] - center_x)**2 + (vertices[0][1] - center_y)**2)
        
        # Calculate angles from center to each vertex
        angles = []
        for vx, vy in vertices:
            angle = math.atan2(vy - center_y, vx - center_x)
            angles.append(math.degrees(angle))
        
        # Normalize angles to 0-360 range
        angles = [(a + 360) % 360 for a in angles]
        angles.sort()
        
        # Calculate side lengths
        side_lengths = []
        for i in range(len(vertices)):
            v1 = vertices[i]
            v2 = vertices[(i + 1) % len(vertices)]
            side_length = math.sqrt((v2[0] - v1[0])**2 + (v2[1] - v1[1])**2)
            side_lengths.append(side_length)
        
        return {
            'center': (center_x, center_y),
            'radius': radius,
            'angles': angles,
            'side_lengths': side_lengths,
            'vertices': vertices
        }
    
    def determine_orientation(self, angles: List[float]) -> str:
        """Determine if hexagon is pointy-topped or flat-topped"""
        # Normalize first angle
        first_angle = angles[0]
        
        # For pointy-topped: first vertex should be at 90° (top point)
        # For flat-topped: first vertex should be at 0° or 30° (right edge)
        
        if abs(first_angle - 90) < 5:  # Within 5 degrees tolerance
            return "pointy-topped"
        elif abs(first_angle - 0) < 5 or abs(first_angle - 30) < 5:
            return "flat-topped"
        else:
            return f"unknown (first angle: {first_angle}°)"
    
    def calculate_spacing_parameters(self) -> Dict:
        """Calculate horizontal and vertical spacing between hexagon centers"""
        centers = [(hex_data[0], hex_data[1]) for hex_data in self.sample_hexagons]
        
        # Find horizontal spacing (same row)
        hex1_center = centers[0]  # (720, 416)
        hex2_center = centers[1]  # (900, 416)
        horizontal_spacing = abs(hex2_center[0] - hex1_center[0])
        
        # Find vertical spacing (adjacent rows)
        hex3_center = centers[2]  # (630, 572) 
        hex1_center = centers[0]  # (720, 416)
        vertical_spacing = abs(hex3_center[1] - hex1_center[1])
        
        # Calculate row offset
        row_offset = abs(hex3_center[0] - hex1_center[0])
        
        return {
            'horizontal_spacing': horizontal_spacing,
            'vertical_spacing': vertical_spacing,
            'row_offset': row_offset
        }
    
    def validate_tessellation_theory(self, radius: float, spacing: Dict) -> Dict:
        """Validate theoretical spacing relationships against actual measurements"""
        # Theoretical values for pointy-topped hexagons
        theoretical_horizontal = 3 * radius
        theoretical_vertical = math.sqrt(3) * radius
        theoretical_row_offset = 1.5 * radius
        
        # Compare with measured values
        horizontal_ratio = spacing['horizontal_spacing'] / theoretical_horizontal
        vertical_ratio = spacing['vertical_spacing'] / theoretical_vertical
        offset_ratio = spacing['row_offset'] / theoretical_row_offset
        
        return {
            'radius': radius,
            'theoretical': {
                'horizontal_spacing': theoretical_horizontal,
                'vertical_spacing': theoretical_vertical,
                'row_offset': theoretical_row_offset
            },
            'measured': spacing,
            'ratios': {
                'horizontal': horizontal_ratio,
                'vertical': vertical_ratio,
                'row_offset': offset_ratio
            },
            'validation': {
                'horizontal_valid': abs(horizontal_ratio - 1.0) < 0.01,
                'vertical_valid': abs(vertical_ratio - 1.0) < 0.01,
                'offset_valid': abs(offset_ratio - 1.0) < 0.01
            }
        }
    
    def generate_perfect_hexagon_vertices(self, center_x: float, center_y: float, radius: float, pointy_topped: bool = True) -> List[Tuple[float, float]]:
        """Generate mathematically perfect hexagon vertices"""
        vertices = []
        
        if pointy_topped:
            # Start at top point (90°), go clockwise
            start_angle = math.radians(90)
        else:
            # Start at right edge (0°), go clockwise  
            start_angle = math.radians(0)
        
        for i in range(6):
            angle = start_angle - (i * math.radians(60))  # Clockwise
            x = center_x + radius * math.cos(angle)
            y = center_y - radius * math.sin(angle)  # SVG has inverted Y
            vertices.append((x, y))
        
        return vertices
    
    def run_complete_analysis(self) -> Dict:
        """Run complete mathematical analysis"""
        print("=== HEXAGON TESSELLATION MATHEMATICAL ANALYSIS ===\n")
        
        results = {}
        
        # Analyze each sample hexagon
        print("1. INDIVIDUAL HEXAGON ANALYSIS:")
        for i, (cx, cy, vertices) in enumerate(self.sample_hexagons):
            analysis = self.analyze_hexagon_geometry(cx, cy, vertices)
            orientation = self.determine_orientation(analysis['angles'])
            
            print(f"  Hexagon {i+1}:")
            print(f"    Center: ({cx}, {cy})")
            print(f"    Radius: {analysis['radius']:.2f}")
            print(f"    Orientation: {orientation}")
            print(f"    Vertex angles: {[f'{a:.1f}°' for a in analysis['angles']]}")
            print(f"    Side lengths: {[f'{s:.2f}' for s in analysis['side_lengths']]}")
            print()
            
            if i == 0:  # Use first hexagon as reference
                results['reference_hexagon'] = analysis
                results['orientation'] = orientation
        
        # Calculate spacing parameters
        print("2. TESSELLATION SPACING ANALYSIS:")
        spacing = self.calculate_spacing_parameters()
        print(f"  Horizontal spacing: {spacing['horizontal_spacing']}")
        print(f"  Vertical spacing: {spacing['vertical_spacing']}")
        print(f"  Row offset: {spacing['row_offset']}")
        print()
        
        # Validate against theory
        print("3. THEORETICAL VALIDATION:")
        radius = results['reference_hexagon']['radius']
        validation = self.validate_tessellation_theory(radius, spacing)
        
        print(f"  Measured radius: {radius:.2f}")
        print(f"  Theoretical vs Measured:")
        print(f"    Horizontal spacing: {validation['theoretical']['horizontal_spacing']:.2f} vs {validation['measured']['horizontal_spacing']} (ratio: {validation['ratios']['horizontal']:.4f})")
        print(f"    Vertical spacing: {validation['theoretical']['vertical_spacing']:.2f} vs {validation['measured']['vertical_spacing']} (ratio: {validation['ratios']['vertical']:.4f})")
        print(f"    Row offset: {validation['theoretical']['row_offset']:.2f} vs {validation['measured']['row_offset']} (ratio: {validation['ratios']['row_offset']:.4f})")
        print()
        
        print("4. VALIDATION RESULTS:")
        for param, valid in validation['validation'].items():
            status = "✓ VALID" if valid else "✗ INVALID"
            print(f"    {param}: {status}")
        print()
        
        # Generate perfect hexagon formula
        print("5. PERFECT HEXAGON GENERATION FORMULA:")
        perfect_vertices = self.generate_perfect_hexagon_vertices(720, 416, radius, pointy_topped=True)
        print("  For pointy-topped hexagon with center (cx, cy) and radius r:")
        print("  vertices = [(cx + r*cos(90° - i*60°), cy - r*sin(90° - i*60°)) for i in range(6)]")
        print(f"  Example with center (720, 416) and radius {radius:.2f}:")
        for i, (x, y) in enumerate(perfect_vertices):
            print(f"    Vertex {i}: ({x:.1f}, {y:.1f})")
        print()
        
        results.update({
            'spacing': spacing,
            'validation': validation,
            'perfect_vertices_example': perfect_vertices
        })
        
        return results

if __name__ == "__main__":
    analyzer = HexagonAnalysis()
    results = analyzer.run_complete_analysis()
    
    # Final recommendation
    print("=== IMPLEMENTATION RECOMMENDATION ===")
    
    if all(results['validation']['validation'].values()):
        print("✓ The current SVG implementation uses CORRECT mathematical relationships!")
        print("✓ Confirmed: Uses pointy-topped hexagons with perfect tessellation parameters")
        print("✓ Recommended approach: Use the existing spacing parameters")
    else:
        print("✗ The current SVG implementation has mathematical inconsistencies")
        print("✗ Recommend using theoretical perfect values instead")
    
    print(f"\nFinal Parameters for Implementation:")
    radius = results['reference_hexagon']['radius']
    print(f"  Radius: {radius:.2f}")
    print(f"  Horizontal spacing: {3 * radius:.2f} (3 × radius)")  
    print(f"  Vertical spacing: {math.sqrt(3) * radius:.2f} (√3 × radius)")
    print(f"  Row offset: {1.5 * radius:.2f} (1.5 × radius)")
    print(f"  Orientation: Pointy-topped")
    print(f"  Vertex angles: [90°, 30°, -30°, -90°, -150°, 150°] (from top, clockwise)")