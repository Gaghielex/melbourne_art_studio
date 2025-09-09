// Mobile navigation and container width fixes

document.addEventListener('DOMContentLoaded', function() {
  // Add overflow-x: hidden to the body
  document.body.style.overflowX = 'hidden';
  document.documentElement.style.overflowX = 'hidden';
  
  // Find all container elements and ensure they don't exceed viewport width
  const containers = document.querySelectorAll('.container');
  
  function adjustContainers() {
    const viewportWidth = window.innerWidth;
    containers.forEach(container => {
      if (viewportWidth <= 768) {
        container.style.maxWidth = '100%';
        container.style.width = '100%';
        container.style.paddingLeft = '0.75rem';
        container.style.paddingRight = '0.75rem';
      }
    });
  }
  
  // Run on page load
  adjustContainers();
  
  // Run on window resize
  window.addEventListener('resize', adjustContainers);
});
