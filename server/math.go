package main

import "math"

// Vec2 represents a 2D vector
type Vec2 struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

// Add adds two vectors
func (v Vec2) Add(other Vec2) Vec2 {
	return Vec2{X: v.X + other.X, Y: v.Y + other.Y}
}

// Sub subtracts two vectors
func (v Vec2) Sub(other Vec2) Vec2 {
	return Vec2{X: v.X - other.X, Y: v.Y - other.Y}
}

// Mul multiplies a vector by a scalar
func (v Vec2) Mul(scalar float64) Vec2 {
	return Vec2{X: v.X * scalar, Y: v.Y * scalar}
}

// Length returns the magnitude of the vector
func (v Vec2) Length() float64 {
	return math.Sqrt(v.X*v.X + v.Y*v.Y)
}

// Normalize returns a unit vector in the same direction
func (v Vec2) Normalize() Vec2 {
	length := v.Length()
	if length == 0 {
		return Vec2{X: 0, Y: 0}
	}
	return Vec2{X: v.X / length, Y: v.Y / length}
}

// Distance returns the distance between two points
func Distance(a, b Vec2) float64 {
	dx := b.X - a.X
	dy := b.Y - a.Y
	return math.Sqrt(dx*dx + dy*dy)
}

// Lerp performs linear interpolation between two vectors
func Lerp(a, b Vec2, t float64) Vec2 {
	return Vec2{
		X: a.X + (b.X-a.X)*t,
		Y: a.Y + (b.Y-a.Y)*t,
	}
}

// Rect represents an axis-aligned bounding box
type Rect struct {
	X      float64
	Y      float64
	Width  float64
	Height float64
}

// Contains checks if a point is inside the rectangle
func (r Rect) Contains(point Vec2) bool {
	return point.X >= r.X && point.X <= r.X+r.Width &&
		point.Y >= r.Y && point.Y <= r.Y+r.Height
}

// Intersects checks if two rectangles overlap
func (r Rect) Intersects(other Rect) bool {
	return r.X < other.X+other.Width &&
		r.X+r.Width > other.X &&
		r.Y < other.Y+other.Height &&
		r.Y+r.Height > other.Y
}

// CircleIntersectsRect checks if a circle intersects with a rectangle
func CircleIntersectsRect(center Vec2, radius float64, rect Rect) bool {
	// Find the closest point to the circle within the rectangle
	closestX := math.Max(rect.X, math.Min(center.X, rect.X+rect.Width))
	closestY := math.Max(rect.Y, math.Min(center.Y, rect.Y+rect.Height))

	// Calculate the distance between the circle's center and this closest point
	distanceX := center.X - closestX
	distanceY := center.Y - closestY

	// If the distance is less than the circle's radius, an intersection occurs
	distanceSquared := distanceX*distanceX + distanceY*distanceY
	return distanceSquared < (radius * radius)
}

// CirclesOverlap checks if two circles overlap
func CirclesOverlap(pos1 Vec2, radius1 float64, pos2 Vec2, radius2 float64) bool {
	distance := Distance(pos1, pos2)
	return distance < (radius1 + radius2)
}

// Circle represents a circular hitbox
type Circle struct {
	Center Vec2
	Radius float64
}

// OrientedRect represents a rotated rectangle
type OrientedRect struct {
	Center   Vec2
	Width    float64
	Height   float64
	Rotation float64
}

// CircleCircleCollision checks if two circles overlap
func CircleCircleCollision(c1, c2 Circle) bool {
	dx := c1.Center.X - c2.Center.X
	dy := c1.Center.Y - c2.Center.Y
	distSq := dx*dx + dy*dy
	radiusSum := c1.Radius + c2.Radius
	return distSq < radiusSum*radiusSum
}

// CircleOrientedRectCollision checks if circle overlaps rotated rectangle
func CircleOrientedRectCollision(circle Circle, rect OrientedRect) bool {
	// Transform circle to rectangle's local space
	cos := math.Cos(-rect.Rotation)
	sin := math.Sin(-rect.Rotation)

	dx := circle.Center.X - rect.Center.X
	dy := circle.Center.Y - rect.Center.Y

	localX := dx*cos - dy*sin
	localY := dx*sin + dy*cos

	// Find closest point on rectangle to circle
	halfWidth := rect.Width / 2
	halfHeight := rect.Height / 2

	closestX := Clamp(localX, -halfWidth, halfWidth)
	closestY := Clamp(localY, -halfHeight, halfHeight)

	// Check distance from circle center to closest point
	distX := localX - closestX
	distY := localY - closestY
	distSq := distX*distX + distY*distY

	return distSq < circle.Radius*circle.Radius
}

// OrientedRectCollision checks if two oriented rectangles overlap
// Returns (collision, separation vector)
func OrientedRectCollision(r1, r2 OrientedRect) (bool, Vec2) {
	// Simple implementation: use circle approximation
	// For full OBB collision, implement Separating Axis Theorem
	dist := Distance(r1.Center, r2.Center)
	maxDist := (r1.Width + r2.Width) / 2

	if dist < maxDist {
		// Calculate separation vector
		if dist > 0 {
			dx := r2.Center.X - r1.Center.X
			dy := r2.Center.Y - r1.Center.Y
			norm := math.Sqrt(dx*dx + dy*dy)
			return true, Vec2{X: dx / norm, Y: dy / norm}
		}
		return true, Vec2{X: 1, Y: 0}
	}
	return false, Vec2{}
}

// Min returns the smaller of two values
func Min(a, b float64) float64 {
	if a < b {
		return a
	}
	return b
}
