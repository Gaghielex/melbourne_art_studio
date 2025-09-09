// Mobile navigation and container width fixes

document.addEventListener('DOMContentLoaded', function() {
  // Add overflow-x: hidden to the body
  document.body.style.overflowX = 'hidden';
  document.documentElement.style.overflowX = 'hidden';
  
  // Find all container elements and ensure they don't exceed viewport width
  const containers = document.querySelectorAll('.container');
  const gallerySection = document.getElementById('gallery');
  const testimonialSection = document.querySelector('.testimonial-slider');
  
  function adjustContainers() {
    const viewportWidth = window.innerWidth;
    
    // Fix sections that might cause independent scrolling
    if (gallerySection) {
      gallerySection.style.overflowX = 'hidden';
    }
    
    if (testimonialSection) {
      testimonialSection.style.overflowX = 'hidden';
    }
    
    containers.forEach(container => {
      if (viewportWidth <= 768) {
        container.style.maxWidth = '100%';
        container.style.width = '100%';
        container.style.paddingLeft = '0.75rem';
        container.style.paddingRight = '0.75rem';
        container.style.overflowX = 'hidden';
      }
    });
  }
  
  // Run on page load
  adjustContainers();
  
  // Run on window resize
  window.addEventListener('resize', adjustContainers);
});
