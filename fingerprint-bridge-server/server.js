import { WebSocketServer, WebSocket } from "ws";

// --- CONFIGURATION ---
const WS_PORT = 5000;
const ESP32_IP = "192.168.137.77"; // Your ESP32's IP address 192.168.137.116


const ESP32_PORT = 8080; // ESP32 WebSocket server port
// --- END CONFIGURATION ---

const wss = new WebSocketServer({ port: WS_PORT });
console.log(`WebSocket server started on port ${WS_PORT}...`);
console.log("Waiting for web clients to connect...");
console.log(`Will connect to ESP32 at ws://${ESP32_IP}:${ESP32_PORT}\n`);

// Track connected clients
const clients = {
  esp32: null,
  webClients: new Set(),
};

let esp32Client = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 999; // Keep trying

// Store last known GPS coordinates
let lastKnownGPS = {
  lat: null,
  lon: null,
  alt: null,
  gpsFixed: false
};

// Function to connect to ESP32 as a WebSocket client
function connectToESP32() {
  if (esp32Client && esp32Client.readyState === WebSocket.OPEN) {
    console.log("Already connected to ESP32");
    return;
  }

  console.log(`Attempting to connect to ESP32 at ws://${ESP32_IP}:${ESP32_PORT}...`);
  
  try {
    esp32Client = new WebSocket(`ws://${ESP32_IP}:${ESP32_PORT}`);

    esp32Client.on("open", () => {
      reconnectAttempts = 0;
      console.log("✓ Connected to ESP32!");
      console.log("Requesting initial status...\n");
      
      // Request status from ESP32
      esp32Client.send("GET_STATUS");
      
      // Notify web clients that ESP32 is connected
      broadcastToWebClients({
        type: "ESP32_CONNECTION",
        connected: true,
      });
    });

    esp32Client.on("message", (data) => {
      try {
        const message = JSON.parse(data.toString());
        handleESP32Message(message);
      } catch (e) {
        console.log("Non-JSON message from ESP32:", data.toString());
      }
    });

    esp32Client.on("close", () => {
      console.log("⚠ ESP32 connection closed");
      esp32Client = null;
      
      // Notify web clients
      broadcastToWebClients({
        type: "ESP32_CONNECTION",
        connected: false,
      });
      
      // Attempt to reconnect
      scheduleReconnect();
    });

    esp32Client.on("error", (error) => {
      console.error("ESP32 connection error:", error.message);
      esp32Client = null;
      scheduleReconnect();
    });

  } catch (error) {
    console.error("Failed to connect to ESP32:", error.message);
    scheduleReconnect();
  }
}

// Schedule reconnection to ESP32
function scheduleReconnect() {
  if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
    reconnectAttempts++;
    const delay = Math.min(5000 * reconnectAttempts, 30000); // Max 30 seconds
    console.log(`Will retry connection in ${delay/1000} seconds... (Attempt ${reconnectAttempts})`);
    
    setTimeout(() => {
      connectToESP32();
    }, delay);
  }
}

