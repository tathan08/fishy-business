'use client';

import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-900 to-blue-600 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-white mb-4 animate-pulse">
          🐟 Fishy Business
        </h1>
        <p className="text-xl text-blue-100 mb-8">
          Eat or be eaten in the ocean
        </p>
        <Link
          href="/join"
          className="inline-block bg-yellow-400 hover:bg-yellow-500 text-blue-900 font-bold text-2xl px-12 py-4 rounded-full shadow-lg transition-all transform hover:scale-105"
        >
          PLAY
        </Link>
      </div>
    </div>
  );
}
