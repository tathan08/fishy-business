'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

type FishModel = 'swordfish' | 'blobfish' | 'pufferfish' | 'shark' | 'sacabambaspis';

const fishModels: { id: FishModel; name: string; emoji: string }[] = [
    { id: 'swordfish', name: 'Swordfish', emoji: '🗡️🐟' },
    { id: 'blobfish', name: 'Blobfish', emoji: '🫧🐟' },
    { id: 'pufferfish', name: 'Pufferfish', emoji: '🐡' },
    { id: 'shark', name: 'Shark', emoji: '🦈' },
    { id: 'sacabambaspis', name: 'Sacabambaspis', emoji: '🐠' },
];

export default function JoinPage() {
    const [username, setUsername] = useState('');
    const [selectedFish, setSelectedFish] = useState<FishModel>('swordfish');
    const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
    const router = useRouter();

    const handleJoin = () => {
        if (username.trim()) {
            // Store username and fish model for later use
            sessionStorage.setItem('username', username.trim());
            sessionStorage.setItem('fishModel', selectedFish);
            // Navigate to game page
            router.push('/game');
        }
    };

    const handleImageError = (fishId: string) => {
        setImageErrors(prev => ({ ...prev, [fishId]: true }));
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-blue-900 to-blue-600 flex items-center justify-center p-4">
            <div className="bg-white/10 backdrop-blur-md p-10 rounded-2xl shadow-2xl border border-white/20 max-w-2xl w-full">
                <h2 className="text-4xl font-bold text-white mb-2 text-center">
                    🐟 Choose Your Fish
                </h2>
                <p className="text-white/80 text-center mb-8">Pick your species and name</p>
                
                {/* Fish Model Selection */}
                <div className="mb-8">
                    <label className="text-white font-semibold mb-3 block text-center">
                        Select Your Fish Species
                    </label>
                    <div className="grid grid-cols-5 gap-3">
                        {fishModels.map((fish) => (
                            <button
                                key={fish.id}
                                onClick={() => setSelectedFish(fish.id)}
                                className={`
                                    flex flex-col items-center justify-center p-4 rounded-xl
                                    transition-all transform hover:scale-105
                                    ${selectedFish === fish.id
                                        ? 'bg-yellow-400 ring-4 ring-yellow-300 shadow-lg'
                                        : 'bg-white/20 hover:bg-white/30'
                                    }
                                `}
                            >
                                {!imageErrors[fish.id] ? (
                                    <div className="relative w-16 h-16 mb-2">
                                        <Image
                                            src={`/fish-models/${fish.id}.png`}
                                            alt={fish.name}
                                            fill
                                            className="object-contain"
                                            onError={() => handleImageError(fish.id)}
                                        />
                                    </div>
                                ) : (
                                    <div className="text-4xl mb-2">{fish.emoji}</div>
                                )}
                                <div className={`text-xs font-medium text-center ${
                                    selectedFish === fish.id ? 'text-blue-900' : 'text-white'
                                }`}>
                                    {fish.name}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Username Input */}
                <div className="mb-6">
                    <label className="text-white font-semibold mb-2 block text-center">
                        Enter Your Name
                    </label>
                    <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleJoin()}
                        placeholder="Your fish name..."
                        maxLength={15}
                        className="w-full px-4 py-3 text-lg rounded-lg focus:outline-none focus:ring-4 focus:ring-yellow-400 text-gray-800"
                        autoFocus
                    />
                </div>

                <button
                    onClick={handleJoin}
                    disabled={!username.trim()}
                    className="w-full bg-yellow-400 hover:bg-yellow-500 disabled:bg-gray-400 disabled:cursor-not-allowed text-blue-900 font-bold text-xl px-8 py-3 rounded-lg transition-all transform hover:scale-105 disabled:transform-none"
                >
                    DIVE IN 🌊
                </button>
            </div>
        </div>
    );
}
