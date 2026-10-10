/**
 * Scroll-reveal for the masonry galleries.
 *
 * Each item fades up the moment it actually scrolls into view, and only once
 * its image has loaded, so nothing pops in after its animation has played.
 * This is an IntersectionObserver rather than AOS because the grid is CSS
 * multi-column with lazy-loaded images: AOS caches element positions up front,
 * and as images load the layout shifts, so items triggered early or all at once.
 * Images carry width/height attributes so their space is reserved from the start.
 */
document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('gallery-container');
    if (!container) return;

    const items = Array.from(container.querySelectorAll('.gallery-item'));
    if (!items.length) return;

    if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    items.forEach((item) => item.classList.add('reveal-pending'));

    const whenLoaded = (item) => {
        const img = item.querySelector('img');
        if (!img || img.complete) return Promise.resolve();
        return new Promise((resolve) => {
            img.addEventListener('load', resolve, { once: true });
            img.addEventListener('error', resolve, { once: true });
        });
    };

    const reveal = (item, delay) => {
        whenLoaded(item).then(() => {
            item.style.animationDelay = `${delay}ms`;
            item.classList.remove('reveal-pending');
            item.classList.add('reveal-in');
            item.addEventListener('animationend', () => {
                item.classList.remove('reveal-in');
                item.style.animationDelay = '';
            }, { once: true });
        });
    };

    const observer = new IntersectionObserver((entries) => {
        // Items entering in the same pass (e.g. the first screenful) cascade
        // gently, ordered top-to-bottom then left-to-right.
        const entering = entries
            .filter((e) => e.isIntersecting)
            .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top || a.boundingClientRect.left - b.boundingClientRect.left);
        entering.forEach((entry, i) => {
            observer.unobserve(entry.target);
            reveal(entry.target, Math.min(i, 8) * 90);
        });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

    items.forEach((item) => observer.observe(item));
});
