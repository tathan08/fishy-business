import { FishProfile } from '@/lib/generateFishProfile';

interface FishProfileDisplayProps {
    profile: FishProfile;
}

export function FishProfileDisplay({ profile }: FishProfileDisplayProps) {
    return (
        <div className="fixed top-4 left-4 bg-black/80 backdrop-blur-sm rounded-lg p-4 max-w-xs text-white font-mono text-xs z-50 border border-gray-700 shadow-lg">
            <div className="space-y-1">
                <div className="mb-2 border-b border-gray-600 pb-2">
                    <span className="text-yellow-400 font-bold">name:</span> <span className="text-white">{profile.name}</span>
                </div>
                <div>
                    <span className="text-blue-400">scientificName:</span> <span className="text-gray-200">{profile.scientificName}</span>
                </div>
                <div>
                    <span className="text-purple-400">type:</span> <span className="text-gray-200">{profile.type}</span>
                </div>
                <div>
                    <span className="text-green-400">abilities:</span> <span className="text-gray-200">{profile.abilities.join(', ')}</span>
                </div>
                <div>
                    <span className="text-orange-400">diet:</span> <span className="text-gray-200">{profile.diet}</span>
                </div>
                <div>
                    <span className="text-pink-400">experience:</span> <span className="text-gray-200">{profile.experience}</span>
                </div>
                <div>
                    <span className="text-cyan-400">attitude:</span> <span className="text-gray-200">{profile.attitude}</span>
                </div>
                <div>
                    <span className="text-red-400">wifiConnectivity:</span> <span className="text-gray-200">{profile.wifiConnectivity}</span>
                </div>
                <div>
                    <span className="text-yellow-300">legalStatus:</span> <span className="text-gray-200">{profile.legalStatus}</span>
                </div>
                <div>
                    <span className="text-indigo-400">pathfindingIQ:</span> <span className="text-gray-200">{profile.pathfindingIQ}</span>
                </div>
                <div>
                    <span className="text-emerald-400">plotArmor:</span> <span className="text-gray-200">{profile.plotArmor}</span>
                </div>
                <div>
                    <span className="text-rose-400">vibeToday:</span> <span className="text-gray-200">{profile.vibeToday}</span>
                </div>
            </div>
        </div>
    );
}