// Handle messages from ESP32
function handleESP32Message(data) {
  // Handle status updates from ESP32
  if (data.type === "STATUS") {
    console.log("\n=== ESP32 STATUS UPDATE ===");
    console.log(`WiFi: ${data.wifi ? "✓" : "✗"}`);
    console.log(`Fingerprint: ${data.fingerprint ? "✓" : "✗"}`);
    console.log(`GPS Module: ${data.gps ? "✓" : "✗"}`);
    console.log(`GPS Fixed: ${data.gpsFixed ? "✓" : "✗"}`);
    console.log(`Satellites: ${data.satellites}`);
    console.log(`IP Address: ${data.ip}`);
    console.log("===========================\n");

    // Broadcast status to web clients
    broadcastToWebClients({
      type: "ESP32_STATUS",
      data: data,
    });

    // Cache GPS if available and valid (non-zero)
    if (data.lat && data.lon && (data.lat !== 0 || data.lon !== 0)) {
        const oldLat = lastKnownGPS.lat;
        const oldLon = lastKnownGPS.lon;
        
        lastKnownGPS = {
            lat: data.lat,
            lon: data.lon,
            alt: data.alt || 0,
            gpsFixed: data.gpsFixed || false
        };
        
        // Only log if coordinates actually changed
        if (oldLat !== data.lat || oldLon !== data.lon) {
            console.log("📍 GPS Coordinates Updated:");
            console.log(`   Old: ${oldLat}, ${oldLon}`);
            console.log(`   New: ${data.lat}, ${data.lon}`);
        }
    } else if (data.lat === 0 && data.lon === 0) {
        console.log("Ignored invalid GPS (0,0) from status update.");
    }
  }

  // Handle attendance data
  if (data.type === "ATTENDANCE") {
    console.log("\n=== ATTENDANCE LOGGED ===");
    console.log(`Template ID: ${data.id}`);
    console.log(`Latitude: ${data.lat}`);
    console.log(`Longitude: ${data.lon}`);
    console.log(`Altitude: ${data.alt}m`);
    console.log(`GPS Fixed: ${data.gpsFixed ? "✓" : "✗"}`);
    console.log(`GPS Available: ${data.gpsAvailable ? "✓" : "✗"}`);
    console.log(`Satellites: ${data.sats}`);
    console.log("========================\n");

    // Broadcast to all web clients
    // Broadcast to all web clients
    broadcastToWebClients({
      type: "ATTENDANCE",
      data: {
        id: data.id,
        latitude: data.lat,
        longitude: data.lon,
        altitude: data.alt,
        gpsFixed: data.gpsFixed,
        gpsAvailable: data.gpsAvailable,
        satellites: data.sats,
        timestamp: new Date().toISOString(),
      },
    });

    // Update Cache if valid
    if (data.lat && data.lon && (data.lat !== 0 || data.lon !== 0)) {
        lastKnownGPS = {
            lat: data.lat,
            lon: data.lon,
            alt: data.alt,
            gpsFixed: data.gpsFixed
        };
    }
  }

  // Handle enrollment response
  if (data.type === "ENROLL_RESPONSE") {
    console.log(
      `Enrollment ${data.success ? "SUCCESS" : "FAILED"}${
        data.id ? ` - ID: ${data.id}` : ""
      }${data.error ? ` - Error: ${data.error}` : ""}`
    );
    broadcastToWebClients(data);
  }

  // Handle delete response
  if (data.type === "DELETE_RESPONSE") {
    console.log(
      `Delete ${data.success ? "SUCCESS" : "FAILED"} - ID: ${data.id}`
    );
    broadcastToWebClients(data);
  }

  // Handle verify response
  if (data.type === "VERIFY_RESPONSE") {
    console.log(
      `Verify ${data.success ? "SUCCESS" : "FAILED"}${
        data.id ? ` - ID: ${data.id}` : ""
      }`
    );

    // 1. Prepare Base Payload
    let finalPayload = { ...data };

    // 2. Check if Incoming Data has Valid GPS
    // "Valid" means present and not strictly (0,0)
    const hasValidIncomingGPS = 
        data.lat !== undefined && 
        data.lon !== undefined && 
        (data.lat !== 0 || data.lon !== 0);

    if (hasValidIncomingGPS) {
        // Fresh data is good -> Update Cache
        lastKnownGPS = {
            lat: data.lat,
            lon: data.lon,
            alt: data.alt || 0,
            gpsFixed: data.gpsFixed || false
        };
        console.log("Updated Cached GPS from Verification:", lastKnownGPS);
    } else {
        // Fresh data is BAD or MISSING -> Try to use Cache
        // Only use cache if cache itself has valid data
        if (lastKnownGPS.lat && lastKnownGPS.lon) {
            console.log("Using Cached GPS for Verification (Fresh was invalid/missing)");
            finalPayload = {
                ...finalPayload,
                ...lastKnownGPS,
                // Ensure we don't accidentally send stale 0s from data if we are merging
                lat: lastKnownGPS.lat,
                lon: lastKnownGPS.lon,
                alt: lastKnownGPS.alt,
                gpsFixed: lastKnownGPS.gpsFixed
            };
        }
    }

    // 3. Broadcast Final Payload
    broadcastToWebClients(finalPayload);
  }

  // Handle clear all response
  if (data.type === "CLEAR_ALL_RESPONSE") {
    console.log(
      `Clear All ${data.success ? "SUCCESS" : "FAILED"}${
        data.error ? ` - Error: ${data.error}` : ""
      }`
    );
    broadcastToWebClients(data);
  }
}

// Send command to ESP32
function sendToESP32(command) {
  if (!esp32Client || esp32Client.readyState !== WebSocket.OPEN) {
    console.log("⚠ Cannot send command: ESP32 not connected");
    return false;
  }

  esp32Client.send(command);
  return true;
}

