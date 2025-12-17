import React, { useState, useEffect, useRef } from "react";
import { BridgeStatus } from "../types";

export default function ServerStatus() {
  const [status, setStatus] = useState<BridgeStatus>({
    esp32Connected: false,
    webClients: 0,
    uptime: 0,
    timestamp: "",
  });
  const [isBridgeOnline, setIsBridgeOnline] = useState(false);
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    const connect = () => {
      ws.current = new WebSocket("ws://localhost:5000");

      ws.current.onopen = () => {
        setIsBridgeOnline(true);
      };

      ws.current.onclose = () => {
        setIsBridgeOnline(false);
        // Try to reconnect after 3 seconds
        setTimeout(connect, 3000);
      };

      ws.current.onerror = () => {
        setIsBridgeOnline(false);
      };

      ws.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === "ESP32_CONNECTION") {
            setStatus((prev) => ({
              ...prev,
              esp32Connected: message.connected,
            }));
          } else if (message.type === "ESP32_STATUS") {
            setStatus((prev) => ({
              ...prev,
              esp32Connected: true,
              esp32Status: message.data,
            }));
          }
        } catch (e) {
          console.error("Failed to parse status message", e);
        }
      };
    };

    connect();

    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, []);

  return (
    <div className="bg-white shadow rounded-lg p-4 mb-6">
      <h2 className="text-lg font-semibold text-gray-700 mb-3">System Status</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Bridge Server Status */}
        <div className="flex flex-col">
          <span className="text-xs text-gray-500 uppercase">Connection Server</span>
          <div className="flex items-center mt-1">
            <span
              className={`w-3 h-3 rounded-full mr-2 ${
                isBridgeOnline ? "bg-green-500" : "bg-red-500"
              }`}
            ></span>
            <span className={`font-medium ${isBridgeOnline ? "text-green-700" : "text-red-700"}`}>
              {isBridgeOnline ? "Online" : "Offline"}
            </span>
          </div>
        </div>

        {/* ESP32 Connection Status */}
        <div className="flex flex-col">
          <span className="text-xs text-gray-500 uppercase">ESP32 Device</span>
          <div className="flex items-center mt-1">
             <span 
                 className={`w-3 h-3 rounded-full mr-2 ${
                     status.esp32Connected ? "bg-green-500" : "bg-gray-400"
                 }`}
             ></span>
             <span className="font-medium text-gray-800">
                 {status.esp32Connected ? "Connected" : "Disconnected"}
             </span>
          </div>
        </div>

        {/* New: Granular Module Status */}
        <div className="flex flex-col">
          <span className="text-xs text-gray-500 uppercase">Modules</span>
          <div className="flex flex-col mt-1 space-y-1">
             <div className="flex items-center text-sm">
                <span className={`w-2 h-2 rounded-full mr-2 ${
                    status.esp32Status?.fingerprint ? "bg-green-500" : "bg-red-400"
                }`}></span>
                <span className="text-gray-600">Fingerprint</span>
             </div>
             <div className="flex items-center text-sm">
                <span className={`w-2 h-2 rounded-full mr-2 ${
                    status.esp32Status?.gps ? "bg-green-500" : "bg-red-400"
                }`}></span>
                <span className="text-gray-600">GPS {status.esp32Status?.gpsFixed ? "(Fixed)" : ""}</span>
             </div>
          </div>
        </div>

        {/* GPS Satellites */}
         <div className="flex flex-col">
           <span className="text-xs text-gray-500 uppercase">Satellites</span>
           <span className="text-lg font-bold text-gray-800">
             {status.esp32Status?.satellites || 0}
           </span>
         </div>
      </div>
    </div>
  );
}
