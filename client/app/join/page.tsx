'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function JoinPage() {
    const [username, setUsername] = useState('');
    const router = useRouter();

    const handleJoin = () => {
        if (username.trim()) {
            // Store username for later use
            sessionStorage.setItem('username', username.trim());
            // Navigate to game page
            router.push('/game');
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-blue-900 to-blue-600 flex items-center justify-center">
            <div className="bg-white/10 backdrop-blur-md p-10 rounded-2xl shadow-2xl border border-white/20">
                <h2 className="text-4xl font-bold text-white mb-6 text-center">
                    Choose Your Fish Name
                </h2>
                <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleJoin()}
                    placeholder="Enter your name..."
                    maxLength={15}
                    className="w-80 px-4 py-3 text-lg rounded-lg mb-6 focus:outline-none focus:ring-4 focus:ring-yellow-400 text-gray-800"
                    autoFocus
                />
                <button
                    onClick={handleJoin}
                    disabled={!username.trim()}
                    className="w-full bg-yellow-400 hover:bg-yellow-500 disabled:bg-gray-400 disabled:cursor-not-allowed text-blue-900 font-bold text-xl px-8 py-3 rounded-lg transition-all transform hover:scale-105 disabled:transform-none"
                >
                    JOIN GAME
                </button>
            </div>
        </div>
    );
}
