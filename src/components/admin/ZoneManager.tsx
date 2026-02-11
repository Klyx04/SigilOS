"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
    getAdminZones,
    createZone,
    updateZone,
    deleteZone,
} from "@/server/actions/game-data-admin-actions";
import { MapPin, Trash2, Edit2, X, Check, Plus } from "lucide-react";

interface Zone {
    id: string;
    name: string;
    level: number;
}

export default function ZoneManager() {
    const [zones, setZones] = useState<Zone[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        level: 200,
    });

    useEffect(() => {
        loadZones();
    }, []);

    async function loadZones() {
        setLoading(true);
        const result = await getAdminZones();
        if (result.success && result.data) {
            setZones(result.data);
        }
        setLoading(false);
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        const result = editing
            ? await updateZone(editing, formData)
            : await createZone(formData);

        if (result.success) {
            toast.success(editing ? "Zone mise à jour" : "Zone créée");
            resetForm();
            loadZones();
        } else {
            toast.error(result.error || "Erreur");
        }
    }

    async function handleDelete(id: string) {
        if (!confirm("Supprimer cette zone ?")) return;
        const result = await deleteZone(id);
        if (result.success) {
            toast.success("Zone supprimée");
            loadZones();
        }
    }

    function resetForm() {
        setFormData({ name: "", level: 200 });
        setEditing(null);
        setShowForm(false);
    }

    function startEdit(zone: Zone) {
        setEditing(zone.id);
        setFormData({
            name: zone.name,
            level: zone.level,
        });
        setShowForm(true);
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-green-400" />
                    <h3 className="text-lg font-bold text-white">Zones</h3>
                    <span className="text-xs bg-slate-700 px-2 py-0.5 rounded-full text-slate-300">
                        {zones.length}
                    </span>
                </div>
                {!showForm && (
                    <Button
                        onClick={() => setShowForm(true)}
                        size="sm"
                        className="bg-indigo-600 hover:bg-indigo-700"
                    >
                        <Plus className="w-4 h-4 mr-1" />
                        Nouvelle
                    </Button>
                )}
            </div>

            {/* Compact Form */}
            {showForm && (
                <form onSubmit={handleSubmit} className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-bold text-white">
                            {editing ? "Modifier" : "Nouvelle"} Zone
                        </h4>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={resetForm}
                            className="h-6 w-6 p-0"
                        >
                            <X className="w-4 h-4" />
                        </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Nom</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                required
                                className="w-full px-3 py-1.5 text-sm bg-slate-900 border border-slate-600 rounded text-white focus:ring-1 focus:ring-indigo-500 outline-none"
                                placeholder="Pandala"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Niveau</label>
                            <input
                                type="number"
                                value={formData.level}
                                onChange={(e) => setFormData({ ...formData, level: parseInt(e.target.value) })}
                                required
                                min={1}
                                max={200}
                                className="w-full px-3 py-1.5 text-sm bg-slate-900 border border-slate-600 rounded text-white focus:ring-1 focus:ring-indigo-500 outline-none"
                            />
                        </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                        <Button type="submit" size="sm" className="bg-indigo-600 hover:bg-indigo-700 flex-1">
                            <Check className="w-4 h-4 mr-1" />
                            {editing ? "Mettre à jour" : "Créer"}
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={resetForm}>
                            Annuler
                        </Button>
                    </div>
                </form>
            )}

            {/* Compact List */}
            <div className="bg-slate-800/30 border border-slate-700/30 rounded-lg overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-slate-400">Chargement...</div>
                ) : zones.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">Aucune zone</div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 p-3">
                        {zones.map((zone) => (
                            <div key={zone.id} className="flex items-center justify-between p-2 bg-slate-900/40 border border-slate-800 rounded hover:border-slate-600 transition-all group">
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-semibold text-white text-sm truncate">{zone.name}</h4>
                                    <p className="text-xs text-slate-400">Niv. {zone.level}</p>
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => startEdit(zone)}
                                        className="h-6 w-6 p-0 hover:bg-indigo-600/20"
                                    >
                                        <Edit2 className="w-3 h-3 text-indigo-400" />
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleDelete(zone.id)}
                                        className="h-6 w-6 p-0 hover:bg-red-600/20"
                                    >
                                        <Trash2 className="w-3 h-3 text-red-400" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
