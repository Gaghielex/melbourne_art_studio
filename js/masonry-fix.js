/**
 * Masonry Gallery Fix for Melbourne Art Studio Website
 * This file contains a fix for the flickering/flashing issue with masonry gallery when navigating between pages
 */

document.addEventListener('DOMContentLoaded', () => {
    initMasonryGallery();
});

/**
 * Initialize masonry gallery with image loading check
 * This function ensures all images are loaded before arranging the masonry layout
 * to prevent flickering/flashing when navigating between pages
 */
function initMasonryGallery() {
    const galleryContainer = document.getElementById('gallery-container');
    
    // Only proceed if gallery container exists
    if (!galleryContainer) return;
    
    const galleryItems = document.querySelectorAll('.masonry-item img');
    const totalImages = galleryItems.length;
    let loadedImages = 0;
    
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
        // Add a small delay to ensure browser has time to calculate layout
        setTimeout(() => {
            // Apply smooth transition to prevent sudden appearance
            galleryContainer.style.transition = 'opacity 0.3s ease-in';
            galleryContainer.style.opacity = '1';
            
            // Force browser to recalculate layout if needed and prevent overflow issues
            document.getElementById('gallery').classList.add('overflow-hidden-important');
            if (typeof AOS !== 'undefined') {
                AOS.refresh();
            }
        }, 100);
    });
}
