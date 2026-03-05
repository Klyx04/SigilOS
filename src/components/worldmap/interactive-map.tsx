"use client";

import { useEffect, useState, useMemo } from "react";
import { MapContainer, Rectangle, Tooltip, useMapEvents, ImageOverlay, useMap } from "react-leaflet";
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

// Custom native Leaflet Layer manager to bypass React's virtual DOM lag for 8500 polygons
function NativeMapRenderer({ data, subareaMap, zoom, bounds }: { data: WorldMapData, subareaMap: Map<number, any>, zoom: number, bounds: L.LatLngBounds | null }) {
    const map = useMap();
    const [featureLayer, setFeatureLayer] = useState<L.FeatureGroup | null>(null);

    // 1. Draw ALL rects ONCE in a native Canvas mode FeatureGroup
    useEffect(() => {
        if (!data || !data.maps) return;

        console.time("Building Native Canvas Layer");
        const layerGroup = L.featureGroup();

        data.maps.forEach(m => {
            if (m.worldMap !== 1 || !m.outdoor) return;

            const lat = -m.y;
            const lng = m.x;
            const subarea = subareaMap.get(m.subAreaId);
            const color = '#14b8a6'; // Teal 500

            const rect = L.rectangle([
                [lat - 0.5, lng - 0.5],
                [lat + 0.5, lng + 0.5]
            ], {
                color: color,
                weight: 1,
                fillColor: color,
                fillOpacity: 0.1,
                interactive: false // Very fast, no hover events yet
            });

            layerGroup.addLayer(rect);
        });

        // Add to map
        layerGroup.addTo(map);
        setFeatureLayer(layerGroup);
        console.timeEnd("Building Native Canvas Layer");

        return () => {
            map.removeLayer(layerGroup);
        };
    }, [map, data.maps, subareaMap]);

    // 2. We only load ImageOverlays dynamically via React when zoomed in (>2)
    // We strictly limit them to the visible viewport to stay at ~50 images max.
    const showImages = zoom >= 3;

    const visibleMaps = useMemo(() => {
        if (!showImages || !bounds) return [];
        const minX = bounds.getWest() - 1;
        const maxX = bounds.getEast() + 1;
        const minY = -bounds.getNorth() - 1;
        const maxY = -bounds.getSouth() + 1;

        return data.maps.filter(m =>
            m.worldMap === 1 && m.outdoor &&
            m.x >= minX && m.x <= maxX && m.y >= minY && m.y <= maxY
        );
    }, [showImages, bounds, data.maps]);

    return (
        <>
            {showImages && visibleMaps.map((mapPoint) => {
                const lat = -mapPoint.y;
                const lng = mapPoint.x;
                const mapBounds: [number, number][] = [
                    [lat - 0.5, lng - 0.5],
                    [lat + 0.5, lng + 0.5]
                ];
                const subarea = subareaMap.get(mapPoint.subAreaId);

                return (
                    <ImageOverlay
                        key={mapPoint.id}
                        bounds={mapBounds}
                        url={`https://api.dofusdb.fr/img/maps/1/${mapPoint.id}.jpg`}
                        interactive={true}
                        opacity={1}
                        zIndex={100}
                    >
                        <Tooltip direction="top" opacity={0.9} sticky={true}>
                            <div className="text-center font-sans tracking-tight">
                                <p className="font-bold text-teal-400">{subarea?.name || 'Zone Inconnue'}</p>
                                <p className="text-[10px] text-gray-500 uppercase">{subarea?.areaName}</p>
                                <p className="text-xs mt-1 text-white">[{mapPoint.x}, {mapPoint.y}]</p>
                            </div>
                        </Tooltip>
                    </ImageOverlay>
                );
            })}
        </>
    );
}

export default function InteractiveMap({ data }: InteractiveMapProps) {
    const [bounds, setBounds] = useState<L.LatLngBounds | null>(null);
    const [zoom, setZoom] = useState(0);

    // SubArea Map for quick lookup
    const subareaMap = useMemo(() => {
        const m = new Map();
        data.subareas.forEach(sa => {
            const area = data.areas.find(a => a.id === sa.areaId);
            m.set(sa.id, { ...sa, areaName: area?.name || 'Inconnu' });
        });
        return m;
    }, [data.areas, data.subareas]);

    return (
        <div className="relative w-full h-[80vh] rounded-xl overflow-hidden shadow-2xl border border-white/10">
            <MapContainer
                crs={L.CRS.Simple}
                center={[19, 4]} // Astrub [lat=-(-19)=19, lng=4] or close to it
                zoom={1}
                minZoom={-2}
                maxZoom={5}
                className="w-full h-full bg-[#111111]"
                preferCanvas={true}
                wheelPxPerZoomLevel={120} // smoother zoom
                zoomAnimation={true}
            >
                <MapBoundsTracker setBounds={setBounds} setZoom={setZoom} />
                <NativeMapRenderer
                    data={data}
                    subareaMap={subareaMap}
                    zoom={zoom}
                    bounds={bounds}
                />
            </MapContainer>
        </div>
    );
}
