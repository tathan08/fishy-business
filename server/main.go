package main

import (
	"log"
	"net/http"
)

func main() {
	// Create the game world
	world := NewWorld()

	// Start the game loop
	world.Start()

	// Setup HTTP routes
	http.HandleFunc("/ws", HandleWebSocket(world))        // Primary: position updates
	http.HandleFunc("/ws/meta", HandleMetaWebSocket(world)) // Secondary: metadata
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("Fishy Business Server Running"))
	})

	// Start the server
	port := ":8080"
	log.Printf("Starting server on %s", port)
	log.Printf("WebSocket endpoints:")
	log.Printf("  - Primary:  ws://localhost%s/ws", port)
	log.Printf("  - Metadata: ws://localhost%s/ws/meta", port)

	if err := http.ListenAndServe(port, nil); err != nil {
		log.Fatal("Server error:", err)
	}
}
