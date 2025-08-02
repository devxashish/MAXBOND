// src/components/ThemeSwitcher.js
import React, { useState } from 'react'; // Added useState for local management of opened state
import { useTheme } from '../contexts/ThemeContext';
import './ThemeSwitcher.css';

const ThemeSwitcher = () => {
    const { theme, setTheme, availableThemes } = useTheme();
    const [isOpen, setIsOpen] = useState(false); // State to manage visibility of theme buttons

    const handleThemeChange = (themeId) => {
        setTheme(themeId);
        setIsOpen(false); // Close the switcher after selecting a theme
    };

    // Function to get emoji based on theme ID
    const getThemeEmoji = (themeId) => {
        switch (themeId) {
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

    // Get the current theme's name and emoji for the main button display
    const currentThemeInfo = availableThemes.find(t => t.id === theme);
    const activeThemeDisplayName = currentThemeInfo ? currentThemeInfo.name : 'Select Theme';
    const activeThemeDisplayEmoji = currentThemeInfo ? getThemeEmoji(currentThemeInfo.id) : '🎨';


    return (
        <div className={`theme-switcher-container ${isOpen ? 'open' : ''}`}>
            <button className="theme-switcher-main-button" onClick={() => setIsOpen(!isOpen)} aria-label="Toggle Theme Selector">
                {activeThemeDisplayEmoji} {activeThemeDisplayName}
            </button>
            <div className="theme-buttons-wrapper">
                {availableThemes.map((t) => (
                    <button
                        key={t.id}
                        className={`theme-button ${theme === t.id ? 'active' : ''}`}
                        onClick={() => handleThemeChange(t.id)}
                        title={`Switch to ${t.name}`}
                        aria-pressed={theme === t.id}
                    >
                        {getThemeEmoji(t.id)}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default ThemeSwitcher;