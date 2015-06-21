'use strict';

module.exports = {
  'context-free-parser': {
    notice: 'This element has been superseded by the hydrolisis ' +
            'javascript library'
  },
  'core-a11y-keys': {
    name: 'iron-a11y-keys'
  },
  'core-ajax': {
    name: 'iron-ajax',
    attributes: {
      'handleas': 'handle-as',
      'response': 'last-response',
      'error': 'last-error'
    },
    deprecatedAttributes: ['progress']
  },
  'core-animated-pages': {
    name: 'neon-animated-pages',
    dirname: 'neon-animation',
    notice: 'This element\'s API has changed significantly.'
    // needs more doc
  },
  'core-animation': {
    name: 'neon-animation',
    notice: 'This element\'s API has changed significantly.'
    // needs more doc
  },
  'core-collapse': {
    name: 'iron-collapse',
    deprecatedAttributes: ['target', 'duration', 'fixedsize', 'allowoverflow']
  },
  'core-component-page': {
    name: 'iron-component-page',
    attributes: {
      'sources': 'src',
      'moduleName': 'active'
    }
  },
  'core-doc-viewer': {
    name: 'iron-doc-viewer',
    notice: 'This element no longer extracts element metadata itself, ' +
            'it expects you to use the hydrolisis library to do so.'
  },
  'core-drag-drop': {
    noReplacement: true
  },
  'core-drawer-panel': {
    name: 'paper-drawer-panel',
    attributes: {
      'drawerwidth': 'drawer-width',
      'responsivewidth': 'responsive-width',
      'defaultselected': 'default-selected',
      'rightdrawer': 'right-drawer',
      'disableswipe': 'disable-swipe',
      'forcenarrow': 'force-narrow',
      'disableedgeswipe': 'disable-edge-swipe'
    }
  },
  'core-dropdown': {
    noReplacement: true
  },
  'core-dropdown-menu': {
    noReplacement: true
  },
  'core-elements': {
    name: 'iron-elments',
    // Some core-elements got moved into paper-elements, so we must import
    // them as well.
    additionalImports: [
      'paper-elements/paper-elements.html'
    ]
    elementName: null
  },
  'core-field': {
    noReplacement: true
  },
  'core-focusable': {
    noReplacement: true
  },
  'core-header-panel': {
    name: 'paper-header-panel'
  },
  'core-icon': {
    name: 'iron-icon',
    deprecatedAttributes: ['alt']
  },
  'core-icon-button': {
    name: 'paper-icon-button',
    deprecatedAttributes: ['active']
  },
  'core-icons': {
    name: 'iron-icons'
  },
  'core-iconset': {
    name: 'iron-iconset',
    attributes: {
      'iconsize': 'size'
    }
  },
  'core-iconset-svg': {
    name: 'iron-iconset-svg',
    attributes: {
      'iconsize': 'size'
    }
  },
  'core-image': {
    name: 'iron-image',
    attributes: {
      'load': {
        name: 'prevent-load',
        notice: 'The `load` attribute was inverted and renamed '
                'to prevent-load. polyup has renamed it here, but you must ' +
                'invert your expression.',
      }
    },
    deprecatedAttributes: ['role']
  },
  'core-input': {
    name: 'iron-input',
    attributes: {
      'value': 'bind-value',
      'committedvalue': {
        name: 'bind-value',
        notice: 'committedValue was removed from core-input. bind-value will ' +
                'fire for every change, not just ones that have been ' +
                '\'committed\' by the user.'
      },
      'preventinvalidinput': 'prevent-invalid-input'
    }
  },
  'core-item': {
    name: 'paper-item',
    attributes: {
      'label': {
        notice: 'core-item has been redesigned to be more customizable. ' +
                'Look into paper-item and paper-item-body.'
      },
      'icon': {
        notice: 'core-item has been redesigned to be more customizable. ' +
                'Look into paper-item and paper-item-body.'
      },
      'src': {
        notice: 'core-item has been redesigned to be more customizable. ' +
                'Look into paper-item and paper-item-body.'
      }
    }
  },
  'core-label': {
    noReplacement: true
  },
  'core-layout-grid': {
    noReplacement: true,
  },
  'core-layout-trbl': {
    noReplacement: true,
  },
  'core-list': {
    noReplacement: true,
  },
  'core-localstorage': {
    name: 'iron-localstorage',
    notice: 'Warning: do not pass subproperty bindings to iron-localstorage ' +
            'until https://github.com/Polymer/polymer/issues/1550 is ' +
            'resolved. Local storage will be blown away. No ' +
            '`<iron-localstorage value="{{foo.bar}}"`.'
    attributes: {
      'useraw': 'use-raw',
      'autosavedisabled': 'auto-save-disabled'
    }
  },
  'core-media-query': {
    name: 'iron-media-query',
    attributes: {
      'querymatches': 'query-matches'
    }
  },
  'core-menu': {
    name: 'paper-menu',
    notice: 'The class .core-selected has been renamed to .iron-selected',
    mixins: ['core-selector'],
    attributes: {
      'multi': {
        notice: 'When multi is true, instead of the `selected` and ' +
                '`selectedItem` attributes, `selectedValues` and ' +
                '`selectedItems` are used.'
      },
    },
  },
  'core-menu-button': {
    noReplacement: true,
  },
  'core-meta': {
    name: 'iron-meta',
    notice: 'core-meta was significantly redesigned in the transition to ' +
            'iron-meta. See: https://github.com/PolymerElements/iron-meta'
  },
  'core-overlay': {
    name: 'iron-overlay-behavior',
    reimplementedAsBehavior: 'Polymer.IronOverlayBehavior',
  },
  'core-pages': {
    name: 'iron-pages',
    mixins: ['core-selector', 'core-resizable']
  },
  'core-range': {
    name: 'iron-range-behavior',
    reimplementedAsBehavior: 'Polymer.IronRangeBehavior',
  },
  'core-resizable': {
    name: 'iron-resizable-behavior',
    reimplementedAsBehavior: 'Polymer.IronResizableBehavior',
  },
  'core-scaffold': {
    noReplacement: true,
  },
  'core-scroll-header-panel': {
    name: 'paper-scroll-header-panel',
    mixins: ['core-resizable'],
    attributes: {
      'nodissolve': 'no-dissolve',
      'noreveal': 'no-reveal',
      'keepcondensedheader': 'keep-condensed-header',
      'headerheight': 'header-height',
      'condensedheaderheight': 'condensed-header-height',
      'scrollawaytopbar': 'scroll-away-topbar'
    }
  },
  'core-scroll-threshold': {
    noReplacement: true
  },
  'core-selection': {
    name: 'iron-selection',
    dirname: 'iron-selector',
    reimplementedAsBehavior: 'Polymer.IronSelection',
    deprecatedAttributes: ['multi']
  },
  'core-selector': {
    name: 'iron-selector' // ?
    attributes: {
      'valueattr': 'attr-for-selected',
      'selectedclass': 'selected-class',
      'selecteditem': 'selected-item',
      'selectedattribute': 'selected-attribute',
      'excludedlocalnames': {
        name: 'selectable',
        notice: 'excludedLocalNames was renamed to selectable, and is now ' +
                'a CSS selector rather than a space-separated set of ' +
                'element types.'
      }
    },
    deprecatedAttributes: [
        'selectedproperty', 'selectedmodel', 'selectedindex', 'target',
        'itemsselector', 'activateevent', 'notap']
  },
  'core-shared-lib': {
    name: 'iron-jsonp-library',
    reimplementedAsBehavior: 'Polymer.IronJsonpLibraryBehavior',
    attributes: {
      'url': 'library-url',
      'callbackname': 'callback-name'
      'notifyevent': 'notify-event'
    }
  },
  'core-signals': {
    name: 'iron-signals'
  },
  'core-splitter': {
    noReplacement: true
  },
  'core-style': {
    notice: 'Polymer 1.0 has a much better solution for styling elements ' +
            'and theming than core-style. The new solution uses ' +
            'CSS Variables. See: https://www.polymer-project.org/1.0/' +
            'docs/devguide/styling.html#xscope-styling-details'
  },
  'core-toolbar': {
    name: 'paper-toolbar',
    attributes: {
      'middleJustify': 'middle-justify',
      'bottomJustify': 'bottom-justify'
    }
  },
  'core-tooltip': {
    noReplacement: true
  },
  'core-transition': {
    name: 'neon-animation-behavior',
    dirname: 'neon-animation',
    reimplementedAsBehavior: 'Polymer.NeonAnimationBehavior'
  },

  // TODO:
  'paper-button': {
  },
  'paper-checkbox': {
  },
  'paper-dialog': {
  },
  'paper-dropdown': {
  },
  'paper-dropdown-menu': {
  },
  'paper-elements': {
  },
  'paper-fab': {
  },
  'paper-icon-button': {
  },
  'paper-input': {
  },
  'paper-item': {
  },
  'paper-menu-button': {
  },
  'paper-progress': {
  },
  'paper-radio-button': {
  },
  'paper-radio-group': {
  },
  'paper-ripple': {
  },
  'paper-shadow': {
  },
  'paper-slider': {
  },
  'paper-spinner': {
  },
  'paper-tabs': {
  },
  'paper-toast': {
  },
  'paper-toggle-button': {
  },

  'Polymer.CoreResizable': {
    name: 'Polymer.IronSelection',
    elementName: 'core-resizable'
  },
  'Polymer.CoreSelection': {
    name: 'Polymer.IronSelection',
    elementName: 'core-selection'
  },
  'Polymer.CoreResizable': {
    name: 'Polymer.IronResizableBehavior',
    elementName: 'core-resizable'
  },
};
