"use client";

import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";

interface BreadcrumbItem {
    label: string;
    href: string;
}

export function DocBreadcrumbs({ items }: { items: BreadcrumbItem[] }) {
    return (
        <nav className="flex items-center gap-2 text-xs font-medium text-zinc-500 mb-6 group/breadcrumbs">
            <Link
                href="/docs"
                className="hover:text-white transition-colors flex items-center gap-1"
            >
                <Home className="w-3 h-3" />
                Docs
            </Link>

            {items.map((item, index) => (
                <div key={item.href} className="flex items-center gap-2">
                    <ChevronRight className="w-3 h-3 text-zinc-700" />
                    <Link
                        href={item.href}
                        className={index === items.length - 1
                            ? "text-zinc-300 pointer-events-none"
                            : "hover:text-white transition-colors"
                        }
                    >
                        {item.label}
                    </Link>
                </div>
            ))}
        </nav>
    );
}
