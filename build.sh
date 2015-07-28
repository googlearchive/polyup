# TODO(rictic): replace with gulp or broccoli or whatevs

set -e

babel lib/browser_main.js -o dist/browser_main.js
babel lib/element_mapping.js -o dist/element_mapping.js
babel lib/node_main.js -o dist/node_main.js
babel lib/upgrade_css.js -o dist/upgrade_css.js
babel lib/upgrade_html.js -o dist/upgrade_html.js
babel lib/upgrade_js.js -o dist/upgrade_js.js
