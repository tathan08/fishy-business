export default function LoadingScreen() {
    return (
        <div className="fixed inset-0 bg-gradient-to-b from-blue-900 to-blue-600 flex items-center justify-center">
            <div className="text-center">
                <div className="text-6xl mb-4 animate-bounce">🐟</div>
                <h2 className="text-3xl font-bold text-white mb-4">
                    Diving into the ocean...
                </h2>
                <div className="flex gap-2 justify-center">
                    <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
                    <div className="w-3 h-3 bg-white rounded-full animate-pulse delay-100"></div>
                    <div className="w-3 h-3 bg-white rounded-full animate-pulse delay-200"></div>
                </div>
            </div>
        </div>
    );
}
