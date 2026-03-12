export const SkribblStarDecorations = () => {
    return (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {/* Simulation of stars or background patterns Dofus Theme */}
            <div className="absolute w-2 h-2 bg-blue-300 rounded-full top-10 left-10 opacity-20 blur-[1px]" />
            <div className="absolute w-3 h-3 bg-indigo-200 rounded-full top-40 right-20 opacity-30 shadow-[0_0_10px_white]" />
            <div className="absolute w-1 h-1 bg-white rounded-full bottom-20 left-1/3 opacity-10" />
            <div className="absolute w-4 h-4 bg-purple-400 rounded-full top-1/4 left-1/4 opacity-10 blur-[2px]" />
            <div className="absolute w-2 h-2 bg-blue-100 rounded-full bottom-1/3 right-1/4 opacity-20" />
        </div>
    );
};
