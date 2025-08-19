// Animations JavaScript for Melbourne Art Studio Website

document.addEventListener('DOMContentLoaded', function() {
    // Initialize page transition animations
    initPageTransitions();
    
    // Initialize hover animations
    initHoverEffects();
    
    // Initialize scroll animations
    initScrollAnimations();
    
    // Initialize text animations
    initTextAnimations();
    
    // Initialize parallax effect
    initParallaxEffect();
});

// Page Transition Animations
function initPageTransitions() {
    // Add visible class to all page transition elements after a short delay
    const pageTransitions = document.querySelectorAll('.page-transition');
    
    if (pageTransitions.length > 0) {
        setTimeout(() => {
            pageTransitions.forEach((element, index) => {
                setTimeout(() => {
                    element.classList.add('visible');
                }, index * 100); // Stagger the animations
            });
        }, 200);
    }
}

// Hover Effects
function initHoverEffects() {
    // Apply hover effects to gallery items
    const galleryItems = document.querySelectorAll('.gallery-item');
    
    galleryItems.forEach(item => {
        item.addEventListener('mouseenter', (e) => {
            // Create a subtle "lift" effect with shadow
            item.style.transform = 'translateY(-8px)';
            item.style.boxShadow = '0 10px 25px rgba(0, 0, 0, 0.1)';
        });
        
        item.addEventListener('mouseleave', (e) => {
            // Return to original state
            item.style.transform = '';
            item.style.boxShadow = '';
        });
    });
    
    // Add ripple effect to buttons
    const buttons = document.querySelectorAll('.btn-hover-effect');
    
    buttons.forEach(button => {
        button.addEventListener('click', function(e) {
            const x = e.clientX - this.getBoundingClientRect().left;
            const y = e.clientY - this.getBoundingClientRect().top;
            
            const ripple = document.createElement('span');
            ripple.className = 'ripple';
            ripple.style.width = ripple.style.height = '100px';
            ripple.style.left = x + 'px';
            ripple.style.top = y + 'px';
            
            this.appendChild(ripple);
            
            setTimeout(() => {
                ripple.remove();
            }, 600); // Match the CSS animation duration
        });
    });
}

// Scroll Animations
function initScrollAnimations() {
    // Create an animation for section headers when they scroll into view
    const sectionHeaders = document.querySelectorAll('section h2');
    
    // Create a reveal animation for headers
    const headerObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-fade-in-up');
                headerObserver.unobserve(entry.target); // Only animate once
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '-100px 0px'
    });
    
    // Apply to all section headers
    sectionHeaders.forEach(header => {
        header.style.opacity = '0'; // Initially hidden
        headerObserver.observe(header);
    });
    
    // Progress bars animation (for skills or statistics if added later)
    const progressBars = document.querySelectorAll('.progress-bar');
    
    const progressObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const percentValue = entry.target.getAttribute('data-percent');
                entry.target.style.width = percentValue + '%';
                progressObserver.unobserve(entry.target); // Only animate once
            }
        });
    }, {
        threshold: 0.1
    });
    
    progressBars.forEach(bar => {
        progressObserver.observe(bar);
    });
}

// Text Animation Functions
function initTextAnimations() {
    // Animated typing effect for selected elements
    const typingElements = document.querySelectorAll('.typing-animation');
    
    typingElements.forEach(element => {
        const text = element.textContent;
        element.textContent = '';
        element.style.display = 'inline-block';
        
        // Create a span for the cursor
        const cursor = document.createElement('span');
        cursor.className = 'typing-cursor';
        cursor.textContent = '|';
        element.after(cursor);
        
        // Observer to start animation when element is in view
        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                typeText(element, text, 0);
                observer.unobserve(element); // Only animate once
            }
        }, { threshold: 0.5 });
        
        observer.observe(element);
    });
    
    // Text typing function
    function typeText(element, text, index) {
        if (index < text.length) {
            element.textContent += text.charAt(index);
            setTimeout(() => typeText(element, text, index + 1), 100); // Adjust speed as needed
        }
    }
}

// Parallax Effect
function initParallaxEffect() {
    // Add parallax effect to hero section background or other elements
    const parallaxElements = document.querySelectorAll('.parallax');
    
    window.addEventListener('scroll', () => {
        const scrollY = window.scrollY;
        
        parallaxElements.forEach(element => {
            const speed = element.getAttribute('data-speed') || 0.2;
            element.style.transform = `translateY(${scrollY * speed}px)`;
        });
    });
    
    // Mouse move parallax for specific elements
    const mouseParallax = document.querySelectorAll('.mouse-parallax');
    
    document.addEventListener('mousemove', (e) => {
        const mouseX = e.clientX;
        const mouseY = e.clientY;
        
        mouseParallax.forEach(element => {
            const speed = element.getAttribute('data-speed') || 0.05;
            const x = (window.innerWidth / 2 - mouseX) * speed;
            const y = (window.innerHeight / 2 - mouseY) * speed;
            
            element.style.transform = `translate(${x}px, ${y}px)`;
        });
    });
}
