/**
 * @license
 * Copyright (c) 2015 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */
'use strict';

module.exports = {
  'context-free-parser': {
    notice: 'This element has been superseded by the hydrolisis ' + 'javascript library'
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
    notice: 'This element no longer extracts element metadata itself, ' + 'it expects you to use the hydrolisis library to do so.'
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
    name: 'iron-dropdown',
    attributes: {
      'halign': 'horizontal-align',
      'valign': 'vertical-align',
      'relatedtarget': 'position-target'
    }
  },
  'core-dropdown-menu': {
    noReplacement: true
  },
  'core-elements': {
    name: 'iron-elments',
    // Some core-elements got moved into paper-elements, so we must import
    // them as well.
    additionalImports: ['paper-elements/paper-elements.html'],
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
    name: 'paper-icon-button'
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
        notice: 'The `load` attribute was inverted and renamed ' + 'to prevent-load. polyup has renamed it here, but you must ' + 'invert your expression.'
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
        notice: 'committedValue was removed from core-input. bind-value will ' + 'fire for every change, not just ones that have been ' + '\'committed\' by the user.'
      },
      'preventinvalidinput': 'prevent-invalid-input'
    }
  },
  'core-item': {
    name: 'paper-item',
    attributes: {
      'label': {
        notice: 'core-item has been redesigned to be more customizable. ' + 'Look into paper-item and paper-item-body.'
      },
      'icon': {
        notice: 'core-item has been redesigned to be more customizable. ' + 'Look into paper-item and paper-item-body.'
      },
      'src': {
        notice: 'core-item has been redesigned to be more customizable. ' + 'Look into paper-item and paper-item-body.'
      }
    }
  },
  'core-label': {
    noReplacement: true
  },
  'core-layout-grid': {
    noReplacement: true
  },
  'core-layout-trbl': {
    noReplacement: true
  },
  'core-list': {
    name: 'iron-list',
    notice: 'iron-list databinding has changed to be more like dom-repeat. ' + 'The bindings here are probably broken, but can likely be fixed ' + 'by adding the attribute `as="model"` onto iron-list. ' + 'In addition, iron-list no longer tracks selection.'
  },
  'core-localstorage': {
    name: 'iron-localstorage',
    notice: 'Warning: do not pass subproperty bindings to iron-localstorage ' + 'until https://github.com/Polymer/polymer/issues/1550 is ' + 'resolved. Local storage will be blown away. No ' + '`<iron-localstorage value="{{foo.bar}}"`.',
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
        notice: 'When multi is true, instead of the `selected` and ' + '`selectedItem` attributes, `selectedValues` and ' + '`selectedItems` are used.'
      }
    }
  },
  'core-menu-button': {
    name: 'paper-menu-button'
  },
  'core-meta': {
    name: 'iron-meta',
    notice: 'core-meta was significantly redesigned in the transition to ' + 'iron-meta. See: https://github.com/PolymerElements/iron-meta'
  },
  'core-overlay': {
    name: 'iron-overlay-behavior',
    reimplementedAsBehavior: 'Polymer.IronOverlayBehavior'
  },
  'core-pages': {
    name: 'iron-pages',
    mixins: ['core-selector', 'core-resizable']
  },
  'core-range': {
    name: 'iron-range-behavior',
    reimplementedAsBehavior: 'Polymer.IronRangeBehavior'
  },
  'core-resizable': {
    name: 'iron-resizable-behavior',
    reimplementedAsBehavior: 'Polymer.IronResizableBehavior'
  },
  'core-scaffold': {
    noReplacement: true
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
    name: 'iron-selector',
    attributes: {
      'valueattr': 'attr-for-selected',
      'selectedclass': 'selected-class',
      'selecteditem': 'selected-item',
      'selectedattribute': 'selected-attribute',
      'excludedlocalnames': {
        name: 'selectable',
        notice: 'excludedLocalNames was renamed to selectable, and is now ' + 'a CSS selector rather than a space-separated set of ' + 'element types.'
      }
    },
    deprecatedAttributes: ['selectedproperty', 'selectedmodel', 'selectedindex', 'target', 'itemsselector', 'activateevent', 'notap']
  },
  'core-shared-lib': {
    name: 'iron-jsonp-library',
    reimplementedAsBehavior: 'Polymer.IronJsonpLibraryBehavior',
    attributes: {
      'url': 'library-url',
      'callbackname': 'callback-name',
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
    notice: 'Polymer 1.0 has a much better solution for styling elements ' + 'and theming than core-style. The new solution uses ' + 'CSS Variables. See: https://www.polymer-project.org/1.0/' + 'docs/devguide/styling.html#xscope-styling-details'
  },
  'core-submenu': {
    noReplacement: true
  },
  'core-toolbar': {
    name: 'paper-toolbar',
    attributes: {
      'middleJustify': 'middle-justify',
      'bottomJustify': 'bottom-justify'
    }
  },
  'core-tooltip': {
    name: 'paper-tooltip',
    notice: 'Whereas core-tooltip was intended to contain the element it ' + 'decorated, paper-tooltip decorates its parent, or with the ' + '`for` attribute, its sibling. TODO(polyup): move the tooltip\'s ' + 'label into the body of the <paper-tooltip>, and the decorated ' + 'element out.',
    deprecatedAttributes: ['label', 'show', 'position', 'noarrow', 'tipAttribute']
  },
  'core-transition': {
    name: 'neon-animation-behavior',
    dirname: 'neon-animation',
    reimplementedAsBehavior: 'Polymer.NeonAnimationBehavior'
  },

  'paper-button': {
    deprecatedAttributes: ['recenteringtouch', 'fill']
  },
  'paper-checkbox': {
    deprecatedAttributes: ['label']
  },
  'paper-dialog': {
    // I'm not confident that this is right
    attributes: {
      'autoclosedisabled': 'no-cancel-on-outside-click',
      'autofocusdisabled': 'no-auto-focus',
      'backdrop': 'with-backdrop'
    },
    deprecatedAttributes: ['heading', 'layered', 'target', 'sizingtarget', 'closeattribute', 'closeselector', 'transition']
  },
  'paper-dropdown': {
    name: 'iron-dropdown',
    attributes: {
      'halign': 'horizontal-align',
      'valign': 'vertical-align',
      'relatedtarget': 'position-target'
    },
    notice: 'May need to add a paper-material wrapper to replicate the ' + 'paper-dropdown look and feel, depending on whether another ' + 'element like paper-menu-button is wrapping this one.'
  },
  'paper-dropdown-menu': {
    noReplacement: true
  },
  'paper-elements': {},
  'paper-fab': {
    deprecatedAttributes: ['raised', 'recenteringtouch', 'fill']
  },
  'paper-icon-button': {
    deprecatedAttributes: ['recenteringtouch', 'fill']
  },
  'paper-input': {
    attributes: {
      'floatinglabel': 'always-float-label'
    },
    deprecatedAttributes: ['committedvalue']
  },
  'paper-item': {
    // nothing to do
  },
  'paper-menu-button': {
    // nothing to do
  },
  'paper-progress': {
    deprecatedAttributes: ['step']
  },
  'paper-radio-button': {
    deprecatedAttributes: ['label']
  },
  'paper-radio-group': {
    mixins: ['core-selector']
  },
  'paper-ripple': {
    deprecatedAttributes: ['backgroundfill', 'pixeldensity']
  },
  'paper-shadow': {
    name: 'paper-material',
    attributes: {
      'z': 'elevation'
    }
  },
  'paper-slider': {
    attributes: {
      'secondaryprogress': 'secondary-progress',
      'maxmarkers': 'max-markers'
    }
  },
  'paper-spinner': {
    // nothing to do
  },
  'paper-tabs': {
    attributes: {
      'nobar': 'no-bar',
      'noslide': 'no-slide',
      'disabledrag': 'disable-drag',
      'hidescrollbuttons': 'hide-scroll-buttons',
      'alignbottom': 'align-bottom'
    }
  },
  'paper-toast': {
    attributes: {
      'opened': 'visible'
    },
    deprecatedAttributes: ['responsivewidth', 'swipedisabled', 'autoclosedisabled', 'narrowmode']
  },
  'paper-toggle-button': {},

  'Polymer.CoreSelection': {
    name: 'Polymer.IronSelection',
    elementName: 'core-selection'
  },
  'Polymer.CoreResizable': {
    name: 'Polymer.IronResizableBehavior',
    elementName: 'core-resizable'
  }
};
