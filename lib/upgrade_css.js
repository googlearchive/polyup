var cssMixinsUpgrades = {
    '[layout]': '--layout',
    '[layout][horizontal]': '--layout-horizontal',
    '[layout][inline]': '--layout-inline',
    '[layout][horizontal][reverse]': '--layout-horizontal-reverse',
    '[layout][vertical]': '--layout-vertical',
    '[layout][vertical][reverse]': '--layout-vertical-reverse',
    '[layout][wrap]': '--layout-wrap',
    '[layout][wrap][reverse]': '--layout-wrap-reverse',
    '[layout][flex][auto]': '--layout-flex-auto',
    '[layout][flex][none]': '--layout-flex-none',
    '[layout][flex]': '--layout-flex',
    '[layout][flex][one]': '--layout-flex',
    '[layout][flex][two]': '--layout-flex-2',
    '[layout][flex][three]': '--layout-flex-3',
    '[layout][flex][four]': '--layout-flex-4',
    '[layout][flex][five]': '--layout-flex-5',
    '[layout][flex][six]': '--layout-flex-6',
    '[layout][flex][seven]': '--layout-flex-7',
    '[layout][flex][eight]': '--layout-flex-8',
    '[layout][flex][nine]': '--layout-flex-9',
    '[layout][flex][ten]': '--layout-flex-10',
    '[layout][flex][eleven]': '--layout-flex-11',
    '[layout][flex][twelve]': '--layout-flex-12',
    '[layout][start]': '--layout-start',
    '[layout][center]': '--layout-center',
    '[layout][end]': '--layout-end',
    '[layout][start-justified]': '--layout-start-justified',
    '[layout][center-justified]': '--layout-center-justified',
    '[layout][end-justified]': '--layout-end-justified',
    '[layout][around-justified]': '--layout-around-justified',
    '[layout][justified]': '--layout-justified',
    '[layout][center-center]': '--layout-center-center',
    '[self-start]': '--layout-self-start',
    '[self-center]': '--layout-self-center',
    '[self-end]': '--layout-self-end',
    '[self-stretch]': '--layout-self-stretch',
    '[block]': '--layout-block',
    '[invisible]': '--layout-invisible',
    '[relative]': '--layout-relative',
    '[fit]': '--layout-fit',
    '[scroll]': '--layout-scroll',
};

var otherCssUpgrades = {
    '[hidden]': 'display: none !important;',
    '[relative]': 'position: relative;',
    '[fit]': 'position: absolute;\ntop: 0;\nright: 0;\nbottom: 0;\nleft: 0;',
    '[fullbleed]': 'margin: 0;\nheight:100vh;'
};

var needsUpgradeQuerySelector = Object.keys(cssMixinsUpgrades).concat(
    Object.keys(otherCssUpgrades)).join(', ');

function getCssRulesNeededToUpgrade(cheerioElement) {
    var cssRules = {};
    for (var querySelector in cssMixinsUpgrades) {
      if (cheerioElement.is(querySelector)) {
        cssRules[querySelector] = '{\n      @apply(' +
            cssMixinsUpgrades[querySelector] + ');\n    }';
      }
    }
    for (querySelector in otherCssUpgrades) {
      if (cheerioElement.is(querySelector)) {
        cssRules[querySelector] = '{\n      ' +
            otherCssUpgrades[querySelector].replace(/\n/g, '\n      ') +
            '\n    }';
      }
    }
    return cssRules;
  }

module.exports = {
  needsUpgradeQuerySelector: needsUpgradeQuerySelector,
  getCssRulesNeededToUpgrade: getCssRulesNeededToUpgrade
};
