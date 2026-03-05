"use client";

import { useEffect, useState, useMemo } from "react";
import { MapContainer, Rectangle, Tooltip, useMapEvents, ImageOverlay } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// TYPES
export type WorldMapData = {
    areas: { id: number; name: string }[];
    subareas: { id: number; areaId: number; name: string; level: number }[];
    maps: { id: number; x: number; y: number; subAreaId: number; worldMap: number; outdoor: boolean }[];
};

interface InteractiveMapProps {
    data: WorldMapData;
}

// Helper component to track map viewport bounds
function MapBoundsTracker({ setBounds, setZoom }: { setBounds: (b: L.LatLngBounds) => void, setZoom: (z: number) => void }) {
    const map = useMapEvents({
        moveend: () => {
            setBounds(map.getBounds());
            setZoom(map.getZoom());
        },
        zoomend: () => {
            setBounds(map.getBounds());
            setZoom(map.getZoom());
        }
    });

    useEffect(() => {
        setBounds(map.getBounds());
        setZoom(map.getZoom());
    }, [map, setBounds, setZoom]);

    return null;
}

export default function InteractiveMap({ data }: InteractiveMapProps) {
    const [bounds, setBounds] = useState<L.LatLngBounds | null>(null);
    const [zoom, setZoom] = useState(0);

    // Filter maps that are currently in the viewport to avoid crashing React/Leaflet with 15k rendered nodes
    const visibleMaps = useMemo(() => {
        if (!bounds) return [];
        // Extract Dofus X/Y from bounds (remember lat = -y, lng = x)
        const minX = bounds.getWest() - 1;
        const maxX = bounds.getEast() + 1;
        const minY = -bounds.getNorth() - 1; // getNorth is max lat -> corresponds to min Y
        const maxY = -bounds.getSouth() + 1; // getSouth is min lat -> corresponds to max Y

        return data.maps.filter(m =>
            // Optional: filter out specific maps or dimensions? worldMap === 1 for main world usually
            m.x >= minX && m.x <= maxX && m.y >= minY && m.y <= maxY
        );
    }, [data.maps, bounds]);

    // SubArea Map for quick lookup
    const subareaMap = useMemo(() => {
        const m = new Map();
        data.subareas.forEach(sa => {
            const area = data.areas.find(a => a.id === sa.areaId);
            m.set(sa.id, { ...sa, areaName: area?.name || 'Inconnu' });
        });
        return m;
    }, [data.areas, data.subareas]);

    // When zoomed in significantly, try to show the DofusDB map image
    const showImages = zoom >= 3;

    return (
        <div className="relative w-full h-[70vh] rounded-xl overflow-hidden shadow-2xl border border-white/10">
            <MapContainer
                crs={L.CRS.Simple}
                center={[19, 4]} // Astrub [lat=-(-19)=19, lng=4] or close to it
                zoom={1}
                minZoom={-2}
                maxZoom={5}
                className="w-full h-full bg-[#111111]"
                preferCanvas={true}
            >
                <MapBoundsTracker setBounds={setBounds} setZoom={setZoom} />

                {/* Generate Rectangles or Images for visible maps */}
                {visibleMaps.map((mapPoint) => {
                    const lat = -mapPoint.y;
                    const lng = mapPoint.x;
                    const mapBounds: [number, number][] = [
                        [lat - 0.5, lng - 0.5], // SouthWest
                        [lat + 0.5, lng + 0.5]  // NorthEast
                    ];

                    const subarea = subareaMap.get(mapPoint.subAreaId);

                    // Simple interactive layer
                    if (!showImages) {
                        return (
                            <Rectangle
                                key={mapPoint.id}
                                bounds={mapBounds}
                                pathOptions={{
                                    color: '#14b8a6', // Teal 500
                                    weight: 1,
                                    fillColor: '#14b8a6',
                                    fillOpacity: 0.1
                                }}
                            >
                                <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                                    <div className="text-center font-sans">
                                        <p className="font-bold">{subarea?.name || 'Zone Inconnue'}</p>
                                        <p className="text-xs text-gray-500">{subarea?.areaName}</p>
                                        <p className="text-xs mt-1">[{mapPoint.x}, {mapPoint.y}]</p>
                                        <p className="text-xs text-gray-400">ID: {mapPoint.id}</p>
                                    </div>
                                </Tooltip>
                            </Rectangle>
                        );
                    }

                    // Once zoomed in closely, swap to loading individual map images
                    // The map bounds must correctly cover the cell
                    return (
                        <ImageOverlay
                            key={mapPoint.id}
                            bounds={mapBounds}
                            url={`https://api.dofusdb.fr/img/maps/1/${mapPoint.id}.jpg`}
                            opacity={1}
                        >
                            <Tooltip direction="top" opacity={1}>
                                <div className="text-center font-sans">
                                    <p className="font-bold">{subarea?.name || 'Zone Inconnue'}</p>
                                    <p className="text-xs mt-1">[{mapPoint.x}, {mapPoint.y}]</p>
                                </div>
                            </Tooltip>
                        </ImageOverlay>
                    );
                })}
            </MapContainer>
        </div>
    );
}
