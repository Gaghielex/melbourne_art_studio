/**
 * Masonry Gallery Fix for Melbourne Art Studio Website
 * This file contains a fix for the flickering/flashing issue with masonry gallery when navigating between pages
 * while preserving dark/light theme functionality
 */

// Execute immediately and also listen for DOMContentLoaded
(function() {
    if (document.readyState === "loading") {
        // Still loading, wait for the event
        document.addEventListener('DOMContentLoaded', initOnLoad);
    } else {
        // DOM already loaded, run immediately
        initOnLoad();
    }
    
    function initOnLoad() {
        console.log('Masonry fix script executing on:', window.location.pathname);
        setTimeout(() => {
            initMasonryGallery();
        }, 10);
    }
})();

/**
 * Initialize masonry gallery with image loading check
 * This function ensures all images are loaded before arranging the masonry layout
 * to prevent flickering/flashing when navigating between pages
 */
function initMasonryGallery() {
    const galleryContainer = document.getElementById('gallery-container');
    
    // Only proceed if gallery container exists
    if (!galleryContainer) return;
    
    console.log('Gallery container found, current page:', window.location.pathname);
    
    const galleryItems = document.querySelectorAll('.masonry-item img');
    const totalImages = galleryItems.length;
    let loadedImages = 0;
    
    console.log('Found', totalImages, 'gallery images to load');
    
    // Hide gallery initially to prevent flickering
    galleryContainer.style.opacity = '0';
    
    // Create a promise to track image loading
    const imagePromises = Array.from(galleryItems).map(img => {
        return new Promise((resolve) => {
            // If image is already loaded or has no src
            if (img.complete || !img.src) {
                loadedImages++;
                resolve();
                return;
            }
            
            // Add load event listeners
            img.addEventListener('load', () => {
                loadedImages++;
                resolve();
            });
            
            img.addEventListener('error', () => {
                loadedImages++;
                resolve(); // Resolve even on error to prevent hanging
            });
        });
    });
    
    // When all images are loaded, reveal gallery
    Promise.all(imagePromises).then(() => {
        console.log('All images loaded for', window.location.pathname);
        // Add a small delay to ensure browser has time to calculate layout
        setTimeout(() => {
            console.log('Revealing gallery now');
            // Apply smooth transition to prevent sudden appearance
            galleryContainer.style.transition = 'opacity 0.3s ease-in';
            galleryContainer.style.opacity = '1';
            
            // Force browser to recalculate layout if needed
            if (typeof AOS !== 'undefined') {
                AOS.refresh();
            }
            
            // Make sure theme toggle still works after gallery is loaded
            const themeToggleBtn = document.getElementById('theme-toggle');
            if (themeToggleBtn) {
                // Re-initialize the theme toggle listener to ensure it works
                themeToggleBtn.addEventListener('click', () => {
                    if (document.documentElement.classList.contains('dark')) {
                        document.documentElement.classList.remove('dark');
                        localStorage.setItem('theme', 'light');
                    } else {
                        document.documentElement.classList.add('dark');
                        localStorage.setItem('theme', 'dark');
                    }
                });
            }
        }, 100);
    });
}
