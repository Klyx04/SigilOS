import Image from "next/image";
import { DOFUS_CLASSES } from "@/lib/dofus-assets";
import { cn } from "@/lib/utils";

interface ClassIconProps {
    classId: string;
    className?: string;
    size?: number;
    showName?: boolean;
}

export function ClassIcon({ classId, className, size = 24, showName = false }: ClassIconProps) {
    // Normalize ID (handle "Cra" vs "cra")
    const normalizedId = classId?.toLowerCase() || "";
    const dofusClass = DOFUS_CLASSES.find(c => c.id === normalizedId || c.name.toLowerCase() === normalizedId);

    if (!dofusClass) return null;

    return (
        <div className={cn("flex items-center gap-2", className)}>
            <div className={cn("relative shrink-0 select-none", className)} style={{ width: size, height: size }}>
                <Image
                    src={dofusClass.icon}
                    alt={dofusClass.name}
                    fill
                    className="object-contain"
                    sizes={`${size}px`}
                />
            </div>
            {showName && <span className="font-medium">{dofusClass.name}</span>}
        </div>
    );
}

export function getClassColor(classId: string): string {
    const dofusClass = DOFUS_CLASSES.find(c => c.id === classId.toLowerCase() || c.name.toLowerCase() === classId.toLowerCase());
    return dofusClass ? dofusClass.color : "#ffffff";
}
