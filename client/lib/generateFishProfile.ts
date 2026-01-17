import { ATTRIBUTE_POOLS } from './fishAttributePools';

export interface FishProfile {
    name: string;
    scientificName: string;
    type: string;
    abilities: string[];
    diet: string;
    experience: string;
    attitude: string;
    wifiConnectivity: string;
    legalStatus: string;
    pathfindingIQ: string;
    plotArmor: string;
    vibeToday: string;
}

function randomChoice<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
}

function generateFishProfile(userName: string): FishProfile {
    return {
        name: userName,
        scientificName: randomChoice(ATTRIBUTE_POOLS.scientificNames),
        type: randomChoice(ATTRIBUTE_POOLS.types),
        abilities: randomChoice(ATTRIBUTE_POOLS.abilities),
        diet: randomChoice(ATTRIBUTE_POOLS.diets),
        experience: randomChoice(ATTRIBUTE_POOLS.experiences),
        attitude: randomChoice(ATTRIBUTE_POOLS.attitudes),
        wifiConnectivity: randomChoice(ATTRIBUTE_POOLS.wifiConnectivity),
        legalStatus: randomChoice(ATTRIBUTE_POOLS.legalStatus),
        pathfindingIQ: randomChoice(ATTRIBUTE_POOLS.pathfindingIQ),
        plotArmor: randomChoice(ATTRIBUTE_POOLS.plotArmor),
        vibeToday: randomChoice(ATTRIBUTE_POOLS.vibeToday),
    };
}

/**
 * Generate a fresh new profile every time (regenerates on each join/refresh)
 */
export function getOrCreateFishProfile(userName: string): FishProfile {
    // Always generate a NEW profile (random attributes every time!)
    const newProfile = generateFishProfile(userName);
    // Store in sessionStorage so it persists during game session but not between refreshes
    sessionStorage.setItem('fishProfile', JSON.stringify(newProfile));
    return newProfile;
}

/**
 * Force regenerate profile (for "reroll" button)
 */
export function regenerateFishProfile(userName: string): FishProfile {
    const newProfile = generateFishProfile(userName);
    sessionStorage.setItem('fishProfile', JSON.stringify(newProfile));
    return newProfile;
}

/**
 * Get current profile from sessionStorage (only persists during game session)
 */
export function getFishProfile(): FishProfile | null {
    const stored = sessionStorage.getItem('fishProfile');
    if (stored) {
        try {
            return JSON.parse(stored);
        } catch (e) {
            console.error('Failed to parse fish profile:', e);
            return null;
        }
    }
    return null;
}
