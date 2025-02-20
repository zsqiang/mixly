/**
 * @license
 * Visual Blocks Editor
 *
 * Copyright 2011 Google Inc.
 * https://developers.google.com/blockly/
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @fileoverview Core JavaScript library for Blockly.
 * @author fraser@google.com (Neil Fraser)
 */
'use strict';

/**
 * The top level namespace used to access the Blockly library.
 * @namespace Blockly
 **/
goog.provide('Blockly');

goog.require('Blockly.BlockSvg.render');
goog.require('Blockly.Events');
goog.require('Blockly.FieldAngle');
goog.require('Blockly.FieldCheckbox');
goog.require('Blockly.FieldColour');
// Date picker commented out since it increases footprint by 60%.
// Add it only if you need it.
//goog.require('Blockly.FieldDate');
goog.require('Blockly.FieldDropdown');
goog.require('Blockly.FieldImage');
goog.require('Blockly.FieldTextInput');
goog.require('Blockly.FieldTextArea');
goog.require('Blockly.FieldNumber');
goog.require('Blockly.FieldVariable');
goog.require('Blockly.Generator');
goog.require('Blockly.Msg');
goog.require('Blockly.Procedures');
goog.require('Blockly.Toolbox');
goog.require('Blockly.Touch');
goog.require('Blockly.WidgetDiv');
goog.require('Blockly.WorkspaceSvg');
goog.require('Blockly.constants');
goog.require('Blockly.inject');
goog.require('Blockly.utils');
goog.require('goog.color');
goog.require('goog.userAgent');


// Turn off debugging when compiled.
var CLOSURE_DEFINES = {'goog.DEBUG': false};

/**
 * The main workspace most recently used.
 * Set by Blockly.WorkspaceSvg.prototype.markFocused
 * @type {Blockly.Workspace}
 */
Blockly.mainWorkspace = null;

/**
 * Currently selected block.
 * @type {Blockly.Block}
 */
Blockly.selected = null;

/**
 * Currently highlighted connection (during a drag).
 * @type {Blockly.Connection}
 * @private
 */
Blockly.highlightedConnection_ = null;

/**
 * Connection on dragged block that matches the highlighted connection.
 * @type {Blockly.Connection}
 * @private
 */
Blockly.localConnection_ = null;

/**
 * All of the connections on blocks that are currently being dragged.
 * @type {!Array.<!Blockly.Connection>}
 * @private
 */
Blockly.draggingConnections_ = [];

/**
 * Contents of the local clipboard.
 * @type {Element}
 * @private
 */
Blockly.clipboardXml_ = null;

/**
 * Source of the local clipboard.
 * @type {Blockly.WorkspaceSvg}
 * @private
 */
Blockly.clipboardSource_ = null;

/**
 * Is the mouse dragging a block?
 * DRAG_NONE - No drag operation.
 * DRAG_STICKY - Still inside the sticky DRAG_RADIUS.
 * DRAG_FREE - Freely draggable.
 * @private
 */
Blockly.dragMode_ = Blockly.DRAG_NONE;

/**
 * Cached value for whether 3D is supported.
 * @type {!boolean}
 * @private
 */
Blockly.cache3dSupported_ = null;

/**
 * Convert a hue (HSV model) into an RGB hex triplet.
 * @param {number} hue Hue on a colour wheel (0-360).
 * @return {string} RGB code, e.g. '#5ba65b'.
 */
Blockly.hueToRgb = function(hue) {
  if(hue.toString().substring(0,1)=="#") {
    return hue;
  }
  return goog.color.hsvToHex(hue, Blockly.HSV_SATURATION,
      Blockly.HSV_VALUE * 255);
};

/**
 * Returns the dimensions of the specified SVG image.
 * @param {!Element} svg SVG image.
 * @return {!Object} Contains width and height properties.
 */
Blockly.svgSize = function(svg) {
  return {width: svg.cachedWidth_,
          height: svg.cachedHeight_};
};

/**
 * Size the workspace when the contents change.  This also updates
 * scrollbars accordingly.
 * @param {!Blockly.WorkspaceSvg} workspace The workspace to resize.
 */
Blockly.resizeSvgContents = function(workspace) {
  workspace.resizeContents();
};

