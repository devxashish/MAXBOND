import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';

export const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
    const availableThemes = [
        { id: 'demon-slayer', name: 'Demon Slayer' }, // NEW: Demon Slayer Theme
        { id: 'neon-dark', name: 'Neon Dark' },
        { id: 'cyber-red', name: 'Cyber Red' },
        { id: 'ocean-glare', name: 'Ocean Glare' },
        { id: 'emerald-flow', name: 'Emerald Flow' },
        { id: 'violet-dream', name: 'Violet Dream' },
        { id: 'golden-sunset', name: 'Golden Sunset' },
        { id: 'arctic-frost', name: 'Arctic Frost' },
        { id: 'lava-burst', name: 'Lava Burst' },
        { id: 'forest-spirit', name: 'Forest Spirit' },
        { id: 'starlight-shimmer', name: 'Starlight Shimmer' },
        { id: 'blossom-pink', name: 'Blossom Pink' },
        { id: 'autumn-gold', name: 'Autumn Gold' },
    ];

    const [theme, setTheme] = useState(() => {
        // Set 'demon-slayer' as the DEFAULT theme
        return localStorage.getItem('appTheme') || 'demon-slayer';
    });

    // Function to create and manage animation elements
    const manageAnimationElements = useCallback((currentThemeId) => {
        // 1. Clean up existing animation elements
        let animationContainer = document.getElementById('theme-animation-container');
        if (animationContainer) {
            animationContainer.remove();
        }

        // Create a new container for the current theme's animation
        animationContainer = document.createElement('div');
        animationContainer.id = 'theme-animation-container';
        document.body.appendChild(animationContainer);

        // 2. Add elements based on the current theme
        let elementsToInject = 0;
        let elementClassName = '';
        let elementTextContent = ''; // For emoji/character animations

        switch (currentThemeId) {
            case 'demon-slayer': // NEW: Demon Slayer Animation Elements
                elementsToInject = 25; // Number of flame/breath particles
                elementClassName = 'ds-flame-particle';
                // elementTextContent = '🔥'; // Could use emoji or leave as solid color/shape
                break;
            case 'neon-dark':
                elementsToInject = 20; // Glowing particles
                elementClassName = 'neon-particle';
                break;
            case 'cyber-red':
                elementsToInject = 10; // Digital lines
                elementClassName = 'cyber-line';
                break;
            case 'ocean-glare':
                elementsToInject = 10; // Bubbles
                elementClassName = 'ocean-bubble';
                elementTextContent = '💧';
                break;
            case 'emerald-flow':
                elementsToInject = 15; // Floating leaves
                elementClassName = 'emerald-leaf';
                elementTextContent = '🍃';
                break;
            case 'violet-dream':
                elementsToInject = 30; // Cosmic dust
                elementClassName = 'violet-dust';
                break;
            case 'golden-sunset':
                elementsToInject = 10; // Light rays
                elementClassName = 'golden-ray';
                break;
            case 'arctic-frost':
                elementsToInject = 25; // Snowflakes
                elementClassName = 'arctic-snowflake';
                elementTextContent = '❄️';
                break;
            case 'lava-burst':
                elementsToInject = 12; // Molten embers
                elementClassName = 'lava-ember';
                break;
            case 'forest-spirit':
                elementsToInject = 18; // Fireflies
                elementClassName = 'forest-firefly';
                break;
            case 'starlight-shimmer':
                elementsToInject = 20; // Twinkling stars
                elementClassName = 'starlight-star';
                elementTextContent = '⭐';
                break;
            case 'blossom-pink':
                elementsToInject = 20; // Falling petals
                elementClassName = 'blossom-petal';
                elementTextContent = '🌸';
                break;
            case 'autumn-gold':
                elementsToInject = 15; // Swirling autumn leaves
                elementClassName = 'autumn-leaf';
                elementTextContent = '🍂';
                break;
            default:
                elementsToInject = 0; // No animation for unknown themes
                break;
        }

        for (let i = 0; i < elementsToInject; i++) {
            const el = document.createElement('div');
            el.className = `theme-animation-element ${elementClassName}`;
            if (elementTextContent) {
                el.textContent = elementTextContent;
            }
            // Apply random initial styles
            el.style.left = `${Math.random() * 100}vw`;
            el.style.top = `${Math.random() * 100}vh`; // For some, starting position might be randomized
            el.style.animationDelay = `${Math.random() * 10}s`; // Randomize start time
            el.style.animationDuration = `${10 + Math.random() * 10}s`; // Randomize duration
            el.style.opacity = `${0.3 + Math.random() * 0.7}`; // Randomize initial opacity
            el.style.transform = `scale(${0.5 + Math.random() * 1.0})`; // Randomize size

            // For horizontal drift variation in 'fall' type animations
            if (['blossom-pink', 'autumn-gold', 'arctic-frost', 'emerald-flow', 'ocean-glare', 'demon-slayer'].includes(currentThemeId)) { // Added demon-slayer here
                el.style.setProperty('--rand-x-offset', (Math.random() * 20 - 10).toFixed(2)); // -10 to 10 for horizontal drift
            }

            animationContainer.appendChild(el);
        }
    }, []); // Empty dependency array means this function is created once

    useEffect(() => {
        // Remove all previous theme classes
        availableThemes.forEach(t => document.body.classList.remove(t.id));
        // Add the current theme class
        document.body.classList.add(theme);
        localStorage.setItem('appTheme', theme);

        // Manage animation elements whenever the theme changes
        manageAnimationElements(theme);

        // Cleanup on unmount (e.g., if ThemeProvider is ever unmounted)
        return () => {
            const animationContainer = document.getElementById('theme-animation-container');
            if (animationContainer) {
                animationContainer.remove();
            }
        };
    }, [theme, availableThemes, manageAnimationElements]);

    // Function to get emoji based on theme ID (from ThemeSwitcher.js, duplicated here for context)
    const getThemeEmoji = (themeId) => {
        switch (themeId) {
            case 'demon-slayer': return '👺'; // NEW: Demon Slayer emoji
            case 'neon-dark': return '🌑';
            case 'cyber-red': return '🔥';
            case 'ocean-glare': return '🌊';
            case 'emerald-flow': return '🌳';
            case 'violet-dream': return '🔮';
            case 'golden-sunset': return '🌅';
            case 'arctic-frost': return '❄️';
            case 'lava-burst': return '🌋';
            case 'forest-spirit': return '🍃';
            case 'starlight-shimmer': return '✨';
            case 'blossom-pink': return '🌸';
            case 'autumn-gold': return '🍂';
            default: return '🎨';
        }
    };


    const contextValue = {
        theme,
        setTheme: useCallback((newTheme) => {
            if (availableThemes.some(t => t.id === newTheme)) {
                setTheme(newTheme);
            } else {
                console.warn(`Attempted to set unknown theme: ${newTheme}`);
            }
        }, [availableThemes]),
        availableThemes,
        getThemeEmoji, // Export this if ThemeSwitcher needs it directly
    };

    return (
        <ThemeContext.Provider value={contextValue}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};