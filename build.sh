# TODO(rictic): replace with gulp or broccoli or whatevs

set -e

./node_modules/.bin/babel lib/browser_main.js -o dist/browser_main.js
./node_modules/.bin/babel lib/element_mapping.js -o dist/element_mapping.js
./node_modules/.bin/babel lib/node_main.js -o dist/node_main.js
./node_modules/.bin/babel lib/upgrade_css.js -o dist/upgrade_css.js
./node_modules/.bin/babel lib/upgrade_html.js -o dist/upgrade_html.js
./node_modules/.bin/babel lib/upgrade_js.js -o dist/upgrade_js.js
