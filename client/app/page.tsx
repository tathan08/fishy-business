'use client';

import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-900 to-blue-600 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-white mb-4 animate-pulse flex items-center justify-center gap-4">
          <img src="/fish-models/sacabambaspis.png" alt="Fish" className="h-48 w-[21rem] object-contain" />
          Fishy Business
        </h1>
        <p className="text-xl text-blue-100 mb-8">
          Eat or be eaten in the ocean
        </p>
        <div className="space-y-4">
          <Link
            href="/join"
            className="block bg-yellow-400 hover:bg-yellow-500 text-blue-900 font-bold text-2xl px-12 py-4 rounded-full shadow-lg transition-all transform hover:scale-105"
          >
            PLAY BATTLE
          </Link>
          <Link
            href="/racing"
            className="block bg-green-400 hover:bg-green-500 text-blue-900 font-bold text-2xl px-12 py-4 rounded-full shadow-lg transition-all transform hover:scale-105"
          >
            🏁 FISH RACING
          </Link>
        </div>
      </div>
    </div>
  );
}
