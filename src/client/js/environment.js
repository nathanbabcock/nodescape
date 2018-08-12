const nodescape_environment = 'development';
// const nodescape_environment = 'development';

// Node
if(typeof module !== "undefined")
    module.exports = nodescape_environment;

// Browser
if (typeof window === "object")
    window.nodescape_environment = nodescape_environment;
