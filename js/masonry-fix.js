/**
 * Gallery scroll reveal: each item fades in and slides up 20px as it scrolls
 * into view. Deliberately minimal: a class toggled by an IntersectionObserver,
 * animated with a plain CSS transition (see .reveal in css/styles.css).
 */
document.addEventListener('DOMContentLoaded', () => {
    const items = document.querySelectorAll('#gallery-container .gallery-item');
    if (!items.length || !('IntersectionObserver' in window)) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            const item = entry.target;
            observer.unobserve(item);
            item.classList.add('reveal-visible');
            // Once settled, drop the reveal classes so normal hover styles apply.
            item.addEventListener('transitionend', function done(e) {
                if (e.propertyName !== 'opacity') return;
                item.classList.remove('reveal', 'reveal-visible');
                item.removeEventListener('transitionend', done);
            });
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -5% 0px' });

    items.forEach((item) => {
        item.classList.add('reveal');
        observer.observe(item);
    });
});