/**
 * Size the SVG image to completely fill its container. Call this when the view
 * actually changes sizes (e.g. on a window resize/device orientation change).
 * See Blockly.resizeSvgContents to resize the workspace when the contents
 * change (e.g. when a block is added or removed).
 * Record the height/width of the SVG image.
 * @param {!Blockly.WorkspaceSvg} workspace Any workspace in the SVG.
 */
Blockly.svgResize = function(workspace) {
  var mainWorkspace = workspace;
  while (mainWorkspace.options.parentWorkspace) {
    mainWorkspace = mainWorkspace.options.parentWorkspace;
  }
  var svg = mainWorkspace.getParentSvg();
  var div = svg.parentNode;
  if (!div) {
    // Workspace deleted, or something.
    return;
  }
  var width = div.offsetWidth;
  var height = div.offsetHeight;
  if (svg.cachedWidth_ != width) {
    svg.setAttribute('width', width + 'px');
    svg.cachedWidth_ = width;
  }
  if (svg.cachedHeight_ != height) {
    svg.setAttribute('height', height + 'px');
    svg.cachedHeight_ = height;
  }
  mainWorkspace.resize();
};

/**
 * Handle a key-down on SVG drawing surface.
 * @param {!Event} e Key down event.
 * @private
 */
Blockly.onKeyDown_ = function(e) {
  if (Blockly.mainWorkspace.options.readOnly || Blockly.utils.isTargetInput(e)) {
    // No key actions on readonly workspaces.
    // When focused on an HTML text input widget, don't trap any keys.
    return;
  }
  var deleteBlock = false;
  if (e.keyCode == 27) {
    // Pressing esc closes the context menu.
    Blockly.hideChaff();
  } else if (e.keyCode == 8 || e.keyCode == 46) {
    // Delete or backspace.
    // Stop the browser from going back to the previous page.
    // Do this first to prevent an error in the delete code from resulting in
    // data loss.
    e.preventDefault();
    if (Blockly.selected && Blockly.selected.isDeletable()) {
      deleteBlock = true;
    }
  } else if ((e.altKey || e.ctrlKey || e.metaKey) && !e.shiftKey) {
    if (Blockly.selected &&
        Blockly.selected.isDeletable() && Blockly.selected.isMovable()) {
      if (e.keyCode == 67) {
        // 'c' for copy.
        Blockly.hideChaff();
        Blockly.copy_(Blockly.selected);
      } else if (e.keyCode == 88) {
        // 'x' for cut.
        Blockly.copy_(Blockly.selected);
        deleteBlock = true;
      }
    }
    if (e.keyCode == 86) {
      // 'v' for paste.
      if (Blockly.clipboardXml_) {
        Blockly.Events.setGroup(true);
        Blockly.clipboardSource_.paste(Blockly.clipboardXml_);
        Blockly.Events.setGroup(false);
      }
    } else if (e.keyCode == 90) {
      // 'z' for undo 'Z' is for redo.
      Blockly.hideChaff();
      Blockly.mainWorkspace.undo(e.shiftKey);
    } else if(e.keyCode == 89){
      // 'y' for redo
      Blockly.hideChaff();
      Blockly.mainWorkspace.undo(1);
    }
  }else if(e.shiftKey && e.ctrlKey){
     if (Blockly.selected &&
        Blockly.selected.isDeletable() && Blockly.selected.isMovable()) {
      if (e.keyCode == 67) {
        // 'c' for copy.
        try{
          var selectedXmlDom = Blockly.Xml.blockToDom(Blockly.selected);
          JSFuncs.saveToClipCache(Blockly.Xml.domToText(selectedXmlDom));  
        }catch(err){
        }
      } 
    }
    if (e.keyCode == 86) {
      // 'v' for paste.
      try{
        var cacheXml = JSFuncs.loadFromClipCache();
        var cacheDom = Blockly.Xml.textToDom(cacheXml);
        var cacheBlock = Blockly.Xml.domToBlock(cacheDom, Blockly.mainWorkspace);
      } catch(err){
      }
    } 
  }
  if (deleteBlock) {
    // Common code for delete and cut.
    Blockly.Events.setGroup(true);
    Blockly.hideChaff();
    var heal = Blockly.dragMode_ != Blockly.DRAG_FREE;
    Blockly.selected.dispose(heal, true);
    if (Blockly.highlightedConnection_) {
      Blockly.highlightedConnection_.unhighlight();
      Blockly.highlightedConnection_ = null;
    }
    Blockly.Events.setGroup(false);
  }
};

