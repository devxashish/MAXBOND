import React, { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { auth } from "../firebase";
import styles from "./HomePage.module.css";
import PermissionRequestModal from './PermissionRequestModal';

// --- Theme and Media Constants ---
const LIGHT_THEME_KEY = 'light-theme';
const DARK_THEME_KEY = 'dark-theme';
const VIDEO_THEME_DEFAULT_KEY = 'video-theme-default';
const VIDEO_THEME_IMAGE_KEY = 'video-theme-image';
const DEFAULT_VIDEO_BACKGROUND = '/videos/2nd.mp4';

// --- URL Parsing Utility Functions ---
const getYouTubeEmbedUrl = (url) => {
    const regExp = /(?:https?:\/\/)?(?:www\.)?(?:m\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=|embed\/|v\/|)([\w-]{11})(?:\S+)?/;
    const match = url.match(regExp);
    if (match && match[1]) {
        const origin = window.location.origin;
        return `https://www.youtube.com/embed/${match[1]}?autoplay=1&mute=1&loop=1&playlist=${match[1]}&controls=0&showinfo=0&autohide=1&modestbranding=1&enablejsapi=1&origin=${origin}`;
    }
    return null;
};

const isDirectMediaUrl = (url) => {
    const videoExtensions = /\.(mp4|webm|ogg|mov)$/i;
    const imageExtensions = /\.(jpg|jpeg|png|gif|webp|bmp)$/i;
    const cleanUrl = url.split('?')[0].toLowerCase();
    return videoExtensions.test(cleanUrl) || imageExtensions.test(cleanUrl) || cleanUrl.startsWith('data:image/');
};

const isImageUrl = (url) => {
    const imageExtensions = /\.(jpg|jpeg|png|gif|webp|bmp)$/i;
    return imageExtensions.test(url.split('?')[0].toLowerCase()) || url.startsWith('data:image/');
};

const getBackgroundMediaType = (sourceUrl) => {
    if (!sourceUrl) return 'unknown';
    if (sourceUrl.includes('youtube.com/embed')) {
        return 'youtube';
    } else if (sourceUrl.match(/\.(mp4|webm|ogg|mov)$/i)) {
        return 'video';
    } else if (sourceUrl.startsWith('data:image/') || sourceUrl.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/i)) {
        return 'image';
    } else if (sourceUrl.startsWith('https://') || sourceUrl.startsWith('http://')) {
        return 'iframe';
    }
    return 'unknown';
};

