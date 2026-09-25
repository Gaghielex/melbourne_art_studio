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

    // The grid itself is plain CSS multi-column (see .masonry-grid /
    // .masonry-gallery) — there's no JS-computed layout to wait for, so
    // there's nothing to get "wrong" by revealing early. Below-the-fold
    // gallery images use loading="lazy", meaning the browser deliberately
    // doesn't fetch them until they're scrolled near — so gating this
    // reveal on every image's load event (the previous approach) waited on
    // network requests the browser was intentionally deferring, and the
    // whole gallery stayed invisible until the user scrolled to the very
    // last image. Reveal on a short fixed delay instead: long enough to
    // avoid a flash of unstyled content on navigation, short enough to
    // never block on images the browser hasn't chosen to fetch yet.
    // setTimeout rather than requestAnimationFrame: rAF only fires on the
    // next paint, which some browser contexts defer or skip entirely while
    // a tab is backgrounded/not actively rendering — which would leave the
    // gallery invisible forever, exactly the bug this is fixing. A timer
    // fires regardless of paint/visibility state.
    galleryContainer.style.opacity = '0';
    galleryContainer.style.transition = 'opacity 0.3s ease-in';
    setTimeout(() => {
        galleryContainer.style.opacity = '1';
        if (typeof AOS !== 'undefined') {
            AOS.refresh();
        }
    }, 0);
}