/**
 * Stop binding to the global mouseup and mousemove events.
 * @private
 */
Blockly.terminateDrag_ = function() {
  Blockly.BlockSvg.terminateDrag();
  Blockly.Flyout.terminateDrag_();
};

/**
 * Copy a block onto the local clipboard.
 * @param {!Blockly.Block} block Block to be copied.
 * @private
 */
Blockly.copy_ = function(block) {
  var xmlBlock = Blockly.Xml.blockToDom(block);
  if (Blockly.dragMode_ != Blockly.DRAG_FREE) {
    Blockly.Xml.deleteNext(xmlBlock);
  }
  // Encode start position in XML.
  var xy = block.getRelativeToSurfaceXY();
  xmlBlock.setAttribute('x', block.RTL ? -xy.x : xy.x);
  xmlBlock.setAttribute('y', xy.y);
  Blockly.clipboardXml_ = xmlBlock;
  Blockly.clipboardSource_ = block.workspace;
};

/**
 * Duplicate this block and its children.
 * @param {!Blockly.Block} block Block to be copied.
 * @private
 */
Blockly.duplicate_ = function(block) {
  // Save the clipboard.
  var clipboardXml = Blockly.clipboardXml_;
  var clipboardSource = Blockly.clipboardSource_;

  // Create a duplicate via a copy/paste operation.
  Blockly.copy_(block);
  block.workspace.paste(Blockly.clipboardXml_);

  // Restore the clipboard.
  Blockly.clipboardXml_ = clipboardXml;
  Blockly.clipboardSource_ = clipboardSource;
};

/**
 * Cancel the native context menu, unless the focus is on an HTML input widget.
 * @param {!Event} e Mouse down event.
 * @private
 */
Blockly.onContextMenu_ = function(e) {
  if (!Blockly.utils.isTargetInput(e)) {
    // When focused on an HTML text input widget, don't cancel the context menu.
    e.preventDefault();
  }
};

/**
 * Close tooltips, context menus, dropdown selections, etc.
 * @param {boolean=} opt_allowToolbox If true, don't close the toolbox.
 */
Blockly.hideChaff = function(opt_allowToolbox) {
  Blockly.Tooltip.hide();
  Blockly.WidgetDiv.hide();
  if (!opt_allowToolbox) {
    var workspace = Blockly.getMainWorkspace();
    if (workspace.toolbox_ &&
        workspace.toolbox_.flyout_ &&
        workspace.toolbox_.flyout_.autoClose) {
      workspace.toolbox_.clearSelection();
    }
  }
};

/**
 * When something in Blockly's workspace changes, call a function.
 * @param {!Function} func Function to call.
 * @return {!Array.<!Array>} Opaque data that can be passed to
 *     removeChangeListener.
 * @deprecated April 2015
 */
Blockly.addChangeListener = function(func) {
  // Backwards compatibility from before there could be multiple workspaces.
  console.warn('Deprecated call to Blockly.addChangeListener, ' +
               'use workspace.addChangeListener instead.');
  return Blockly.getMainWorkspace().addChangeListener(func);
};

/**
 * Returns the main workspace.  Returns the last used main workspace (based on
 * focus).  Try not to use this function, particularly if there are multiple
 * Blockly instances on a page.
 * @return {!Blockly.Workspace} The main workspace.
 */
Blockly.getMainWorkspace = function() {
  return Blockly.mainWorkspace;
};

/**
 * Wrapper to window.alert() that app developers may override to
 * provide alternatives to the modal browser window.
 * @param {string} message The message to display to the user.
 * @param {function()=} opt_callback The callback when the alert is dismissed.
 */
Blockly.alert = function(message, opt_callback) {
  window.alert(message);
  if (opt_callback) {
    opt_callback();
  }
};

/**
 * Wrapper to window.confirm() that app developers may override to
 * provide alternatives to the modal browser window.
 * @param {string} message The message to display to the user.
 * @param {!function(boolean)} callback The callback for handling user response.
 */
Blockly.confirm = function(message, callback) {
  callback(window.confirm(message));
};

/**
 * Wrapper to window.prompt() that app developers may override to provide
 * alternatives to the modal browser window. Built-in browser prompts are
 * often used for better text input experience on mobile device. We strongly
 * recommend testing mobile when overriding this.
 * @param {string} message The message to display to the user.
 * @param {string} defaultValue The value to initialize the prompt with.
 * @param {!function(string)} callback The callback for handling user response.
 */
