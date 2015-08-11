set -e

npm run browserify
mv dist/browser_package.js dist/temp_browser_package.js
git checkout gh-pages
mv dist/temp_browser_package.js dist/browser_package.js
git add dist/browser_package.js
git commit -m 'Update browser package'
git push origin gh-pages
git checkout master
