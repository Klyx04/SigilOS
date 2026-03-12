"use client";

import { io, Socket } from "socket.io-client";

/**
 * Centrally managed WebSocket URL builder
 * Handles local dev (port 3001) and production (same host as app, port 443 via Caddy)
 */
export function buildWsUrl(): string {
    if (typeof window === "undefined") return "";
    
    const proto = window.location.protocol;
    const host = window.location.hostname;
    
    // Check if an explicit environment variable is set
    const env = process.env.NEXT_PUBLIC_WS_URL;
    if (env && env !== "undefined" && env !== "") return env;
    
    // Automatic detection
    const isLocal = host === "localhost" || host === "127.0.0.1" || host.startsWith("192.168.");
    
    if (isLocal) {
        // In local development, the standalone WS server listens on 3001
        return `${proto}//${host}:3001`;
    }
    
    // In production (beta.sigilos.fr), port 3001 is NOT exposed.
    // Caddy handles the reverse proxy of /socket.io/* to the WS server.
    // So we use the standard app URL (proto + host).
    return `${proto}//${host}`;
}

/**
 * Default options for Socket.IO clients to stay consistent across modules
 */
export const DEFAULT_SOCKET_OPTIONS = {
    path: "/socket.io/", // Standard path for Caddy and Standalone server
    transports: ["websocket", "polling"],
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
};

/**
 * Helper to get a pre-configured socket instance
 */
export function getSocket(query?: Record<string, string>): Socket {
    return io(buildWsUrl(), {
        ...DEFAULT_SOCKET_OPTIONS,
        query
    });
}