// WebSocket server for web clients
wss.on("connection", (ws, req) => {
  const clientIP = req.socket.remoteAddress;
  console.log(`Web client connected from ${clientIP}`);
  clients.webClients.add(ws);
  console.log(`Total web clients: ${clients.webClients.size}`);

  // Send current ESP32 connection status
  ws.send(JSON.stringify({
    type: "ESP32_CONNECTION",
    connected: esp32Client && esp32Client.readyState === WebSocket.OPEN,
  }));

  // If ESP32 is connected, request and send status
  if (esp32Client && esp32Client.readyState === WebSocket.OPEN) {
    sendToESP32("GET_STATUS");
    
    // Also send immediately if we have a cache (fast load for UI)
    if (lastKnownGPS.lat) {
        ws.send(JSON.stringify({
            type: "ESP32_STATUS",
            data: {
                type: "STATUS",
                ...lastKnownGPS
            }
        }));
    }
  }

  ws.on("message", (msg) => {
    const messageString = msg.toString();
    handleWebClientCommand(messageString);
  });

  ws.on("close", () => {
    clients.webClients.delete(ws);
    console.log(`Web client disconnected (Remaining: ${clients.webClients.size})`);
  });

  ws.on("error", (error) => {
    console.error(`Web client error:`, error.message);
  });
});

// Handle commands from web clients
function handleWebClientCommand(message) {
  // Try to parse as JSON first (for inter-client communication)
  try {
      if (message.trim().startsWith("{")) {
          const jsonMsg = JSON.parse(message);
          // Rebroadcast attendance-related messages to all clients
          if (jsonMsg.type === "ATTENDANCE" || jsonMsg.type === "SIGNED_OUT" || 
              jsonMsg.type === "SESSION_COMPLETED" || jsonMsg.type === "NO_ACTIVE_SESSION" ||
              jsonMsg.type === "NO_MATCHING_SESSION") {
              console.log(`Broadcasting ${jsonMsg.type}${jsonMsg.studentName ? ` for ${jsonMsg.studentName}` : ''}`);
              broadcastToWebClients(jsonMsg);
              return;
          }
      }
  } catch (e) {
      // Not JSON, continue with legacy commands
  }

  let command = "";

  if (message.startsWith("DELETE_FINGERPRINT:")) {
    const templateId = message.split(":")[1];
    command = `DELETE_FINGERPRINT:${templateId}`;
    console.log(`Sending delete command for ID ${templateId} to ESP32`);
  } else if (message === "CAPTURE_FINGERPRINT") {
    command = "CAPTURE_FINGERPRINT";
    console.log("Sending enrollment command to ESP32");
  } else if (message === "VERIFY_FINGERPRINT") {
    command = "VERIFY_FINGERPRINT";
    console.log("Sending verify command to ESP32");
  } else if (message === "GET_STATUS") {
    command = "GET_STATUS";
    console.log("Requesting status from ESP32");
  } else if (message === "CLEAR_ALL_FINGERPRINTS") {
    command = "CLEAR_ALL_FINGERPRINTS";
    console.log("Sending clear all fingerprints command to ESP32");
  } else {
    console.log(`Unknown command: ${message}`);
    return;
  }

  if (command) {
    const sent = sendToESP32(command);
    if (!sent) {
      // Notify web client that ESP32 is not connected
      broadcastToWebClients({
        type: "ERROR",
        message: "ESP32 not connected",
      });
    }
  }
}

// Broadcast data to all connected web clients
function broadcastToWebClients(data) {
  const message = JSON.stringify(data);
  clients.webClients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\nShutting down server...");
  
  if (esp32Client) {
    esp32Client.close();
  }
  
  wss.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

// Start connection to ESP32
console.log("Server is ready.");
console.log("Web clients can send commands: CAPTURE_FINGERPRINT, VERIFY_FINGERPRINT, DELETE_FINGERPRINT:<id>, GET_STATUS\n");
console.log("Starting connection to ESP32...\n");
connectToESP32();

// Periodically check ESP32 connection and request status
setInterval(() => {
  if (esp32Client && esp32Client.readyState === WebSocket.OPEN) {
    sendToESP32("GET_STATUS");
  } else if (!esp32Client || esp32Client.readyState === WebSocket.CLOSED) {
    // Try to reconnect if not already attempting
    if (reconnectAttempts === 0) {
      connectToESP32();
    }
  }
}, 30000); // Check every 30 seconds