Blockly.prompt = function(message, defaultValue, callback) {
  callback(window.prompt(message, defaultValue));
};

/**
 * Helper function for defining a block from JSON.  The resulting function has
 * the correct value of jsonDef at the point in code where jsonInit is called.
 * @param {!Object} jsonDef The JSON definition of a block.
 * @return {function()} A function that calls jsonInit with the correct value
 *     of jsonDef.
 * @private
 */
Blockly.jsonInitFactory_ = function(jsonDef) {
  return function() {
    this.jsonInit(jsonDef);
  };
};

/**
 * Define blocks from an array of JSON block definitions, as might be generated
 * by the Blockly Developer Tools.
 * @param {!Array.<!Object>} jsonArray An array of JSON block definitions.
 */
Blockly.defineBlocksWithJsonArray = function(jsonArray) {
  for (var i = 0, elem; elem = jsonArray[i]; i++) {
    var typename = elem.type;
    if (typename == null || typename === '') {
      console.warn('Block definition #' + i +
        ' in JSON array is missing a type attribute. Skipping.');
    } else {
      if (Blockly.Blocks[typename]) {
        console.warn('Block definition #' + i +
          ' in JSON array overwrites prior definition of "' + typename + '".');
      }
      Blockly.Blocks[typename] = {
        init: Blockly.jsonInitFactory_(elem)
      };
    }
  }
};

/**
 * Bind an event to a function call.  When calling the function, verifies that
 * it belongs to the touch stream that is currently being processed, and splits
 * multitouch events into multiple events as needed.
 * @param {!Node} node Node upon which to listen.
 * @param {string} name Event name to listen to (e.g. 'mousedown').
 * @param {Object} thisObject The value of 'this' in the function.
 * @param {!Function} func Function to call when event is triggered.
 * @param {boolean} opt_noCaptureIdentifier True if triggering on this event
 *     should not block execution of other event handlers on this touch or other
 *     simultaneous touches.
 * @return {!Array.<!Array>} Opaque data that can be passed to unbindEvent_.
 * @private
 */
Blockly.bindEventWithChecks_ = function(node, name, thisObject, func,
    opt_noCaptureIdentifier) {
  var handled = false;
  var wrapFunc = function(e) {
    var captureIdentifier = !opt_noCaptureIdentifier;
    // Handle each touch point separately.  If the event was a mouse event, this
    // will hand back an array with one element, which we're fine handling.
    var events = Blockly.Touch.splitEventByTouches(e);
    for (var i = 0, event; event = events[i]; i++) {
      if (captureIdentifier && !Blockly.Touch.shouldHandleEvent(event)) {
        continue;
      }
      Blockly.Touch.setClientFromTouch(event);
      if (thisObject) {
        func.call(thisObject, event);
      } else {
        func(event);
      }
      handled = true;
    }
  };

  node.addEventListener(name, wrapFunc, false);
  var bindData = [[node, name, wrapFunc]];

  // Add equivalent touch event.
  if (name in Blockly.Touch.TOUCH_MAP) {
    var touchWrapFunc = function(e) {
      wrapFunc(e);
      // Stop the browser from scrolling/zooming the page.
      if (handled) {
        e.preventDefault();
      }
    };
    for (var i = 0, eventName;
         eventName = Blockly.Touch.TOUCH_MAP[name][i]; i++) {
      node.addEventListener(eventName, touchWrapFunc, false);
      bindData.push([node, eventName, touchWrapFunc]);
    }
  }
  return bindData;
};

/**
 * Bind an event to a function call.  Handles multitouch events by using the
 * coordinates of the first changed touch, and doesn't do any safety checks for
 * simultaneous event processing.
 * @deprecated in favor of bindEventWithChecks_, but preserved for external
 * users.
 * @param {!Node} node Node upon which to listen.
 * @param {string} name Event name to listen to (e.g. 'mousedown').
 * @param {Object} thisObject The value of 'this' in the function.
 * @param {!Function} func Function to call when event is triggered.
 * @return {!Array.<!Array>} Opaque data that can be passed to unbindEvent_.
 * @private
 */
