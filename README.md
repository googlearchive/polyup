# polyup

### Automates the boring parts of migrating your code from Polymer 0.5 to 1.0.

The change from Polymer 0.5 to 1.0 is a large one, as many things changed as we
transitioned from an exploratory beta releases to a stable production-ready
product.

Fortunately many of these changes can be done automatically. `polyup` will
parse your HTML and any javascript in either inline or external scripts and
perform a number of automatic transformations to your code.

## Usage

The command

    polyup photo-lightbox.html

will parse and transform photo-lightbox and any linked javascript that `polyup`
can find and then print the transformed code back out onto the command line.

If that looks good, then you can run `polyup` with the `--overwrite` option to
overwrite your code on disk with the upgraded version. Make sure that you've
got your code checked into source control first, as this will in effect delete
the v0.5 version of your code!

## Installation

`polyup` is available on npm. We recommend installing `polyup` globally.

    npm install -g polyup

This will install `polyup` to the bin directory configured when node was
installed. (e.g. `/usr/local/bin/polyup`).  You may need `sudo`
for this step.

## Reporting Bugs

`polyup` is still in active development and it definitely has bugs. However,
given that so many people are looking at migrating to 1.0 right now we thought
that it was better to get what we have now out there now, even if it won't be
right for everyone.