const HomePage = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [loadingUser, setLoadingUser] = useState(true);
    const [isMediaLoading, setIsMediaLoading] = useState(false);
    const [showMediaInputModal, setShowMediaInputModal] = useState(false);
    const [showPlayOverlay, setShowPlayOverlay] = useState(false);
    const [showImageUploadModal, setShowImageUploadModal] = useState(false);
    const [showPermissionModal, setShowPermissionModal] = useState(false);
    const [permissionType, setPermissionType] = useState(null);
    const [activeBackgroundMediaUrl, setActiveBackgroundMediaUrl] = useState(() => {
        const defaultAppTheme = localStorage.getItem('defaultAppTheme');
        const customBackground = localStorage.getItem('customBackground');
        if (defaultAppTheme === VIDEO_THEME_IMAGE_KEY && customBackground && isImageUrl(customBackground)) {
            return customBackground;
        } else if (defaultAppTheme === VIDEO_THEME_DEFAULT_KEY) {
            return DEFAULT_VIDEO_BACKGROUND;
        }
        return DEFAULT_VIDEO_BACKGROUND;
    });
    const [currentTheme, setCurrentTheme] = useState(() => {
        const savedDefaultTheme = localStorage.getItem('defaultAppTheme');
        const savedCustomBackgroundOnLoad = localStorage.getItem('customBackground');
        if (
            savedDefaultTheme === DARK_THEME_KEY ||
            savedDefaultTheme === LIGHT_THEME_KEY ||
            savedDefaultTheme === VIDEO_THEME_DEFAULT_KEY
        ) {
            return savedDefaultTheme;
        }
        if (
            savedDefaultTheme === VIDEO_THEME_IMAGE_KEY &&
            savedCustomBackgroundOnLoad &&
            isImageUrl(savedCustomBackgroundOnLoad)
        ) {
            return VIDEO_THEME_IMAGE_KEY;
        }
        return DARK_THEME_KEY;
    });
    const [themeCycleOrder, setThemeCycleOrder] = useState([]);
    const fileInputRef = useRef(null);
    const urlInputRef = useRef(null);
    const mediaRef = useRef(null);
    const defaultVideoPreloader = useRef(null);
    const maxbondTapCount = useRef(0);
    const tapTimer = useRef(null);
    const initialTouchPos = useRef({ x: 0, y: 0 });
    const DOUBLE_TAP_THRESHOLD_MS = 300;
    const DRAG_THRESHOLD = 10;
    const isInitialMount = useRef(true);

    // --- Firebase Authentication ---
    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged((currentUser) => {
            setUser(currentUser);
            setLoadingUser(false);
        });
        return () => unsubscribe();
    }, [navigate]);

    // --- Preload the default video (2nd.mp4) once on component mount ---
    useEffect(() => {
        if (!defaultVideoPreloader.current) {
            defaultVideoPreloader.current = document.createElement('video');
            defaultVideoPreloader.current.src = DEFAULT_VIDEO_BACKGROUND;
            defaultVideoPreloader.current.preload = "auto";
            defaultVideoPreloader.current.muted = true;
            defaultVideoPreloader.current.playsInline = true;
            defaultVideoPreloader.current.loop = true;
            defaultVideoPreloader.current.style.display = 'none';
            document.body.appendChild(defaultVideoPreloader.current);
            defaultVideoPreloader.current.onloadeddata = () => {
                console.log("Default video preloaded successfully!");
            };
            defaultVideoPreloader.current.onerror = (e) => {
                console.error("Default video preload error:", e);
            };
        }
        return () => {
            if (defaultVideoPreloader.current && defaultVideoPreloader.current.parentNode) {
                defaultVideoPreloader.current.parentNode.removeChild(defaultVideoPreloader.current);
            }
        };
    }, []);

    // --- Update Theme Cycle Order dynamically ---
    useEffect(() => {
        let newCycleOrder = [
            DARK_THEME_KEY,
            LIGHT_THEME_KEY,
            VIDEO_THEME_DEFAULT_KEY,
        ];
        const hasSavedCustomImage = localStorage.getItem('customBackground') && isImageUrl(localStorage.getItem('customBackground'));
        if (hasSavedCustomImage && !newCycleOrder.includes(VIDEO_THEME_IMAGE_KEY)) {
            newCycleOrder.push(VIDEO_THEME_IMAGE_KEY);
        }
        setThemeCycleOrder([...new Set(newCycleOrder)].filter(Boolean));
        console.log("Theme Cycle Order:", [...new Set(newCycleOrder)].filter(Boolean));
    }, [activeBackgroundMediaUrl]);

    // --- Theme Application (CSS Class) and Persistence (with prompt) ---
    useEffect(() => {
        const rootElement = document.documentElement;
        ['light-theme', 'dark-theme', 'video-theme', 'demon-slayer', 'neon-dark', 'cyber-red', 'ocean-glare', 'emerald-flow', 'violet-dream', 'golden-sunset', 'arctic-frost', 'lava-burst', 'forest-spirit', 'starlight-shimmer', 'blossom-pink', 'autumn-gold'].forEach(themeClass => {
            rootElement.classList.remove(themeClass);
        });
        const isTransparentTheme = (currentTheme === VIDEO_THEME_DEFAULT_KEY ||
            currentTheme === VIDEO_THEME_IMAGE_KEY ||
            (getBackgroundMediaType(activeBackgroundMediaUrl) === 'video' && ![DARK_THEME_KEY, LIGHT_THEME_KEY].includes(currentTheme)) ||
            getBackgroundMediaType(activeBackgroundMediaUrl) === 'youtube' ||
            getBackgroundMediaType(activeBackgroundMediaUrl) === 'iframe');
        if (isTransparentTheme) {
            rootElement.classList.add('video-theme');
        } else {
            rootElement.classList.add(currentTheme);
        }
        const savedDefaultTheme = localStorage.getItem('defaultAppTheme');
        const lastUsedThemeInStorage = localStorage.getItem('appTheme');
        if (!isInitialMount.current &&
            currentTheme !== lastUsedThemeInStorage &&
            [DARK_THEME_KEY, LIGHT_THEME_KEY, VIDEO_THEME_DEFAULT_KEY, VIDEO_THEME_IMAGE_KEY, 'media-theme-iframe', 'video-theme-url'].includes(currentTheme) &&
            currentTheme !== savedDefaultTheme
        ) {
            const readableCurrentThemeName = currentTheme.replace(/-/g, ' ').replace('Theme', ' Theme').replace('Video', ' Video').replace('Image', ' Image').trim();
            const shouldSetDefault = window.confirm(`Do you want to set "${readableCurrentThemeName}" as your default theme for future visits?`);
            if (shouldSetDefault) {
                localStorage.setItem('defaultAppTheme', currentTheme);
                if (currentTheme === VIDEO_THEME_IMAGE_KEY && isImageUrl(activeBackgroundMediaUrl)) {
                    localStorage.setItem('customBackground', activeBackgroundMediaUrl);
                } else {
                    localStorage.removeItem('customBackground');
                }
                alert(`"${readableCurrentThemeName}" set as default!`);
            } else {
                alert("Theme will not be set as default. It might revert on next load/refresh.");
            }
        }
        localStorage.setItem('appTheme', currentTheme);
        if (isInitialMount.current) {
            isInitialMount.current = false;
        }
    }, [currentTheme, activeBackgroundMediaUrl]);

    // --- Video/Image Loading & Playback Optimization ---
    useEffect(() => {
        const isTransparentThemeCurrentlyActive = (currentTheme === VIDEO_THEME_DEFAULT_KEY ||
            currentTheme === VIDEO_THEME_IMAGE_KEY ||
            (getBackgroundMediaType(activeBackgroundMediaUrl) === 'video' && ![DARK_THEME_KEY, LIGHT_THEME_KEY].includes(currentTheme)) ||
            getBackgroundMediaType(activeBackgroundMediaUrl) === 'youtube' ||
            getBackgroundMediaType(activeBackgroundMediaUrl) === 'iframe');
        if (!isTransparentThemeCurrentlyActive) {
            setIsMediaLoading(false);
            setShowPlayOverlay(false);
            return;
        }
        const mediaElement = mediaRef.current;
        const currentMediaType = getBackgroundMediaType(activeBackgroundMediaUrl);
        setIsMediaLoading(true);
        setShowPlayOverlay(false);
        
        // Fix: Added check for mediaElement before attempting to load/play
        if (mediaElement) {
            if (currentMediaType === 'video') {
                if (activeBackgroundMediaUrl === DEFAULT_VIDEO_BACKGROUND && defaultVideoPreloader.current && defaultVideoPreloader.current.readyState >= 3) {
                    mediaElement.currentTime = defaultVideoPreloader.current.currentTime;
                    mediaElement.play().then(() => {
                        setIsMediaLoading(false);
                        setShowPlayOverlay(false);
                    }).catch(e => {
                        console.warn("Default video autoplay blocked instantly:", e);
                        setIsMediaLoading(false);
                        setShowPlayOverlay(true);
                    });
                } else {
                    mediaElement.load();
                    const playPromise = mediaElement.play();
                    if (playPromise !== undefined) {
                        playPromise.then(() => {
                            setIsMediaLoading(false);
                            setShowPlayOverlay(false);
                        }).catch(error => {
                            console.warn("Video autoplay blocked or error for custom URL:", error);
                            setIsMediaLoading(false);
                            setShowPlayOverlay(true);
                            console.log("Failed to play custom background video. It might be incompatible or autoplay blocked. Continuing theme cycle.");
                        });
                    }
                }
            } else if (currentMediaType === 'image') {
                setIsMediaLoading(false);
            } else if (currentMediaType === 'youtube' || currentMediaType === 'iframe') {
                setIsMediaLoading(false);
            } else {
                setIsMediaLoading(false);
                console.warn("Unsupported or invalid background media URL detected. Falling back to Dark Theme.");
                setCurrentTheme(DARK_THEME_KEY);
                setActiveBackgroundMediaUrl(DEFAULT_VIDEO_BACKGROUND);
            }
        }
    }, [currentTheme, activeBackgroundMediaUrl]);

    // --- URL Input Modal Handling ---
    const handleUrlSubmit = () => {
        const url = urlInputRef.current.value.trim();
        if (!url) {
            alert("Please enter a URL.");
            return;
        }
        let processedUrl = url;
        let newThemeKey;
        const youtubeEmbed = getYouTubeEmbedUrl(url);
        if (youtubeEmbed) {
            processedUrl = youtubeEmbed;
            newThemeKey = 'media-theme-iframe';
        } else if (isDirectMediaUrl(url)) {
            if (isImageUrl(url)) {
                newThemeKey = VIDEO_THEME_IMAGE_KEY;
            } else {
                newThemeKey = 'video-theme-url';
            }
            processedUrl = url;
        } else if (url.startsWith('https://') || url.startsWith('http://')) {
            processedUrl = url;
            newThemeKey = 'media-theme-iframe';
            alert("Attempting to embed this URL. Please note that many websites (like Instagram, Pinterest) block direct embedding for security. You might see a blank background or an error.");
        } else {
            alert("Invalid or unsupported URL. Please enter a direct media URL (e.g., .mp4, .jpg), a YouTube link, or a general web URL (which may be blocked).");
            return;
        }
        setActiveBackgroundMediaUrl(processedUrl);
        setCurrentTheme(newThemeKey);
        localStorage.setItem('defaultAppTheme', newThemeKey);
        if (newThemeKey === VIDEO_THEME_IMAGE_KEY) {
            localStorage.setItem('customBackground', processedUrl);
        } else {
            localStorage.removeItem('customBackground');
        }
        setShowMediaInputModal(false);
        setIsMediaLoading(true);
        setShowPlayOverlay(false);
    };

    const handleImageFileInput = (event) => {
        const file = event.target.files[0];
        if (file) {
            const fileType = file.type;
            if (fileType.startsWith('image/')) {
                const reader = new FileReader();
                reader.onloadend = () => {
                    const base64String = reader.result;
                    setActiveBackgroundMediaUrl(base64String);
                    setCurrentTheme(VIDEO_THEME_IMAGE_KEY);
                    localStorage.setItem('customBackground', base64String);
                    localStorage.setItem('defaultAppTheme', VIDEO_THEME_IMAGE_KEY);
                    alert("Custom Image Theme applied and set as default!");
                    setShowImageUploadModal(false);
                    setIsMediaLoading(true);
                    setShowPlayOverlay(false);
                };
                reader.onerror = (error) => {
                    console.error("Error reading file:", error);
                    alert("Failed to read image file. Please try again.");
                    setIsMediaLoading(false);
                };
                reader.readAsDataURL(file);
            } else {
                alert('Please select an image file.');
            }
        }
        event.target.value = null;
    };

    const closeMediaInputModal = () => {
        setShowMediaInputModal(false);
    };
    const closeImageUploadModal = () => {
        setShowImageUploadModal(false);
    };

    const handlePermissionsGranted = () => {
        console.log("Permissions granted!");
        setShowPermissionModal(false);
    };

    const handleOverlayClick = () => {
        if (mediaRef.current && mediaRef.current.paused) {
            mediaRef.current.play().then(() => {
                setShowPlayOverlay(false);
            }).catch(e => {
                console.error("Manual play failed:", e);
            });
        }
    };

    // --- Home Icon Single Tap Handler (cycles themes) ---
    const handleHomeIconClick = (e) => {
        e.preventDefault();
        let currentIndex = themeCycleOrder.indexOf(currentTheme);
        let nextIndex = (currentIndex + 1) % themeCycleOrder.length;
        let nextThemeKey = themeCycleOrder[nextIndex];
        if (nextThemeKey === VIDEO_THEME_IMAGE_KEY && (!localStorage.getItem('customBackground') || !isImageUrl(localStorage.getItem('customBackground')))) {
            nextIndex = (nextIndex + 1) % themeCycleOrder.length;
            nextThemeKey = themeCycleOrder[nextIndex];
            console.warn("No valid custom image found, skipping to next theme in cycle:", nextThemeKey);
        }
        setCurrentTheme(nextThemeKey);
        if (nextThemeKey === VIDEO_THEME_DEFAULT_KEY) {
            setActiveBackgroundMediaUrl(DEFAULT_VIDEO_BACKGROUND);
        } else if (nextThemeKey === VIDEO_THEME_IMAGE_KEY) {
            const savedCustomBackground = localStorage.getItem('customBackground');
            if (savedCustomBackground && isImageUrl(savedCustomBackground)) {
                setActiveBackgroundMediaUrl(savedCustomBackground);
            } else {
                setActiveBackgroundMediaUrl(DEFAULT_VIDEO_BACKGROUND);
                setCurrentTheme(VIDEO_THEME_DEFAULT_KEY);
                console.warn("Attempted to set custom image theme without image. Falling back to default video.");
            }
        } else {
            setActiveBackgroundMediaUrl(null);
        }
    };

    // --- MAXBOND Title Double Tap Handler (Opens Image Upload Modal) ---
    const handleMaxbondTouchStart = (e) => {
        clearTimeout(tapTimer.current);
        initialTouchPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };
    const handleMaxbondTouchEnd = (e) => {
        if (e.changedTouches && initialTouchPos.current.x !== 0) {
            const currentX = e.changedTouches[0].clientX;
            const currentY = e.changedTouches[0].clientY;
            const dx = Math.abs(currentX - initialTouchPos.current.x);
            const dy = Math.abs(currentY - initialTouchPos.current.y);
            if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) {
                maxbondTapCount.current = 0;
                return;
            }
        }
        maxbondTapCount.current += 1;
        if (tapTimer.current) {
            clearTimeout(tapTimer.current);
        }
        if (maxbondTapCount.current === 1) {
            tapTimer.current = setTimeout(() => {
                maxbondTapCount.current = 0;
            }, DOUBLE_TAP_THRESHOLD_MS);
        } else if (maxbondTapCount.current === 2) {
            setShowImageUploadModal(true);
            maxbondTapCount.current = 0;
            clearTimeout(tapTimer.current);
        }
    };

    const handleMaxbondMouseDown = (e) => {
        if (e.button === 0) {
            handleMaxbondTouchStart({ touches: [{ clientX: e.clientX, clientY: e.clientY }] });
        }
    };

    const handleMaxbondMouseUp = (e) => {
        if (e.button === 0) {
            handleMaxbondTouchEnd({ changedTouches: [{ clientX: e.clientX, clientY: e.clientY }] });
        }
    };

    // --- Conditional Rendering for Loading State ---
    if (loadingUser) {
        const loadingClass = styles[(currentTheme === VIDEO_THEME_DEFAULT_KEY || currentTheme === VIDEO_THEME_IMAGE_KEY || getBackgroundMediaType(activeBackgroundMediaUrl) === 'video' || getBackgroundMediaType(activeBackgroundMediaUrl) === 'youtube' || getBackgroundMediaType(activeBackgroundMediaUrl) === 'iframe') ? 'video-theme' : currentTheme];
        return (
            <div className={`${styles.homePageContainer} ${loadingClass}`}>
                <div className={styles.loadingMessage}>Loading Home Page...</div>
            </div>
        );
    }

    const isTransparentThemeActiveInDOM = (
        currentTheme === VIDEO_THEME_DEFAULT_KEY ||
        currentTheme === VIDEO_THEME_IMAGE_KEY ||
        (![DARK_THEME_KEY, LIGHT_THEME_KEY].includes(currentTheme) &&
            (getBackgroundMediaType(activeBackgroundMediaUrl) === 'video' ||
                getBackgroundMediaType(activeBackgroundMediaUrl) === 'youtube' ||
                getBackgroundMediaType(activeBackgroundMediaUrl) === 'iframe'))
    );
    const renderedMediaType = getBackgroundMediaType(activeBackgroundMediaUrl);

    // --- Main Component Render ---
    return (
        <div className={`${styles.homePageContainer} ${styles[isTransparentThemeActiveInDOM ? 'video-theme' : currentTheme]}`}>
            {isTransparentThemeActiveInDOM && (
                <>
                    {renderedMediaType === 'youtube' || renderedMediaType === 'iframe' ? (
                        <iframe
                            key={activeBackgroundMediaUrl}
                            ref={mediaRef}
                            className={styles.backgroundMedia}
                            src={activeBackgroundMediaUrl}
                            frameBorder="0"
                            allow={renderedMediaType === 'youtube' ? "autoplay; modest-branding; encrypted-media; gyroscope; picture-in-picture" : ""}
                            allowFullScreen
                            title={renderedMediaType === 'youtube' ? "YouTube video player" : "Embedded Content"}
                            onLoad={() => { setIsMediaLoading(false); setShowPlayOverlay(false); }}
                            onError={(e) => {
                                console.error("Iframe embed error:", e);
                                setIsMediaLoading(false);
                                alert("Failed to load embedded content. This URL might block embedding or is invalid. Switching to Dark Theme.");
                                setActiveBackgroundMediaUrl(DEFAULT_VIDEO_BACKGROUND);
                                setCurrentTheme(DARK_THEME_KEY);
                            }}
                        ></iframe>
                    ) : renderedMediaType === 'video' ? (
                        <video
                            key={activeBackgroundMediaUrl}
                            ref={mediaRef}
                            className={styles.backgroundMedia}
                            autoPlay
                            loop
                            muted
                            playsInline
                            src={activeBackgroundMediaUrl}
                            onLoadedData={() => setIsMediaLoading(false)}
                            onError={(e) => {
                                console.error("Media load error:", e);
                                setIsMediaLoading(false);
                                console.warn("Failed to load background video. Falling back to default behavior.");
                            }}
                        >
                            Your browser does not support the video tag.
                        </video>
                    ) : renderedMediaType === 'image' ? (
                        <img
                            key={activeBackgroundMediaUrl}
                            ref={mediaRef}
                            className={styles.backgroundMedia}
                            src={activeBackgroundMediaUrl}
                            alt="Custom Background"
                            onLoad={() => { setIsMediaLoading(false); setShowPlayOverlay(false); }}
                            onError={(e) => {
                                console.error("Media load error:", e);
                                setIsMediaLoading(false);
                                console.warn("Failed to load background image. Falling back to default behavior.");
                            }}
                        />
                    ) : (
                        <div className={styles.backgroundMediaFallback}>
                            <p>Unsupported media type or URL.</p>
                            <p>Please try a direct video/image link or a YouTube URL.</p>
                            <button onClick={() => { setActiveBackgroundMediaUrl(DEFAULT_VIDEO_BACKGROUND); setCurrentTheme(VIDEO_THEME_DEFAULT_KEY); }}>
                                Reset Background
                            </button>
                        </div>
                    )}
                    <div className={styles.mediaOverlay} onClick={showPlayOverlay ? handleOverlayClick : undefined}>
                        {showPlayOverlay && (
                            <div className={styles.playOverlay}>
                                <i className="fas fa-play-circle"></i>
                                <p>Tap to play video</p>
                            </div>
                        )}
                    </div>
                    {isMediaLoading && (
                        <div className={styles.backgroundMediaLoading}>
                            <div className={styles.spinner}></div>
                            <p>Loading media...</p>
                        </div>
                    )}
                </>
            )}

            <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept="image/*"
                onChange={handleImageFileInput}
            />

            <header className={styles.header}>
                <div className={styles.headerContent}>
                    <h1
                        className={styles.headerTitle}
                        onTouchStart={handleMaxbondTouchStart}
                        onTouchEnd={handleMaxbondTouchEnd}
                        onMouseDown={handleMaxbondMouseDown}
                        onMouseUp={handleMaxbondMouseUp}
                        onClick={(e) => e.preventDefault()}
                    >
                        MAXBOND
                    </h1>
                    {!loadingUser && user && (
                        <div className={styles.userInfoHeader}>
                            <p className={styles.welcomeMessage}>Welcome, {user.displayName || user.email}</p>
                            <p className={styles.readyMessage}>Ready to manage your finances?</p>
                        </div>
                    )}
                </div>

                <button
                    className={styles.headerIcon}
                    onClick={handleHomeIconClick}
                    aria-label="Toggle theme"
                >
                    <i className="fas fa-home"></i>
                </button>
            </header>

            <div className={styles.mainButtonsGrid}>
                <Link to="/dashboard" className={styles.navButton}>
                    <i className="fas fa-chart-line icon"></i>
                    <span className={styles.text}>Expense Page</span>
                </Link>

                <Link to="/site-stock" className={styles.navButton}>
                    <i className="fas fa-warehouse icon"></i>
                    <span className={styles.text}>Manage Site Stock</span>
                </Link>

                <Link to="/attendance" className={styles.navButton}>
                    <i className="fas fa-clipboard-check icon"></i>
                    <span className={styles.text}>Mark Attendance</span>
                </Link>

                <Link to="/fuel-entry" className={styles.navButton}>
                    <i className="fas fa-gas-pump"></i>
                    <span className={styles.text}>Fuel Entry</span>
                </Link>

                {/* Yahan naya button add kiya gaya hai */}
                <Link to="/all-sites-inventory" className={`${styles.navButton} ${styles.navButton_5}`}>
                    <i className="fas fa-boxes icon"></i>
                    <span className={styles.text}>All Sites Inventory</span>
                </Link>
            </div>

            {showMediaInputModal && (
                <div className={styles.mediaInputModalOverlay} onClick={closeMediaInputModal}>
                    <div className={styles.mediaInputModalContent} onClick={(e) => e.stopPropagation()}>
                        <h3>Set Custom Video/Image Background (URL)</h3>
                        <input
                            type="text"
                            ref={urlInputRef}
                            placeholder="Paste direct media URL (YouTube, .mp4, .jpg, or any web URL)"
                            className={styles.modalInputField}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    handleUrlSubmit();
                                }
                            }}
                        />
                        <button className={styles.modalButton} onClick={handleUrlSubmit}>
                            <i className="fas fa-link"></i> Set Background
                        </button>
                        <button className={styles.modalCloseButton} onClick={closeMediaInputModal}>
                            <i className="fas fa-times"></i> Close
                        </button>
                    </div>
                </div>
            )}
            {showImageUploadModal && (
                <div className={styles.mediaInputModalOverlay} onClick={closeImageUploadModal}>
                    <div className={styles.mediaInputModalContent} onClick={(e) => e.stopPropagation()}>
                        <h3>Set Custom Image Background</h3>
                        <p className={styles.modalOrDivider}>Choose an image from your device.</p>
                        <button className={styles.modalButton} onClick={() => fileInputRef.current.click()}>
                            <i className="fas fa-upload"></i> Choose Image
                        </button>
                        <button className={styles.modalCloseButton} onClick={closeImageUploadModal}>
                            <i className="fas fa-times"></i> Close
                        </button>
                    </div>
                </div>
            )}
            {showPermissionModal && (
                <PermissionRequestModal
                    permissionType={permissionType}
                    onClose={() => setShowPermissionModal(false)}
                    onPermissionsGranted={handlePermissionsGranted}
                />
            )}
        </div>
    );
};

export default HomePage;