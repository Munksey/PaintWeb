/*
 * Copyright (C) 2008, 2009 Mihai Şucan
 *
 * This file is part of PaintWeb.
 *
 * PaintWeb is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * PaintWeb is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with PaintWeb.  If not, see <http://www.gnu.org/licenses/>.
 *
 * $URL: http://code.google.com/p/paintweb $
 * $Date: 2009-07-02 16:07:14 +0300 $
 */

/**
 * @author <a lang="ro" href="http://www.robodesign.ro/mihai">Mihai Şucan</a>
 * @fileOverview Holds the selection tool implementation.
 */

/**
 * @class The selection tool.
 *
 * @param {PaintWeb} app Reference to the main paint application object.
 */
pwlib.tools.selection = function (app) {
  var _self         = this,
      appEvent      = pwlib.appEvent,
      bufferContext = app.buffer.context,
      clearInterval = app.win.clearInterval,
      config        = app.config.selection,
      gui           = app.gui,
      image         = app.image,
      lang          = app.lang,
      layerCanvas   = app.layer.canvas,
      layerContext  = app.layer.context,
      marqueeStyle  = null,
      MathAbs       = Math.abs,
      MathMin       = Math.min,
      MathRound     = Math.round,
      mouse         = app.mouse,
      rotationCursor = 'url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB8AAAAfCAYAAAAfrhY5AAAACXBIWXMAAAsTAAALEwEAmpwYAAAABGdBTUEAALGOfPtRkwAAACBjSFJNAAB6JQAAgIMAAPn/AACA6QAAdTAAAOpgAAA6mAAAF2+SX8VGAAAC6klEQVR42mL8//8/w0ABgABiYhhAABBAA2o5QAANqOUAAcRCjqbz588L3blzR+XTp098bGxsv+Tk5B7Z29s/INUcgAAiyfIJEyYEzJo1K/3p06dSAgICH0D427dvXG/evBHh4OD4ERYWtjotLW2Wtrb2F2LMAwggBlBqJ4RBlsrLyx80NDRc39vbG3T58mUedDVLly618vb2nioiInI6MTGxjhhzAQKIoIK4uLhGRUXF/fPmzXMixsDjx49LuLi4zNbT09tISC1AABG0WF9ffyMxlqLjjIyMCg0Nje341AAEEE6JSZMm+UlJSR0lx2IYDggI6Pfw8JiOSx4ggHBqFBMTO7lgwQIHSiwHYT4+vos7duzQwCYHEEA4E5iOjs5mSi0G4aKiojxjY+O12OQAAgirBlVV1d19fX1B1LD85s2bwKKA7ea+ffuU0OUAAogJWwHy/PlzCWBc7aBGKaampvYLiG8dPnzYBl0OIIAwLL9165aaoKDgB01NzW/UKka1tLSu3bt3TxldHCCAMCz//PkzD9Dyd9QswyUkJF6CSkF0cYAAwrCcnZ39F6jIpKblwDqAn4eHB6PIBQggDMtBlcTr16/FqGk5MCpVZGVlH6OLAwQQ1hQKKp+XL19uQWlKv3r1KldpaWmWsLDw2U2bNumhywMEEFZNmZmZZfhKJmJxY2NjHNCDoHba/9mzZ7ugywMEEFZNN27c4ADG0eWzZ88KUWK5iYnJaqDF90EF1v79+xXQ5QECCG+lYmtru5hci0+fPg1K3fejo6NbcakBCCC8BgAbBVtBtRM5loPq/a6urjB8agACiKAhwMJme2hoaPfdu3eZqFHcImOAACLYgLx27Zrn169fuaytrY+WlJTkAPlUKwMAAohoV27dulXL3Nx8JSgh6urqbgaFBrC8lqHE5wABxEhqjwWYapWOHj1qBWy9qkZGRi53d3e/Qa7HAQKIcSC7SwABNKCdBoAAGlDLAQJoQC0HCDAAKZYc/O7bNMEAAAAASUVORK5CYII=")',
      setInterval   = app.win.setInterval,
      snapXY        = app.toolSnapXY;

  /**
   * The interval ID used for invoking the drawing operation every few 
   * milliseconds.
   *
   * @private
   * @see PaintWeb.config.toolDrawDelay
   */
  var timer = null;

  /**
   * Tells if the drawing canvas needs to be updated or not.
   *
   * @private
   * @type Boolean
   * @default false
   */
  var needsRedraw = false;

  /**
   * The selection has been dropped, and the mouse button is down. The user has 
   * two choices: he releases the mouse button, thus the selection is dropped 
   * and the tool switches to STATE_NONE, or he moves the mouse in order to 
   * start a new selection (STATE_DRAWING).
   * @constant
   */
  this.STATE_PENDING = -1;

  /**
   * No selection is available.
   * @constant
   */
  this.STATE_NONE = 0;

  /**
   * The user is drawing a selection.
   * @constant
   */
  this.STATE_DRAWING = 1;

  /**
   * The selection rectangle is available.
   * @constant
   */
  this.STATE_SELECTED = 2;

  /**
   * The user is dragging/moving the selection rectangle.
   * @constant
   */
  this.STATE_DRAGGING = 3;

  /**
   * The user is resizing the selection rectangle.
   * @constant
   */
  this.STATE_RESIZING = 4;

  /**
   * The user is rotating the selection rectangle.
   * @constant
   */
  this.STATE_ROTATING = 5;

  /**
   * Selection state. Known states:
   *
   * <ul>
   *   <li>{@link pwlib.tools.selection#STATE_PENDING} - Selection dropped after 
   *   the <code>mousedown</code> event is fired. The script can switch to 
   *   STATE_DRAWING if the mouse moves, or to STATE_NONE if it does not 
   *   (allowing the user to drop the selection).
   *
   *   <li>{@link pwlib.tools.selection#STATE_NONE} - No selection is available.
   *
   *   <li>{@link pwlib.tools.selection#STATE_DRAWING} - The user is drawing the 
   *   selection rectangle.
   *
   *   <li>{@link pwlib.tools.selection#STATE_SELECTED} - The selection 
   *   rectangle is available.
   *
   *   <li>{@link pwlib.tools.selection#STATE_DRAGGING} - The user is 
   *   dragging/moving the current selection.
   *
   *   <li>{@link pwlib.tools.selection#STATE_RESIZING} - The user is resizing 
   *   the current selection.
   *
   *   <li>{@link.pwlib.tools.selection#STATE_ROTATING} - The user is rotating
   *   the current selection.
   * </ul>
   *
   * @type Number
   * @default STATE_NONE
   */
  this.state = this.STATE_NONE;

  /**
   * Holds the starting point on the <var>x</var> axis of the image, for any 
   * ongoing operation.
   *
   * @private
   * @type Number
   */
  var x0 = 0;

  /**
   * Holds the starting point on the <var>y</var> axis of the image, for the any  
   * ongoing operation.
   *
   * @private
   * @type Number
   */
  var y0 = 0;

  /**
   * Holds selection information and image.
   * @type Object
   */
  this.selection = {
    /**
     * Selection start point, on the <var>x</var> axis.
     * @type Number
     */
    x: 0,

    /**
     * Selection start point, on the <var>y</var> axis.
     * @type Number
     */
    y: 0,

    /**
     * Selection width.
     * @type Number
     */
    width: 0,

    /**
     * Selection height.
     * @type Number
     */
    height: 0,

    /**
     * Selection original width. The user can make a selection rectangle of 
     * a given width and height, but after that he/she can resize the selection.
     * @type Number
     */
    widthOriginal: 0,

    /**
     * Selection original height. The user can make a selection rectangle of 
     * a given width and height, but after that he/she can resize the selection.
     * @type Number
     */
    heightOriginal: 0,

    /**
     * Is the selection canvas being rotated?
     * @type Boolean
     * @default false
     */
    rotate: false,

    /**
     * Tells if the selected ImageData has been cut out or not from the 
     * layerContext.
     *
     * @type Boolean
     * @default false
     */
    layerCleared: false,

    /**
     * Selection marquee/border element.
     * @type HTMLElement
     */
    marquee: null,

    /**
     * Selection buffer context which holds the selected pixels.
     * @type CanvasRenderingContext2D
     */
    context: null,

    /**
     * Selection buffer canvas which holds the selected pixels.
     * @type HTMLCanvasElement
     */
    canvas: null
  };

  /**
   * The area type under the current mouse location.
   * 
   * <p>When the selection is available the mouse location can be on top/inside 
   * the selection rectangle, on the border of the selection, or outside the 
   * selection.
   *
   * <p>Possible values: 'in', 'out', 'border'.
   *
   * @private
   * @type String
   * @default 'out'
   */
  var mouseArea = 'out';

  /**
   * The resize type. If the mouse is on top of the selection border, then the 
   * selection can be resized. The direction of the resize operation is 
   * determined by the location of the mouse.
   * 
   * <p>While the user resizes the selection this variable can hold the 
   * following values: 'n' (North), 'ne' (North-East), 'e' (East), 'se' 
   * (South-East), 's' (South), 'sw' (South-West), 'w' (West), 'nw' 
   * (North-West).
   *
   * @private
   * @type String
   * @default null
   */
  var mouseResize = null;

  // shorthands / private variables
  var sel = this.selection,
      borderDouble = config.borderWidth * 2,
      ev_canvasSizeChangeId = null,
      ev_configChangeId = null,
      ctrlKey = false,
      shiftKey = false;

  /**
   * The last selection rectangle that was drawn. This is used by the selection 
   * drawing functions.
   *
   * @private
   * @type Object
   */
  // We avoid retrieving the mouse coordinates during the mouseup event, due to 
  // the Opera bug DSK-232264.
  var lastSel = null;

  /**
   * The tool preactivation code. This function prepares the selection canvas 
   * element.
   *
   * @returns {Boolean} True if the activation did not fail, or false otherwise.  
   * If false is returned, the selection tool cannot be activated.
   */
  this.preActivate = function () {
    if (!('canvasContainer' in gui.elems)) {
      alert(lang.errorToolActivate);
      return false;
    }

    // The selection image buffer.
    sel.canvas = app.doc.createElement('canvas');
    if (!sel.canvas) {
      alert(lang.errorToolActivate);
      return false;
    }

    sel.canvas.width  = 5;
    sel.canvas.height = 5;

    sel.context = sel.canvas.getContext('2d');
    if (!sel.context) {
      alert(lang.errorToolActivate);
      return false;
    }

    sel.marquee = app.doc.createElement('div');
    if (!sel.marquee) {
      alert(lang.errorToolActivate);
      return false;
    }
    sel.marquee.className = gui.classPrefix + 'selectionMarquee';
    marqueeStyle = sel.marquee.style;

    return true;
  };

  /**
   * The tool activation code. This method sets-up multiple event listeners for 
   * several target objects.
   */
  this.activate = function () {
    // Older browsers do not support get/putImageData, thus non-transparent 
    // selections cannot be used.
    if (!layerContext.putImageData || !layerContext.getImageData) {
      config.transparent = true;
    }

    marqueeHide();

    marqueeStyle.borderWidth = config.borderWidth + 'px';
    sel.marquee.addEventListener('mousedown', marqueeMousedown, false);
    sel.marquee.addEventListener('mousemove', marqueeMousemove, false);
    sel.marquee.addEventListener('mouseup',   marqueeMouseup,   false);

    gui.elems.canvasContainer.appendChild(sel.marquee);

    // Disable the Canvas shadow.
    app.shadowDisallow();

    // Application event listeners.
    ev_canvasSizeChangeId = app.events.add('canvasSizeChange', 
        ev_canvasSizeChange);
    ev_configChangeId = app.events.add('configChange', ev_configChange);

    // Register selection-related commands
    app.commandRegister('selectionCrop',   _self.selectionCrop);
    app.commandRegister('selectionDelete', _self.selectionDelete);
    app.commandRegister('selectionFill',   _self.selectionFill);
    app.commandRegister('selectionRotation', _self.selectionRotation);
    app.commandRegister('selectionFlipHorizontal', 
      _self.selectionFlipHorizontal);
    app.commandRegister('selectionFlipVertical', 
      _self.selectionFlipVertical);

    if (!timer) {
      timer = setInterval(timerFn, app.config.toolDrawDelay);
    }

    return true;
  };

  /**
   * The tool deactivation code. This removes all event listeners and cleans up 
   * the document.
   */
  this.deactivate = function () {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }

    _self.selectionMerge();

    sel.marquee.removeEventListener('mousedown', marqueeMousedown, false);
    sel.marquee.removeEventListener('mousemove', marqueeMousemove, false);
    sel.marquee.removeEventListener('mouseup',   marqueeMouseup,   false);

    marqueeStyle = null;
    gui.elems.canvasContainer.removeChild(sel.marquee);

    delete sel.context, sel.canvas, sel.marquee;

    // Re-enable canvas shadow.
    app.shadowAllow();

    // Remove the application event listeners.
    if (ev_canvasSizeChangeId) {
      app.events.remove('canvasSizeChange', ev_canvasSizeChangeId);
    }
    if (ev_configChangeId) {
      app.events.remove('configChange', ev_configChangeId);
    }

    // Unregister selection-related commands
    app.commandUnregister('selectionCrop');
    app.commandUnregister('selectionDelete');
    app.commandUnregister('selectionFill');
    app.commandUnregister('selectionRotation');
    app.commandUnregister('selectionFlipHorizontal');
    app.commandUnregister('selectionFlipVertical');

    return true;
  };

  /**
   * The <code>mousedown</code> event handler. Depending on the mouse location, 
   * this method does initiate different selection operations: drawing, 
   * dropping, dragging or resizing.
   *
   * <p>Hold the <kbd>Control</kbd> key down to temporarily toggle the 
   * transformation mode.
   *
   * @param {Event} ev The DOM Event object.
   */
  this.mousedown = function (ev) {
    if (_self.state !== _self.STATE_NONE &&
        _self.state !== _self.STATE_SELECTED) {
      return false;
    }

    // Update the current mouse position, this is used as the start position for most of the operations.
    x0 = mouse.x;
    y0 = mouse.y;

    shiftKey = ev.shiftKey;
    ctrlKey = ev.ctrlKey;
    lastSel = null;

    // No selection is available, then start drawing a selection.
    if (_self.state === _self.STATE_NONE) {
      _self.state = _self.STATE_DRAWING;
      marqueeStyle.display = '';
      gui.statusShow('selectionDraw');

      return true;
    }

    // STATE_SELECTED: selection available.
    mouseAreaUpdate();
    
    // Now that the area has been updated, set rotation
    // to false, since it's not needed
    sel.rotate = false;

    /*
     * Check if the user clicked outside the selection: drop the selection, 
     * switch to STATE_PENDING, clear the image buffer and put the current 
     * selection buffer in the image layer.
     *
     * If the user moves the mouse without taking the finger off the mouse 
     * button, then a new selection rectangle will start to be drawn: the script 
     * will switch to STATE_DRAWING.
     *
     * If the user simply takes the finger off the mouse button (mouseup), then 
     * the script will switch to STATE_NONE (no selection available).
     */
    switch (mouseArea) {
      case 'out':
        _self.state = _self.STATE_PENDING;
        marqueeHide();
        gui.statusShow('selectionActive');
        selectionMergeStrict();

        return true;

      case 'in':
        // The mouse area: 'in' for drag.
        _self.state = _self.STATE_DRAGGING;
        gui.statusShow('selectionDrag');
        break;

      case 'border':
        // 'border' for resize (the user is clicking on the borders).
        _self.state = _self.STATE_RESIZING;
        gui.statusShow('selectionResize');
        break;

      case 'rotation':
        _self.state = _self.STATE_ROTATING;
        gui.statusShow('selectionRotate');
    }

    // Temporarily toggle the transformation mode if the user holds the Control 
    // key down, unless we're in rotation mode.
    if (ev.ctrlKey && this.state !== this.STATE_ROTATING) {
      config.transform = !config.transform;
    }

    // If there's any ImageData currently in memory, which was "cut" out from 
    // the current layer, then put it back on the layer. This needs to be done 
    // only when the selection.transform mode is not active - that's when the 
    // drag/resize operation only changes the selection, not the pixels 
    // themselves.
    if (sel.layerCleared && !config.transform) {
      selectionMergeStrict();

    } else if (!sel.layerCleared && config.transform) {
      // When the user starts dragging/resizing the ImageData we must cut out 
      // the current selection from the image layer.
      selectionBufferInit();
    }

    return true;
  };

  /**
   * The <code>mousemove</code> event handler.
   *
   * @param {Event} ev The DOM Event object.
   */
  this.mousemove = function (ev) {
    shiftKey = ev.shiftKey;
    needsRedraw = true;
  };

  /**
   * The timer function. When the mouse button is down, this method performs the 
   * dragging/resizing operation. When the mouse button is not down, this method 
   * simply tracks the mouse location for the purpose of determining the area 
   * being pointed at: the selection, the borders, or if the mouse is outside 
   * the selection.
   * @private
   */
  function timerFn () {
    if (!needsRedraw) {
      return;
    }

    switch (_self.state) {
      case _self.STATE_PENDING:
        // selection dropped, switch to draw selection
        _self.state = _self.STATE_DRAWING;
        marqueeStyle.display = '';
        gui.statusShow('selectionDraw');

      case _self.STATE_DRAWING:
        selectionDraw();
        break;

      case _self.STATE_SELECTED:
        mouseAreaUpdate();
        break;

      case _self.STATE_DRAGGING:
        selectionDrag();
        break;

      case _self.STATE_RESIZING:
        selectionResize();
        break;
      
      case _self.STATE_ROTATING:
        selectionRotate(bufferContext);
    }

    needsRedraw = false;
  };

  /**
   * The <code>mouseup</code> event handler. This method ends any selection 
   * operation.
   *
   * <p>This method dispatches the {@link pwlib.appEvent.selectionChange} 
   * application event when the selection state is changed or when the selection 
   * size/location is updated.
   *
   * @param {Event} ev The DOM Event object.
   */
  this.mouseup = function (ev) {
    // Allow click+mousemove+click, not only mousedown+move+up
    if (_self.state !== _self.STATE_PENDING &&
        mouse.x === x0 && mouse.y === y0) {
      return true;
    }

    needsRedraw = false;

    shiftKey = ev.shiftKey;
    if (ctrlKey && this.state !== this.STATE_ROTATING) {
      config.transform = !config.transform;
    }

    if (_self.state === _self.STATE_PENDING) {
      // Selection dropped? If yes, switch to the no selection state.
      _self.state = _self.STATE_NONE;
      app.events.dispatch(new appEvent.selectionChange(_self.state));

      return true;

    } else if (!lastSel && _self.state !== _self.STATE_ROTATING) {
      _self.state = _self.STATE_NONE;
      marqueeHide();
      gui.statusShow('selectionActive');
      app.events.dispatch(new appEvent.selectionChange(_self.state));

      return true;
    } else if (_self.state === _self.STATE_ROTATING) {
      selectionMergeStrict();
      _self.state = _self.STATE_NONE;
      marqueeHide();
      app.events.dispatch(new appEvent.selectionChange(_self.state));

      return true;
    }

    sel.x = lastSel.x;
    sel.y = lastSel.y;

    if ('width' in lastSel) {
      sel.width  = lastSel.width;
      sel.height = lastSel.height;
    }

    _self.state = _self.STATE_SELECTED;

    app.events.dispatch(new appEvent.selectionChange(_self.state, sel.x, sel.y, 
          sel.width, sel.height));

    gui.statusShow('selectionAvailable');

    return true;
  };

  /**
   * The <code>mousedown</code> event handler for the selection marquee element.
   *
   * @private
   * @param {Event} ev The DOM Event object.
   */
  function marqueeMousedown (ev) {
    if (mouse.buttonDown) {
      return;
    }
    mouse.buttonDown = true;

    ev.preventDefault();

    _self.mousedown(ev);
  };

  /**
   * The <code>mousemove</code> event handler for the selection marquee element.
   *
   * @private
   * @param {Event} ev The DOM Event object.
   */
  function marqueeMousemove (ev) {
    if ('layerX' in ev) {
      mouse.x = MathRound((this.offsetLeft + ev.layerX) / image.canvasScale);
      mouse.y = MathRound((this.offsetTop  + ev.layerY) / image.canvasScale);
    } else if ('offsetX' in ev) {
      mouse.x = MathRound((this.offsetLeft + ev.offsetX) / image.canvasScale);
      mouse.y = MathRound((this.offsetTop  + ev.offsetY) / image.canvasScale);
    }

    shiftKey = ev.shiftKey;
    needsRedraw = true;
  };

  /**
   * The <code>mouseup</code> event handler for the selection marquee element.
   *
   * @private
   * @param {Event} ev The DOM Event object.
   */
  function marqueeMouseup (ev) {
    if (!mouse.buttonDown) {
      return;
    }
    mouse.buttonDown = false;

    ev.preventDefault();

    _self.mouseup(ev);
  };

  /**
   * Rotates the marquee.
   * @private
   */
  function marqueeRotate(radians) {
    rotateStyle = "rotate(" + radians + "rad)";
    if ('transform' in marqueeStyle) {
      marqueeStyle.transform = rotateStyle;
    } else if ('webkitTransform' in marqueeStyle) {
      marqueeStyle.webkitTransform = rotateStyle;
    } else if ('MozTransform' in marqueeStyle) {
      marqueeStyle.MozTransform = rotateStyle;
    } else {
      alert(lang.errorMarqueeRotate);
      return false;
    }

    return true;
  }

  /**
   * Hide the selection marquee element.
   * @private
   */
  function marqueeHide () {
    marqueeStyle.display = 'none';
    marqueeStyle.top     = '-' + (borderDouble + 50) + 'px';
    marqueeStyle.left    = '-' + (borderDouble + 50) + 'px';
    marqueeStyle.width   = '1px';
    marqueeStyle.height  = '1px';
    marqueeStyle.cursor  = '';
    marqueeRotate(0);
  };

  /**
   * Perform the selection rectangle drawing operation.
   *
   * @private
   */
  function selectionDraw () {
    var x = MathMin(mouse.x,  x0),
        y = MathMin(mouse.y,  y0),
        w = MathAbs(mouse.x - x0),
        h = MathAbs(mouse.y - y0);

    // Constrain the shape to a square.
    if (shiftKey) {
      if (w > h) {
        if (y === mouse.y) {
          y -= w-h;
        }
        h = w;
      } else {
        if (x === mouse.x) {
          x -= h-w;
        }
        w = h;
      }
    }

    var mw = w * image.canvasScale - borderDouble,
        mh = h * image.canvasScale - borderDouble;

    if (mw < 1 || mh < 1) {
      lastSel = null;
      return;
    }

    marqueeStyle.top    = (y * image.canvasScale) + 'px';
    marqueeStyle.left   = (x * image.canvasScale) + 'px';
    marqueeStyle.width  = mw + 'px';
    marqueeStyle.height = mh + 'px';

    lastSel = {'x': x, 'y': y, 'width': w, 'height': h};
  };

  /**
   * Perform the selection drag operation.
   *
   * @private
   *
   * @returns {false|Array} False is returned if the selection is too small, 
   * otherwise an array of two elements is returned. The array holds the 
   * selection coordinates, x and y.
   */
  function selectionDrag () {
    // Snapping on the X/Y axis
    if (shiftKey) {
      snapXY(x0, y0);
    }

    var x = sel.x + mouse.x - x0,
        y = sel.y + mouse.y - y0;

    // Dragging the ImageData
    if (config.transform) {
      bufferContext.clearRect(0, 0, image.width, image.height);

      if (!config.transparent) {
        bufferContext.fillRect(x, y, sel.width, sel.height);
      }

      // Parameters:
      // source image, dest x, dest y, dest width, dest height
      bufferContext.drawImage(sel.canvas, x, y, sel.width, sel.height);
    }

    marqueeStyle.top  = (y * image.canvasScale) + 'px';
    marqueeStyle.left = (x * image.canvasScale) + 'px';

    lastSel = {'x': x, 'y': y};
  };

  /**
   * Perform the selection resize operation.
   *
   * @private
   *
   * @returns {false|Array} False is returned if the selection is too small, 
   * otherwise an array of four elements is returned. The array holds the 
   * selection information: x, y, width and height.
   */
  function selectionResize () {
    var diffx = mouse.x - x0,
        diffy = mouse.y - y0,
        x     = sel.x,
        y     = sel.y,
        w     = sel.width,
        h     = sel.height;

    switch (mouseResize) {
      case 'nw':
        x += diffx;
        y += diffy;
        w -= diffx;
        h -= diffy;
        break;
      case 'n':
        y += diffy;
        h -= diffy;
        break;
      case 'ne':
        y += diffy;
        w += diffx;
        h -= diffy;
        break;
      case 'e':
        w += diffx;
        break;
      case 'se':
        w += diffx;
        h += diffy;
        break;
      case 's':
        h += diffy;
        break;
      case 'sw':
        x += diffx;
        w -= diffx;
        h += diffy;
        break;
      case 'w':
        x += diffx;
        w -= diffx;
        break;
      default:
        lastSel = null;
        return;
    }

    if (!w || !h) {
      lastSel = null;
      return;
    }

    // Constrain the rectangle to have the same aspect ratio as the initial 
    // rectangle.
    if (shiftKey) {
      var p  = sel.width / sel.height,
          w2 = w,
          h2 = h;

      switch (mouseResize.charAt(0)) {
        case 'n':
        case 's':
          w2 = MathRound(h*p);
          break;
        default:
          h2 = MathRound(w/p);
      }

      switch (mouseResize) {
        case 'nw':
        case 'sw':
          x -= w2 - w;
          y -= h2 - h;
      }

      w = w2;
      h = h2;
    }

    if (w < 0) {
      x += w;
      w *= -1;
    }
    if (h < 0) {
      y += h;
      h *= -1;
    }

    var mw   = w * image.canvasScale - borderDouble,
        mh   = h * image.canvasScale - borderDouble;

    if (mw < 1 || mh < 1) {
      lastSel = null;
      return;
    }

    // Resizing the ImageData
    if (config.transform) {
      bufferContext.clearRect(0, 0, image.width, image.height);

      if (!config.transparent) {
        bufferContext.fillRect(x, y, w, h);
      }

      // Parameters:
      // source image, dest x, dest y, dest width, dest height
      bufferContext.drawImage(sel.canvas, x, y, w, h);
    }

    marqueeStyle.top    = (y * image.canvasScale) + 'px';
    marqueeStyle.left   = (x * image.canvasScale) + 'px';
    marqueeStyle.width  = mw + 'px';
    marqueeStyle.height = mh + 'px';

    lastSel = {'x': x, 'y': y, 'width': w, 'height': h};
  };

  /**
   * Determine the are where the mouse is located: if it is inside or outside of 
   * the selection rectangle, or on the selection border.
   * @private
   */
  function mouseAreaUpdate () {
    var border = config.borderWidth / image.canvasScale,
        cursor = '',
        x1_out = sel.x + sel.width,
        y1_out = sel.y + sel.height,
        x1_in  = x1_out - border,
        y1_in  = y1_out - border,
        x0_out = sel.x,
        y0_out = sel.y,
        x0_in  = sel.x + border,
        y0_in  = sel.y + border;

    mouseArea = 'out';

    if (sel.rotate == true && mouse.x >= x0_out && mouse.x <= x1_out
      && mouse.y >= y0_out && mouse.y <= y1_out) {
      // Rotation is on, use rotation mouse cursor
      cursor = 'progress';
      mouseArea = 'rotation';
    } else if (mouse.x < x1_in && mouse.y < y1_in &&
        mouse.x > x0_in && mouse.y > y0_in) {
      // Inside the rectangle
      cursor = 'move';
      mouseArea = 'in';
    } else {
      // On one of the borders (north/south)
      if (mouse.x >= x0_out && mouse.x <= x1_out &&
          mouse.y >= y0_out && mouse.y <= y0_in) {
        cursor = 'n';

      } else if (mouse.x >= x0_out && mouse.x <= x1_out &&
                 mouse.y >= y1_in  && mouse.y <= y1_out) {
        cursor = 's';
      }

      // West/east
      if (mouse.y >= y0_out && mouse.y <= y1_out &&
          mouse.x >= x0_out && mouse.x <= x0_in) {
        cursor += 'w';

      } else if (mouse.y >= y0_out && mouse.y <= y1_out &&
                 mouse.x >= x1_in  && mouse.x <= x1_out) {
        cursor += 'e';
      }

      if (cursor !== '') {
        mouseResize = cursor;
        cursor += '-resize';
        mouseArea = 'border';
      }
    }

    // Due to bug 126457 Opera will not automatically update the cursor, 
    // therefore they will not see any visual feedback.
    if (cursor !== marqueeStyle.cursor) {
      marqueeStyle.cursor = cursor;
    }
  };

  /**
   * The <code>canvasSizeChange</code> application event handler. This method 
   * makes sure the selection size stays in sync.
   *
   * @private
   * @param {pwlib.appEvent.canvasSizeChange} ev The application event object.
   */
  function ev_canvasSizeChange (ev) {
    if (_self.state !== _self.STATE_SELECTED) {
      return;
    }

    marqueeStyle.top    = (sel.y      * ev.scale) + 'px';
    marqueeStyle.left   = (sel.x      * ev.scale) + 'px';
    marqueeStyle.width  = (sel.width  * ev.scale - borderDouble) + 'px';
    marqueeStyle.height = (sel.height * ev.scale - borderDouble) + 'px';
  };

  /**
   * The <code>configChange</code> application event handler. This method makes 
   * sure that changes to the selection transparency configuration option are 
   * applied.
   *
   * @private
   * @param {pwlib.appEvent.configChange} ev The application event object.
   */
  function ev_configChange (ev) {
    // Continue only if the selection rectangle is available.
    if (ev.group !== 'selection' || ev.config !== 'transparent' ||
        !config.transform || _self.state !== _self.STATE_SELECTED) {
      return;
    }

    if (!sel.layerCleared) {
      selectionBufferInit();
    }

    bufferContext.clearRect(sel.x, sel.y, sel.width, sel.height);

    if (!ev.value) {
      bufferContext.fillRect(sel.x, sel.y, sel.width, sel.height);
    }

    // Draw the updated selection
    bufferContext.drawImage(sel.canvas, sel.x, sel.y, sel.width, sel.height);
  };

  /**
   * Initialize the selection buffer, when the user starts dragging or resizing 
   * the selected pixels.
   *
   * @private
   */
  function selectionBufferInit () {
    var x = sel.x,
        y = sel.y,
        w = sel.width,
        h = sel.height,
        sumX = sel.x + sel.width,
        sumY = sel.y + sel.height,
        dx = 0, dy = 0;

    sel.widthOriginal  = w;
    sel.heightOriginal = h;

    if (x < 0) {
      w += x;
      dx -= x;
      x = 0;
    }
    if (y < 0) {
      h += y;
      dy -= y;
      y = 0;
    }

    if (sumX > image.width) {
      w = image.width - sel.x;
    }
    if (sumY > image.height) {
      h = image.height - sel.y;
    }

    if (!config.transparent) {
      bufferContext.fillRect(x, y, w, h);
    }

    // Parameters:
    // source image, src x, src y, src w, src h, dest x, dest y, dest w, dest h
    bufferContext.drawImage(layerCanvas, x, y, w, h, x, y, w, h);

    sel.canvas.width  = sel.widthOriginal;
    sel.canvas.height = sel.heightOriginal;

    // Also put the selected pixels into the selection buffer.
    sel.context.drawImage(layerCanvas, x, y, w, h, dx, dy, w, h);

    // Clear the selected pixels from the image
    layerContext.clearRect(x, y, w, h);
    sel.layerCleared = true;

    app.historyAdd();
  };

  /**
   * Perform the selection buffer merge onto the current image layer.
   * @private
   */
  function selectionMergeStrict () {
    if (!sel.layerCleared) {
      return;
    }

    if (!config.transparent) {
      layerContext.fillRect(sel.x, sel.y, sel.width, sel.height);
    }

    if (_self.state == _self.STATE_ROTATING) {
      selectionRotate(layerContext);
      bufferContext.clearRect(0, 0, image.width, image.height);
    } else {
      layerContext.drawImage(sel.canvas, sel.x, sel.y, sel.width, sel.height);
      bufferContext.clearRect(sel.x, sel.y, sel.width, sel.height);
    }

    sel.layerCleared  = false;
    sel.canvas.width  = 5;
    sel.canvas.height = 5;

    app.historyAdd();
  };

  /**
   * Called to reposition the canvas based on the movement.
   *
   * @param {CanvasRenderingContext2D} context The context to draw rotation on.
   *
   * @return {Boolean} 
   */
  function selectionRotate(context) {
    // Determine the origin of the rotation
    var originX = sel.x + (sel.width/2);
    var originY = sel.y + (sel.height/2);

    // Calculate the number of radians the user has moved their mouse
    // around the origin
    var angleStart = Math.atan2(originX - x0, originY - y0);
    var angleEnd = Math.atan2(originX - mouse.x, originY - mouse.y);

    // How far has the object rotated?
    var difference = angleStart - angleEnd;
    if (marqueeRotate(difference)) {
      if (context === bufferContext) {
        context.clearRect(0, 0, image.width, image.height);
      }
      context.save();
      context.translate(originX, originY);
      context.rotate(difference);
      context.translate(-originX, -originY);
      context.drawImage(sel.canvas, sel.x, sel.y, sel.width, sel.height);
      context.restore();
      sel.rotation = difference;

      return true;
    }

    return false;
  }

  /**
   * Merge the selection buffer onto the current image layer.
   *
   * <p>This method dispatches the {@link pwlib.appEvent.selectionChange} 
   * application event.
   *
   * @returns {Boolean} True if the operation was successful, or false if not.
   */
  this.selectionMerge = function () {
    if (_self.state !== _self.STATE_SELECTED) {
      return false;
    }

    selectionMergeStrict();

    _self.state = _self.STATE_NONE;
    marqueeHide();
    gui.statusShow('selectionActive');

    app.events.dispatch(new appEvent.selectionChange(_self.state));

    return true;
  };

  /**
   * Select all the entire image.
   *
   * <p>This method dispatches the {@link pwlib.appEvent.selectionChange} 
   * application event.
   *
   * @returns {Boolean} True if the operation was successful, or false if not.
   */
  this.selectAll = function () {
    if (_self.state !== _self.STATE_NONE && _self.state !== 
        _self.STATE_SELECTED) {
      return false;
    }

    if (_self.state === _self.STATE_SELECTED) {
      selectionMergeStrict();
    } else {
      _self.state = _self.STATE_SELECTED;
      marqueeStyle.display = '';
    }

    sel.x      = 0;
    sel.y      = 0;
    sel.width  = image.width;
    sel.height = image.height;

    marqueeStyle.top     = '0px';
    marqueeStyle.left    = '0px';
    marqueeStyle.width   = (sel.width*image.canvasScale  - borderDouble) + 'px';
    marqueeStyle.height  = (sel.height*image.canvasScale - borderDouble) + 'px';

    mouseAreaUpdate();

    app.events.dispatch(new appEvent.selectionChange(_self.state, sel.x, sel.y, 
          sel.width, sel.height));

    return true;
  };

  /**
   * Cut the selected pixels. The associated ImageData is stored in {@link 
   * PaintWeb#clipboard}.
   *
   * <p>This method dispatches two application events: {@link 
   * pwlib.appEvent.clipboardUpdate} and {@link pwlib.appEvent.selectionChange}.
   *
   * @returns {Boolean} True if the operation was successful, or false if not.
   */
  this.selectionCut = function () {
    if (!_self.selectionCopy()) {
      return false;
    }

    if (sel.layerCleared) {
      bufferContext.clearRect(sel.x, sel.y, sel.width, sel.height);

      sel.canvas.width  = 5;
      sel.canvas.height = 5;
      sel.layerCleared = false;

    } else {
      layerContext.clearRect(sel.x, sel.y, sel.width, sel.height);
      app.historyAdd();
    }

    _self.state = _self.STATE_NONE;
    marqueeHide();

    app.events.dispatch(new appEvent.selectionChange(_self.state));
    gui.statusShow('selectionActive');

    return true;
  };

  /**
   * Copy the selected pixels. The associated ImageData is stored in {@link 
   * PaintWeb#clipboard}.
   *
   * <p>This method dispatches the {@link pwlib.appEvent.clipboardUpdate} 
   * application event.
   *
   * @returns {Boolean} True if the operation was successful, or false if not.
   */
  this.selectionCopy = function () {
    if (_self.state !== _self.STATE_SELECTED) {
      return false;
    }

    if (!layerContext.getImageData || !layerContext.putImageData) {
      alert(lang.errorClipboardUnsupported);
      return false;
    }

    if (!sel.layerCleared) {
      var w    = sel.width,
          h    = sel.height,
          sumX = sel.width  + sel.x;
          sumY = sel.height + sel.y;

      if (sumX > image.width) {
        w = image.width - sel.x;
      }
      if (sumY > image.height) {
        h = image.height - sel.y;
      }

      try {
        app.clipboard = layerContext.getImageData(sel.x, sel.y, w, h);
      } catch (err) {
        alert(lang.failedSelectionCopy);
        return false;
      }

    } else {
      try {
        app.clipboard = sel.context.getImageData(0, 0, sel.widthOriginal, 
            sel.heightOriginal);
      } catch (err) {
        alert(lang.failedSelectionCopy);
        return false;
      }
    }

    app.events.dispatch(new appEvent.clipboardUpdate(app.clipboard));

    return true;
  };

  /**
   * Paste an image from the "clipboard". The {@link PaintWeb#clipboard} object 
   * must be an ImageData. This method will generate a new selection which will 
   * hold the pasted image.
   *
   * <p>The {@link pwlib.appEvent.selectionChange} application event is 
   * dispatched.
   *
   * <p>If the {@link PaintWeb.config.selection.transform} value is false, then 
   * it becomes true. The {@link pwlib.appEvent.configChange} application is 
   * then dispatched.
   *
   * @returns {Boolean} True if the operation was successful, or false if not.
   */
  this.clipboardPaste = function () {
    if (!app.clipboard || _self.state !== _self.STATE_NONE && _self.state !== 
        _self.STATE_SELECTED) {
      return false;
    }

    if (!layerContext.getImageData || !layerContext.putImageData) {
      alert(lang.errorClipboardUnsupported);
      return false;
    }

    // The default position for the pasted image is the top left corner of the 
    // visible area, taking into consideration the zoom level.
    var x = MathRound(gui.elems.viewport.scrollLeft / image.canvasScale),
        y = MathRound(gui.elems.viewport.scrollTop  / image.canvasScale),
        w = app.clipboard.width,
        h = app.clipboard.height;

    if (_self.state === _self.STATE_SELECTED) {
      bufferContext.clearRect(sel.x, sel.y, sel.width, sel.height);
    } else {
      _self.state = _self.STATE_SELECTED;
    }

    if (!config.transparent) {
      bufferContext.fillRect(x, y, w, h);
    }
    bufferContext.drawImage(sel.canvas, x, y, w, h);

    sel.widthOriginal  = sel.width  = w;
    sel.heightOriginal = sel.height = h;
    sel.x = x;
    sel.y = y;
    sel.layerCleared = true;

    marqueeStyle.top     = (y * image.canvasScale) + 'px';
    marqueeStyle.left    = (x * image.canvasScale) + 'px';
    marqueeStyle.width   = (w * image.canvasScale - borderDouble) + 'px';
    marqueeStyle.height  = (h * image.canvasScale - borderDouble) + 'px';
    marqueeStyle.display = '';

    if (!config.transform) {
      config.transform = true;
      app.events.dispatch(new appEvent.configChange(true, false, 'transform', 
            'selection', config));
    }

    mouseAreaUpdate();

    app.events.dispatch(new appEvent.selectionChange(_self.state, sel.x, sel.y, 
          sel.width, sel.height));

    gui.statusShow('selectionAvailable');

    return true;
  };

  /**
   * Perform selection delete.
   *
   * <p>This method changes the {@link PaintWeb.config.selection.transform} 
   * value to false if the current selection has pixels that are currently being 
   * manipulated. In such cases, the {@link pwlib.appEvent.configChange} 
   * application event is also dispatched.
   *
   * @returns {Boolean} True if the operation was successful, or false if not.
   */
  this.selectionDelete = function () {
    // Delete the pixels from the image if they are not deleted already.
    if (_self.state !== _self.STATE_SELECTED) {
      return false;
    }

    if (!sel.layerCleared) {
      layerContext.clearRect(sel.x, sel.y, sel.width, sel.height);
      app.historyAdd();

    } else {
      bufferContext.clearRect(sel.x, sel.y, sel.width, sel.height);
      sel.layerCleared  = false;
      sel.canvas.width  = 5;
      sel.canvas.height = 5;

      if (config.transform) {
        config.transform = false;
        app.events.dispatch(new appEvent.configChange(false, true, 'transform', 
              'selection', config));
      }
    }

    return true;
  };

  /**
   * Drop the current selection.
   *
   * <p>This method dispatches the {@link pwlib.appEvent.selectionChange} 
   * application event.
   *
   * @returns {Boolean} True if the operation was successful, or false if not.
   */
  this.selectionDrop = function () {
    if (_self.state !== _self.STATE_SELECTED) {
      return false;
    }

    if (sel.layerCleared) {
      bufferContext.clearRect(sel.x, sel.y, sel.width, sel.height);
      sel.canvas.width  = 5;
      sel.canvas.height = 5;
      sel.layerCleared  = false;
    }

    _self.state = _self.STATE_NONE;

    marqueeHide();
    gui.statusShow('selectionActive');

    app.events.dispatch(new appEvent.selectionChange(_self.state));

    return true;
  };

  /**
   * Fill the available selection with the current 
   * <var>bufferContext.fillStyle</var>.
   *
   * @returns {Boolean} True if the operation was successful, or false if not.
   */
  this.selectionFill = function () {
    if (_self.state !== _self.STATE_SELECTED) {
      return false;
    }

    if (sel.layerCleared) {
      sel.context.fillStyle = bufferContext.fillStyle;
      sel.context.fillRect(0, 0, sel.widthOriginal, sel.heightOriginal);
      bufferContext.fillRect(sel.x, sel.y, sel.width, sel.height);

    } else {
      layerContext.fillStyle = bufferContext.fillStyle;
      layerContext.fillRect(sel.x, sel.y, sel.width, sel.height);
      app.historyAdd();
    }

    return true;
  };

  /**
   * Crop the image to selection width and height. The selected pixels become 
   * the image itself.
   *
   * <p>This method invokes the {@link this#selectionMerge} and {@link 
   * PaintWeb#imageCrop} methods.
   *
   * @returns {Boolean} True if the operation was successful, or false if not.
   */
  this.selectionCrop = function () {
    if (_self.state !== _self.STATE_SELECTED || !config.imageResizeable) {
      return false;
    }

    _self.selectionMerge();

    var w    = sel.width,
        h    = sel.height,
        sumX = sel.x + w,
        sumY = sel.y + h;

    if (sumX > image.width) {
      w -= sumX - image.width;
    }
    if (sumY > image.height) {
      h -= sumY - image.height;
    }

    app.imageCrop(sel.x, sel.y, w, h);

    return true;
  };

  /**
   * This method is used to invert an image horizontally within a selected 
   * area.
   *
   * @returns {Boolean} True if the operation was successful, or false if not.
   */
  this.selectionFlipHorizontal = function() {
    var contextToManipulate = sel.layerCleared ? bufferContext : layerContext;

    if (!contextToManipulate.getImageData || 
        !contextToManipulate.putImageData) {
      alert(lang.errorFlippingUnsupported);
      return false;
    }

    var imageData = contextToManipulate.getImageData(sel.x, sel.y, 
      sel.width, sel.height);
    var imagePixels = imageData.data;

    var imageDataReplace = contextToManipulate.createImageData(
      sel.width, sel.height);
    var imagePixelsReplace = imageDataReplace.data;
    
    for (var iy = 0; iy < imageData.height; iy++) {
      for (var ix = 0; ix < imageData.width; ix++) {
        var from = (iy*imageData.width*4) + (ix*4);
        var to = ((iy*imageData.width*4) + (imageData.width*4)) - (ix*4);


        imagePixelsReplace[to] = imagePixels[from];
        imagePixelsReplace[to+1] = imagePixels[from+1];
        imagePixelsReplace[to+2] = imagePixels[from+2];
        imagePixelsReplace[to+3] = imagePixels[from+3];
      }
    }

    contextToManipulate.clearRect(sel.x, sel.y, sel.width, sel.height);
    contextToManipulate.putImageData(imageDataReplace, sel.x, sel.y);

    if (!sel.layerCleared) {
      app.historyAdd();
    } else {
      sel.context.drawImage(contextToManipulate, sel.x, sel.y, 
        sel.width, sel.height);
    }

    return true;
  }

  /**
   * This method is used to invert an image vertically within a selected 
   * area.
   *
   * @returns {Boolean} True if the operation was successful, or false if not.
   */
  this.selectionFlipVertical = function() {
    var contextToManipulate = sel.layerCleared ? bufferContext : layerContext;

    if (!contextToManipulate.getImageData || 
        !contextToManipulate.putImageData) {
      alert(lang.errorFlippingUnsupported);
      return false;
    }

    var imageData = contextToManipulate.getImageData(sel.x, sel.y,
      sel.width, sel.height);
    var imagePixels = imageData.data;

    var imageDataReplace = contextToManipulate.createImageData(
      sel.width, sel.height);
    var imagePixelsReplace = imageDataReplace.data;

    for (var iy = 0; iy < imageData.height; iy++) {
      for (var ix = 0; ix < imageData.width; ix++) {
        var from = (iy*imageData.width*4) + (ix*4);
        var to = ((imageData.height - iy)*imageData.width*4) + (ix*4);

        imagePixelsReplace[to] = imagePixels[from];
        imagePixelsReplace[to+1] = imagePixels[from+1];
        imagePixelsReplace[to+2] = imagePixels[from+2];
        imagePixelsReplace[to+3] = imagePixels[from+3];
      }
    }

    contextToManipulate.clearRect(sel.x, sel.y, sel.width, sel.height);
    contextToManipulate.putImageData(imageDataReplace, sel.x, sel.y);
    
    if (!sel.layerCleared) {
      app.historyAdd();
    } else {
      sel.context.drawImage(contextToManipulate, sel.x, sel.y,
        sel.width, sel.height);
    }

    return true;
  }

  /**
   * This command puts the selection into rotation mode.
   *
   * @returns {Boolean} True on success, false on failure
   */
  this.selectionRotation = function() {
    sel.rotate = true;
  }

  /**
   * The <code>keydown</code> event handler. This method calls selection-related 
   * commands associated to keyboard shortcuts.
   *
   * @param {Event} ev The DOM Event object.
   *
   * @returns {Boolean} True if the keyboard shortcut was recognized, or false 
   * if not.
   *
   * @see PaintWeb.config.selection.keys holds the keyboard shortcuts 
   * configuration.
   */
  this.keydown = function (ev) {
    switch (ev.kid_) {
      case config.keys.transformToggle:
        // Toggle the selection transformation mode.
        config.transform = !config.transform;
        app.events.dispatch(new appEvent.configChange(config.transform, 
              !config.transform, 'transform', 'selection', config));
        break;

      case config.keys.selectionCrop:
        sel.rotate = false;
        return _self.selectionCrop(ev);

      case config.keys.selectionDelete:
        sel.rotate = false;
        return _self.selectionDelete(ev);

      case config.keys.selectionDrop:
        sel.rotate = false;
        return _self.selectionDrop(ev);

      case config.keys.selectionFill:
        sel.rotate = false;
        return _self.selectionFill(ev);

      default:
        return false;
    }

    return true;
  };
};

