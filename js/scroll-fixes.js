/**
 * Scroll fixes for Melbourne Art Studio Website
 * This file addresses scrolling issues across the site
 */

document.addEventListener('DOMContentLoaded', () => {
    // Prevent section scroll issues
    preventSectionScroll();
    
    // Fix issues with masonry loading and scroll
    fixMasonryScrolling();
    
    // Ensure smooth transitions between animations
    smoothenAnimations();
    
    // Fix AOS animation interruptions
    fixAOSScrollInterruptions();
});

/**
 * Prevent sections from having their own scrollbars
 */
function preventSectionScroll() {
    // Make sure no section has overflow:auto or overflow:scroll
    const sections = document.querySelectorAll('section');
    sections.forEach(section => {
        const computedStyle = window.getComputedStyle(section);
        if (computedStyle.overflowX === 'auto' || computedStyle.overflowX === 'scroll' ||
            computedStyle.overflowY === 'auto' || computedStyle.overflowY === 'scroll') {
            section.style.overflow = 'visible';
        }
    });
    
    // Fix for the masonry gallery causing independent scrolling
    const masonryGallery = document.querySelector('.masonry-gallery');
    if (masonryGallery) {
        masonryGallery.style.overflow = 'visible';
    }
    
    // Fix for reviews carousel causing independent scrolling
    const reviewsCarousel = document.querySelector('.reviews-carousel');
    if (reviewsCarousel) {
        // Maintain horizontal overflow but fix vertical
        reviewsCarousel.style.overflowY = 'visible';
    }
}

/**
 * Fix scrolling issues related to masonry gallery loading
 */
function fixMasonryScrolling() {
    const masonryGallery = document.querySelector('.masonry-gallery');
    if (!masonryGallery) return;
    
    // Add a loading state while images are being processed
    masonryGallery.classList.add('loading');
    
    // Get all images in the gallery
    const images = masonryGallery.querySelectorAll('img');
    const imagePromises = Array.from(images).map(img => {
        return new Promise(resolve => {
            if (img.complete) {
                resolve();
            } else {
                img.onload = resolve;
                img.onerror = resolve; // Resolve on error too to avoid blocking
            }
        });
    });
    
    // When all images are loaded, remove loading state
    Promise.all(imagePromises).then(() => {
        masonryGallery.classList.remove('loading');
        
        // Force browser to recalculate layout
        if (typeof AOS !== 'undefined') {
            setTimeout(() => {
                AOS.refresh();
            }, 100);
        }
    });
}

/**
 * Smooth out animations to prevent scroll interruptions
 */
function smoothenAnimations() {
    // Reduce the effect of parallax scrolling which can cause jittering
    const parallaxElements = document.querySelectorAll('.parallax');
    parallaxElements.forEach(element => {
        // Lower the parallax effect speed to minimize scroll interference
        const currentSpeed = parseFloat(element.getAttribute('data-speed') || '0.2');
        element.setAttribute('data-speed', (currentSpeed / 2).toString());
    });
}

/**
 * Fix AOS animation interruptions during scrolling
 */
function fixAOSScrollInterruptions() {
    if (typeof AOS === 'undefined') return;
    
    // Update AOS settings for smoother scrolling
    AOS.refresh();
    
    // Add event to refresh AOS on window resize
    window.addEventListener('resize', () => {
        AOS.refresh();
    });
    
    // Add event to refresh AOS after scrolling stops
    let scrollTimeout;
    window.addEventListener('scroll', () => {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            AOS.refresh();
        }, 150);
    });
}