Blockly.bindEvent_ = function(node, name, thisObject, func) {
  var wrapFunc = function(e) {
    if (thisObject) {
      func.call(thisObject, e);
    } else {
      func(e);
    }
  };

  node.addEventListener(name, wrapFunc, false);
  var bindData = [[node, name, wrapFunc]];

  // Add equivalent touch event.
  if (name in Blockly.Touch.TOUCH_MAP) {
    var touchWrapFunc = function(e) {
      // Punt on multitouch events.
      if (e.changedTouches.length == 1) {
        // Map the touch event's properties to the event.
        var touchPoint = e.changedTouches[0];
        e.clientX = touchPoint.clientX;
        e.clientY = touchPoint.clientY;
      }
      wrapFunc(e);

      // Stop the browser from scrolling/zooming the page.
      e.preventDefault();
    };
    for (var i = 0, eventName;
         eventName = Blockly.Touch.TOUCH_MAP[name][i]; i++) {
      node.addEventListener(eventName, touchWrapFunc, false);
      bindData.push([node, eventName, touchWrapFunc]);
    }
  }
  return bindData;
};

/**
 * Unbind one or more events event from a function call.
 * @param {!Array.<!Array>} bindData Opaque data from bindEvent_.
 *     This list is emptied during the course of calling this function.
 * @return {!Function} The function call.
 * @private
 */
Blockly.unbindEvent_ = function(bindData) {
  while (bindData.length) {
    var bindDatum = bindData.pop();
    var node = bindDatum[0];
    var name = bindDatum[1];
    var func = bindDatum[2];
    node.removeEventListener(name, func, false);
  }
  return func;
};

/**
 * Is the given string a number (includes negative and decimals).
 * @param {string} str Input string.
 * @return {boolean} True if number, false otherwise.
 */
Blockly.isNumber = function(str) {
  return !!str.match(/^\s*-?\d+(\.\d+)?\s*$/);
};

// IE9 does not have a console.  Create a stub to stop errors.
if (!goog.global['console']) {
  goog.global['console'] = {
    'log': function() {},
    'warn': function() {}
  };
}

// Export symbols that would otherwise be renamed by Closure compiler.
if (!goog.global['Blockly']) {
  goog.global['Blockly'] = {};
}
goog.global['Blockly']['getMainWorkspace'] = Blockly.getMainWorkspace;
goog.global['Blockly']['addChangeListener'] = Blockly.addChangeListener;

Blockly.Category_Icon_Update = function(category_style) {
  var span = document.getElementsByTagName("span");
  var div_id = null;
  for (var category_num = 0; category_num < category_style.length; category_num++) {
    for (var i = 0; i < span.length; i++) {
      if (span[i].innerText == Blockly.Category_Icon_data[category_num].CategoryName) {
        div_id = span[i].id.replace(".label", "");
        var sheet = (function() {
            var style = document.createElement("style");
            style.appendChild(document.createTextNode(""));
            document.head.appendChild(style);
            return style.sheet;
        })();
        for (var j = 0; j < Blockly.Category_Icon_data[category_num].style.length; j++) {
          sheet.insertRule(`
            #\\${div_id} > div:nth-child(2) > ${Blockly.Category_Icon_data[category_num].style[j]}
          `);
        }
        break;
      }
    }
  }
}

//通过所给主分类名称与子分类相对主分类位置来添加图标
Blockly.Category_Icon_Add_With_Coordinates = function(category_name, coordinates, blocklyTreeIcon_path, blocklyTreeSelectedIcon_path) {
  var style = "";
  for (var i = 0; i < coordinates.length; i++) {
    if (i == coordinates.length - 1)
      style += "div:nth-child("+coordinates[i]+") > ";
    else
      style += "div:nth-child("+coordinates[i]+") > div:nth-child(2) > ";
  }
  var category_style = [];
  category_style[0] = style + 
  `div.blocklyTreeRow > span.blocklyTreeIcon.blocklyTreeIconNone {
    background:url('${blocklyTreeIcon_path}') no-repeat;
    background-size: 100% auto; 
  }`;
  category_style[1] = style + 
  `div.blocklyTreeRow.blocklyTreeSelected > span.blocklyTreeIcon.blocklyTreeIconNone {
    background:url('${blocklyTreeSelectedIcon_path}') no-repeat;
    background-size: 100% auto; 
  }`;
  var style = {
    CategoryName: category_name,
    style: category_style
  }
  Blockly.Category_Icon_Add(style);
}

//通过所给样式值为某个分类添加图标
Blockly.Category_Icon_Add = function(style) {
  Blockly.Category_Icon_data.push(style);
}

Blockly.Category_Icon_data = [];