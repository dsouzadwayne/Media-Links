/**
 * Bookmarklet Parser Module
 * Parses metadata blocks, injects external scripts/styles, and generates bookmarklet URLs
 * Based on patterns from bookmarklet npm package and bookmarklet-maker
 */

(function(global) {
  'use strict';

  // Metadata key types
  const METADATA_TYPES = {
    STRING: 'string',
    LIST: 'list',
    BOOLEAN: 'boolean'
  };

  // Supported metadata keys and their types
  const METADATA_KEYS = {
    name: METADATA_TYPES.STRING,
    version: METADATA_TYPES.STRING,
    description: METADATA_TYPES.STRING,
    author: METADATA_TYPES.STRING,
    repository: METADATA_TYPES.STRING,
    license: METADATA_TYPES.STRING,
    script: METADATA_TYPES.LIST,
    style: METADATA_TYPES.LIST
  };

  // ============ Utility Functions ============

  /**
   * Simple string hash for generating unique IDs
   * @param {string} str
   * @returns {string} 7-character hash
   */
  function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16).padStart(7, '0').substring(0, 7);
  }

  /**
   * Escape quotes in a string for use in generated code
   * @param {string} str
   * @returns {string}
   */
  function escapeQuotes(str) {
    return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/'/g, "\\'");
  }

  /**
   * Extract options from a path string (e.g., "!loadOnce https://example.com/file.js")
   * @param {string} pathStr
   * @returns {{path: string, options: Object}}
   */
  function extractOptions(pathStr) {
    const options = {};
    let path = pathStr.trim();

    // Match options like !loadOnce or !key=value
    while (true) {
      const match = path.match(/^(![\w]+(?:=[\w]+)?)\s+/);
      if (match) {
        path = path.substring(match.index + match[0].length);
        const opt = match[1].substring(1).split('=');
        const key = opt[0];
        let value = opt[1];

        // Parse value
        if (value === undefined) {
          value = true;
        } else if (value === 'true') {
          value = true;
        } else if (value === 'false') {
          value = false;
        } else if (!isNaN(Number(value))) {
          value = Number(value);
        }

        options[key] = value;
      } else {
        break;
      }
    }

    return { path, options };
  }

  // ============ Code Generators ============

  /**
   * Generate script loader code
   * @param {string} innerCode - Code to execute after script loads
   * @param {string} scriptUrl - URL of script to load
   * @param {boolean} loadOnce - Only load if not already present
   * @returns {string} Generated code
   */
  function generateScriptLoader(innerCode, scriptUrl, loadOnce = false) {
    const id = `bookmarklet__script_${simpleHash(scriptUrl)}`;

    return `
function callback(){
  ${innerCode}
}
if(!${loadOnce}||!document.getElementById("${id}")){
  var s=document.createElement("script");
  if(s.addEventListener){
    s.addEventListener("load",callback,false);
  }else if(s.readyState){
    s.onreadystatechange=callback;
  }
  ${loadOnce ? `s.id="${id}";` : ''}
  s.src="${escapeQuotes(scriptUrl)}";
  document.body.appendChild(s);
}else{
  callback();
}
`.trim();
  }

  /**
   * Generate style loader code
   * @param {string} innerCode - Code to prepend
   * @param {string} styleUrl - URL of stylesheet to load
   * @param {boolean} loadOnce - Only load if not already present
   * @returns {string} Generated code
   */
  function generateStyleLoader(innerCode, styleUrl, loadOnce = false) {
    const id = `bookmarklet__style_${simpleHash(styleUrl)}`;

    return `${innerCode}
if(!${loadOnce}||!document.getElementById("${id}")){
  var link=document.createElement("link");
  ${loadOnce ? `link.id="${id}";` : ''}
  link.rel="stylesheet";
  link.href="${escapeQuotes(styleUrl)}";
  document.body.appendChild(link);
}`;
  }

  // ============ Main Parser ============

  /**
   * Parse metadata block from bookmarklet code
   * @param {string} code
   * @returns {{code: string, options: Object, errors: string[]|null}}
   */
  function parseMetadataBlock(code) {
    const OPEN_TAG = '==Bookmarklet==';
    const CLOSE_TAG = '==/Bookmarklet==';
    const COMMENT_REGEX = /^(\s*\/\/\s*)/;

    let inMetadataBlock = false;
    const options = {};
    const cleanCode = [];
    const errors = [];

    const lines = code.split(/\r?\n/);

    lines.forEach((line, i) => {
      // Check for comment lines
      if (COMMENT_REGEX.test(line)) {
        const comment = line.replace(COMMENT_REGEX, '').trim();
        const canonicalComment = comment.toLowerCase().replace(/\s+/g, '');

        if (!inMetadataBlock) {
          // Look for opening tag
          if (canonicalComment === OPEN_TAG.toLowerCase().replace(/\s+/g, '')) {
            inMetadataBlock = true;
            return; // Don't include this line in output
          }
        } else {
          // Look for closing tag
          if (canonicalComment === CLOSE_TAG.toLowerCase().replace(/\s+/g, '')) {
            inMetadataBlock = false;
            return; // Don't include this line in output
          }

          // Parse metadata line
          const match = comment.match(/^@(\w+)\s+(.*)$/);
          if (match) {
            const key = match[1].toLowerCase();
            const value = match[2].trim();

            if (METADATA_KEYS[key]) {
              if (METADATA_KEYS[key] === METADATA_TYPES.LIST) {
                options[key] = options[key] || [];
                options[key].push(value);
              } else if (METADATA_KEYS[key] === METADATA_TYPES.BOOLEAN) {
                options[key] = value.toLowerCase() === 'true';
              } else {
                options[key] = value;
              }
            }
          }
          return; // Don't include metadata lines in output
        }

        // Regular comment outside metadata block
        cleanCode.push(line);
      } else {
        // Non-comment line
        cleanCode.push(line);
      }

      // Check for unclosed metadata block
      if (inMetadataBlock && i === lines.length - 1) {
        errors.push(`Missing metadata block closing '${CLOSE_TAG}'`);
      }
    });

    return {
      code: cleanCode.join('\n').trim(),
      options,
      errors: errors.length > 0 ? errors : null
    };
  }

  /**
   * Generate bookmarklet URL from code and options
   * @param {string} code - JavaScript code
   * @param {Object} options - Metadata options (may include script, style arrays)
   * @returns {string} Bookmarklet URL (javascript:...)
   */
  function generateBookmarklet(code, options = {}) {
    let result = code;

    // Process external scripts (in reverse order for proper callback nesting)
    if (options.script && options.script.length > 0) {
      const scripts = [...options.script].reverse();
      for (const scriptEntry of scripts) {
        const { path, options: scriptOpts } = extractOptions(scriptEntry);
        result = generateScriptLoader(result, path, scriptOpts.loadOnce || false);
      }
    }

    // Process external styles
    if (options.style && options.style.length > 0) {
      for (const styleEntry of options.style) {
        const { path, options: styleOpts } = extractOptions(styleEntry);
        result = generateStyleLoader(result, path, styleOpts.loadOnce || false);
      }
    }

    // Wrap in IIFE
    result = `(function(){${result}})()`;

    // Encode and return
    return `javascript:${encodeURIComponent(result)}`;
  }

  /**
   * Parse code with metadata block and generate bookmarklet URL
   * @param {string} rawCode - Raw code with potential metadata block
   * @returns {{url: string, options: Object, errors: string[]|null}}
   */
  function parseAndGenerate(rawCode) {
    const { code, options, errors } = parseMetadataBlock(rawCode);
    const url = generateBookmarklet(code, options);
    return { url, options, errors };
  }

  // ============ Minification ============

  /**
   * Basic minification (browser-compatible, no external dependencies)
   * @param {string} code
   * @returns {string} Minified code
   */
  function minify(code) {
    // Remove single-line comments (but not in strings)
    // This is a simple approach that may not handle all edge cases
    let result = code;

    // Remove multi-line comments
    result = result.replace(/\/\*[\s\S]*?\*\//g, '');

    // Remove single-line comments (careful with URLs)
    result = result.replace(/(?<!:)\/\/[^\n]*/g, '');

    // Collapse whitespace
    result = result.replace(/\s+/g, ' ');

    // Remove whitespace around operators
    result = result.replace(/\s*([{}();,=+\-*/<>!&|])\s*/g, '$1');

    // Remove leading/trailing whitespace
    result = result.trim();

    return result;
  }

  // ============ Templates ============

  /**
   * Get example bookmarklet templates
   * @returns {Object[]} Array of template objects
   */
  function getTemplates() {
    return [
      {
        name: 'Submit to Reddit',
        description: 'Submit current page to a subreddit',
        code: `// ==Bookmarklet==
// @name Submit to Reddit
// @description Submit current page URL to Reddit
// ==/Bookmarklet==

var url = document.URL;
var title = document.title;
var subreddit = prompt("Enter subreddit:", "");
if (subreddit) {
  window.open("https://www.reddit.com/r/" + subreddit + "/submit?title=" + encodeURIComponent(title) + "&url=" + encodeURIComponent(url));
}`
      },
      {
        name: 'Copy Markdown Link',
        description: 'Copy current page as markdown link',
        code: `// ==Bookmarklet==
// @name Copy Markdown Link
// @description Copy page title and URL as markdown link
// ==/Bookmarklet==

var md = "[" + document.title + "](" + document.URL + ")";
navigator.clipboard.writeText(md).then(function() {
  alert("Copied: " + md);
});`
      },
      {
        name: 'Inject CSS',
        description: 'Inject a CSS stylesheet URL',
        code: `// ==Bookmarklet==
// @name Inject CSS
// @description Inject external CSS stylesheet
// ==/Bookmarklet==

var url = prompt("CSS URL:", "");
if (url) {
  var link = document.createElement("link");
  link.href = url;
  link.type = "text/css";
  link.rel = "stylesheet";
  document.head.appendChild(link);
}`
      },
      {
        name: 'Web Archive',
        description: 'Open current page in Wayback Machine',
        code: `// ==Bookmarklet==
// @name Web Archive
// @description Open page in Wayback Machine
// ==/Bookmarklet==

window.location.href = "https://web.archive.org/web/*/" + document.URL;`
      },
      {
        name: 'Toggle Dark Mode',
        description: 'Quick dark mode toggle for any page',
        code: `// ==Bookmarklet==
// @name Toggle Dark Mode
// @description Toggle dark mode on any page
// ==/Bookmarklet==

(function() {
  var id = "bookmarklet-dark-mode";
  var existing = document.getElementById(id);
  if (existing) {
    existing.remove();
    return;
  }
  var style = document.createElement("style");
  style.id = id;
  style.textContent = "html { filter: invert(1) hue-rotate(180deg); } img, video, picture { filter: invert(1) hue-rotate(180deg); }";
  document.head.appendChild(style);
})();`
      },
      {
        name: 'With jQuery',
        description: 'Example using external jQuery',
        code: `// ==Bookmarklet==
// @name With jQuery
// @description Example loading jQuery
// @script !loadOnce https://code.jquery.com/jquery-3.6.0.min.js
// ==/Bookmarklet==

var $ = jQuery.noConflict(true);
$("a").css("color", "red");
alert("Found " + $("a").length + " links!");`
      },
      {
        name: 'Highlight Links',
        description: 'Highlight all links on the page',
        code: `// ==Bookmarklet==
// @name Highlight Links
// @description Highlight all links with a border
// ==/Bookmarklet==

document.querySelectorAll("a").forEach(function(a) {
  a.style.outline = "2px solid red";
  a.style.backgroundColor = "yellow";
});`
      },
      {
        name: 'Show Images',
        description: 'Display all images in a grid',
        code: `// ==Bookmarklet==
// @name Show Images
// @description Show all page images in an overlay
// ==/Bookmarklet==

var imgs = Array.from(document.images).filter(function(img) {
  return img.naturalWidth > 100 && img.naturalHeight > 100;
});
var overlay = document.createElement("div");
overlay.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.9);overflow:auto;z-index:99999;padding:20px;display:flex;flex-wrap:wrap;gap:10px;";
overlay.onclick = function() { overlay.remove(); };
imgs.forEach(function(img) {
  var clone = img.cloneNode();
  clone.style.cssText = "max-width:200px;max-height:200px;object-fit:contain;cursor:pointer;";
  clone.onclick = function(e) { e.stopPropagation(); window.open(img.src); };
  overlay.appendChild(clone);
});
document.body.appendChild(overlay);`
      }
    ];
  }

  // ============ Export ============

  const BookmarkletParser = {
    // Types
    METADATA_TYPES,
    METADATA_KEYS,

    // Utilities
    simpleHash,
    escapeQuotes,
    extractOptions,

    // Code generators
    generateScriptLoader,
    generateStyleLoader,

    // Main functions
    parseMetadataBlock,
    generateBookmarklet,
    parseAndGenerate,

    // Minification
    minify,

    // Templates
    getTemplates
  };

  // Export for different environments
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = BookmarkletParser;
  } else if (typeof define === 'function' && define.amd) {
    define([], function() { return BookmarkletParser; });
  } else {
    global.BookmarkletParser = BookmarkletParser;
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
