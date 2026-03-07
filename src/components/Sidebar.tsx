import { NavLink } from "react-router-dom";
import { Files, Scissors, Shrink, Home, PenLine } from "lucide-react";
import { cn } from "../lib/utils";

export function Sidebar() {
    const navItems = [
        { to: "/", icon: Home, label: "Home" },
        { to: "/merge", icon: Files, label: "Merge PDF" },
        { to: "/extract", icon: Scissors, label: "Extract Pages" },
        { to: "/compress", icon: Shrink, label: "Compress PDF" },
        { to: "/edit", icon: PenLine, label: "Edit PDF" },
    ];

    return (
        <div className="w-64 h-screen bg-card text-card-foreground border-r border-border p-4 flex flex-col">
            <div className="flex items-center gap-3 mb-8 px-4">
                <img src="./logo.png?v=transp" alt="PDF Creator Logo" className="w-10 h-10 object-contain" />
                <h1 className="text-2xl font-bold">
                    <span className="text-primary">PDF</span> Creator
                </h1>
            </div>
            <nav className="space-y-2 flex-1">
                {navItems.map((item) => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        className={({ isActive }) =>
                            cn(
                                "flex items-center gap-3 px-4 py-3 rounded-md transition-colors",
                                isActive
                                    ? "bg-primary text-primary-foreground"
                                    : "hover:bg-muted text-muted-foreground hover:text-foreground"
                            )
                        }
                    >
                        <item.icon className="w-5 h-5" />
                        <span className="font-medium">{item.label}</span>
                    </NavLink>
                ))}
            </nav>
            <div className="text-xs text-muted-foreground p-4 text-center">
                v0.2.0
            </div>
        </div>
    );
}