/**
 * @class Selection change event. This event is not cancelable.
 *
 * @augments pwlib.appEvent
 *
 * @param {Number} state Tells the new state of the selection.
 * @param {Number} [x] Selection start position on the x-axis of the image.
 * @param {Number} [y] Selection start position on the y-axis of the image.
 * @param {Number} [width] Selection width.
 * @param {Number} [height] Selection height.
 */
pwlib.appEvent.selectionChange = function (state, x, y, width, height) {
  /**
   * No selection is available.
   * @constant
   */
  this.STATE_NONE = 0;

  /**
   * Selection available.
   * @constant
   */
  this.STATE_SELECTED = 2;

  /**
   * Selection state.
   * @type Number
   */
  this.state = state;

  /**
   * Selection location on the x-axis of the image.
   * @type Number
   */
  this.x = x;

  /**
   * Selection location on the y-axis of the image.
   * @type Number
   */
  this.y = y;

  /**
   * Selection width.
   * @type Number
   */
  this.width  = width;

  /**
   * Selection height.
   * @type Number
   */
  this.height = height;

  pwlib.appEvent.call(this, 'selectionChange');
};

// vim:set spell spl=en fo=wan1croqlt tw=80 ts=2 sw=2 sts=2 sta et ai cin fenc=utf-8 ff=unix:

