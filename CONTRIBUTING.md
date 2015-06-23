`polyup` is open source software! Want to change something? Fork the repo and send us a pull request!

When reading the code for the first time, I recommend starting at
lib/upgrade_html.js and then flow through into lib/upgrade_js.js and expand out
from there.

## Filing Bugs

By far the easiest way to contribute to `polyup` is to file bugs. For most issues, the most helpful bug reports will answer the questions:

* What input did you provide?
* What output did you see?
* What output did you expect?

[This is a good simple template to file your bugs with.](https://github.com/PolymerLabs/polyup/issues/new?&body=I%20ran%20polyup%20on%20this%20code:%0A%0A%3Cpolymer-element%20name=%27your-code-here%27%20noscript%3E%3C/polymer-element%3E%0A%0A%0AThe%20output%20was%20wrong%20because:%0A%0A%5Be.g.%20it%20crashed,%20it%20was%20invalid,%20it%20included%20this%20mistake,%20it%20ate%20my%20comments,%20etc%5D)

## What counts as a bug?

`polyup` won't get everything right. There are tons of ways to write HTML and
Javascript – some of them terribly clever – and `polyup` is just aiming for the
sweet spot of upgrading fairly simple and straightforward code. The advantage
of this tradeoff is that it's simpler and more capable.

### Good Bugs:

    ✓ polyup deleted my comments!
    ✓ polyup doesn't handle a <template repeat> inside of a <template if> correctly.
    ✓ polyup didn't move the attributes for this code into the published block.

### Bugs We Probably Won't Fix:

    ✗ polyup changed my code's whitespace and quote mark style.

        Sorry! polyup works at the abstract syntax tree level, and some
        information is lost in translation!

    ✗ polyup doesn't upgrade my Polymer element factory generator.

        polyup isn't a full static analysis system, it only looks at the
        rough shape of your source code and doesn't track values across
        references or other similarly complex bookkeeping
