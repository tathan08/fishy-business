package main

// Quadtree is a spatial partitioning data structure for efficient collision detection
type Quadtree struct {
	Bounds   Rect
	Capacity int
	Entities []Entity
	Divided  bool
	NW       *Quadtree
	NE       *Quadtree
	SW       *Quadtree
	SE       *Quadtree
}

// Entity represents an object that can be stored in the quadtree
type Entity interface {
	GetPosition() Vec2
	GetRadius() float64
	GetID() string
}

// NewQuadtree creates a new quadtree with the given bounds and capacity
func NewQuadtree(bounds Rect, capacity int) *Quadtree {
	return &Quadtree{
		Bounds:   bounds,
		Capacity: capacity,
		Entities: make([]Entity, 0, capacity),
		Divided:  false,
	}
}

// Insert adds an entity to the quadtree
func (qt *Quadtree) Insert(entity Entity) bool {
	pos := entity.GetPosition()
	if !qt.Bounds.Contains(pos) {
		return false
	}

	if len(qt.Entities) < qt.Capacity && !qt.Divided {
		qt.Entities = append(qt.Entities, entity)
		return true
	}

	if !qt.Divided {
		qt.Subdivide()
	}

	if qt.NW.Insert(entity) {
		return true
	}
	if qt.NE.Insert(entity) {
		return true
	}
	if qt.SW.Insert(entity) {
		return true
	}
	if qt.SE.Insert(entity) {
		return true
	}

	return false
}

// Subdivide splits the quadtree into four sub-quadrants
func (qt *Quadtree) Subdivide() {
	x := qt.Bounds.X
	y := qt.Bounds.Y
	w := qt.Bounds.Width / 2
	h := qt.Bounds.Height / 2

	qt.NW = NewQuadtree(Rect{X: x, Y: y, Width: w, Height: h}, qt.Capacity)
	qt.NE = NewQuadtree(Rect{X: x + w, Y: y, Width: w, Height: h}, qt.Capacity)
	qt.SW = NewQuadtree(Rect{X: x, Y: y + h, Width: w, Height: h}, qt.Capacity)
	qt.SE = NewQuadtree(Rect{X: x + w, Y: y + h, Width: w, Height: h}, qt.Capacity)

	qt.Divided = true

	// Re-insert existing entities into subdivisions
	for _, entity := range qt.Entities {
		qt.NW.Insert(entity)
		qt.NE.Insert(entity)
		qt.SW.Insert(entity)
		qt.SE.Insert(entity)
	}
	qt.Entities = nil
}

// Query returns all entities within a given range
func (qt *Quadtree) Query(range_ Rect, found []Entity) []Entity {
	if found == nil {
		found = make([]Entity, 0)
	}

	if !qt.Bounds.Intersects(range_) {
		return found
	}

	for _, entity := range qt.Entities {
		pos := entity.GetPosition()
		if range_.Contains(pos) {
			found = append(found, entity)
		}
	}

	if qt.Divided {
		found = qt.NW.Query(range_, found)
		found = qt.NE.Query(range_, found)
		found = qt.SW.Query(range_, found)
		found = qt.SE.Query(range_, found)
	}

	return found
}

// QueryCircle returns all entities within a circular range
func (qt *Quadtree) QueryCircle(center Vec2, radius float64, found []Entity) []Entity {
	if found == nil {
		found = make([]Entity, 0)
	}

	// Check if circle intersects with this quad's bounds
	if !CircleIntersectsRect(center, radius, qt.Bounds) {
		return found
	}

	// Check entities in this quad
	for _, entity := range qt.Entities {
		if Distance(center, entity.GetPosition()) <= radius+entity.GetRadius() {
			found = append(found, entity)
		}
	}

	if qt.Divided {
		found = qt.NW.QueryCircle(center, radius, found)
		found = qt.NE.QueryCircle(center, radius, found)
		found = qt.SW.QueryCircle(center, radius, found)
		found = qt.SE.QueryCircle(center, radius, found)
	}

	return found
}

// PlayerEntity wraps a Player to implement the Entity interface
type PlayerEntity struct {
	*Player
}

func (pe *PlayerEntity) GetPosition() Vec2 {
	return pe.Position
}

func (pe *PlayerEntity) GetRadius() float64 {
	return pe.Size
}

func (pe *PlayerEntity) GetID() string {
	return pe.ID
}

// FoodEntity wraps a Food to implement the Entity interface
type FoodEntity struct {
	*Food
}

func (fe *FoodEntity) GetPosition() Vec2 {
	return fe.Position
}

func (fe *FoodEntity) GetRadius() float64 {
	return fe.Size
}

func (fe *FoodEntity) GetID() string {
	return string(rune(fe.ID))
}
