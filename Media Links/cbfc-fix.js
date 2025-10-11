// CBFC Film Search Input Fix
// This script removes the restrictive input validation that prevents spaces
// from being typed in the film title input field on the CBFC website.

(function() {
  'use strict';

  // Wait for the page to load
  function initFix() {
    // Find the film title input field
    const filmTitleInput = document.getElementById('film-title');

    if (!filmTitleInput) {
      // If not found, try again after a short delay
      setTimeout(initFix, 500);
      return;
    }

    // Remove all existing 'input' event listeners by cloning the element
    // This removes the restrictive validation that strips spaces
    const newInput = filmTitleInput.cloneNode(true);
    filmTitleInput.parentNode.replaceChild(newInput, filmTitleInput);

    // Add a new, permissive input handler that allows spaces and special characters
    newInput.addEventListener('input', function(e) {
      // Allow all characters - no restrictions
      console.log('CBFC Fix: Input allowed -', this.value);
    });

    console.log('CBFC Fix: Space input restriction removed successfully!');
  }

  // Start the fix when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFix);
  } else {
    initFix();
  }
})();
