function Leapiano(opts) {
  
  _.extend(this, {
    midi: null,
    fingers: {},
  }, opts);

  this.piano = new Leapiano.Piano({
    midi: this.midi
  });

  this.connect();
}

Leapiano.X = 0;
Leapiano.Y = 1;
Leapiano.Z = 2;

Leapiano.prototype.connect = function() {
  var _this = this;

  // Support both the WebSocket and MozWebSocket objects
  if ((typeof(WebSocket) == 'undefined') &&
      (typeof(MozWebSocket) != 'undefined')) {
    WebSocket = MozWebSocket;
  }

  ws = new WebSocket("ws://localhost:6437/");

  // On message received
  ws.onmessage = function(event) {
    var obj = JSON.parse(event.data);
    _this.piano.resetKeys();
    _this.checkForFingerEvents(obj);
    _this.piano.drawKeys();
  };
};

Leapiano.prototype.checkForFingerEvents = function(obj) {
  var _this = this;
  obj.hands.forEach(function(hand) {
    hand.fingers.forEach(function(finger) {
      var fingerObject = _this.getFingerObject(finger);
      fingerObject.update(finger.tip.position, finger.tip.velocity);
    });
  });
};

Leapiano.prototype.getFingerObject = function(finger) {
  var fingerKey = 'finger_' + finger.id;
  if (this.fingers[fingerKey]) {
    return this.fingers[fingerKey];
  } else {
    this.fingers[fingerKey] = new Leapiano.Finger({
      id: finger.id,
      piano: this.piano
    });
    return this.fingers[fingerKey];
  }
};

Leapiano.Finger = function(opts) {
  _.extend(this, {
    previousPosition: null,
    piano: null,
    createdAt: (new Date()).getTime()
  }, opts);
};

Leapiano.Finger.prototype.update = function(position, velocity) {
  var now = (new Date()).getTime();

  // Don't let the finger play keys until it has been around for a while.
  if (now - this.createdAt < 1000.0) return;

  if (!this.previousPosition) {
    this.previousPosition = position;
    return;
  }

  var yVelocity = position[Leapiano.Y] - this.previousPosition[Leapiano.Y];

  this.piano.playKey(position, yVelocity, this.id);

  this.previousPosition = position;
};

Leapiano.Piano = function(opts) {
  _.extend(this, {
    midi: null,
    minX: -200.0,
    maxX: 200.0,
    minimumVelocity: 1.5,
    keys: [],
    canvas: null,
    context: null,
    canvasWidth: 800,
    canvasHeight: 150
  }, opts);

  this.generateKeys(16);
}

Leapiano.Piano.prototype.resetKeys = function() {
  this.keys.forEach(function(key) {
    key.color = 'white';
    key.pressed = false;
  });
};

Leapiano.Piano.prototype.drawKeys = function() {
  var canvas = document.getElementById('canvas'),
    context = canvas.getContext('2d'),
    _this = this;

  this.keys.forEach(function(key) {
    context.beginPath();
    context.rect(key.x, 0, key.width, key.height);
    context.fillStyle = key.color;
    context.fill();
    context.lineWidth = 2;
    context.strokeStyle = 'black';
    context.stroke();
  });
};

Leapiano.Piano.prototype.generateKeys = function(keyCount) {
  var note = 25,
    noteStep = (100.0 - 25.0) / keyCount,
    keyX = 0,
    keyWidth = this.canvasWidth / keyCount,
    keyHeight = this.canvasHeight;

  for (var i = 0; i < keyCount; i++) {
    this.keys.push({
      note: parseInt(note),
      lastPressed: 0.0,
      color: 'white',
      x: keyX,
      width: keyWidth,
      height: keyHeight
    });
    
    note += noteStep;
    keyX += keyWidth;

  }
};

Leapiano.Piano.prototype.playKey = function(position, yVelocity) {
  var key = this.getKeyPressed(position),
      now = (new Date()).getTime();

  if (!key) return; 

  key.color = 'rgb(250, 250, 250)';

  if (-1 * yVelocity > this.minimumVelocity) {
    if (now - key.lastPressed > 1.0) {
      this.midi.noteOn(0, key.note, parseInt(yVelocity * 30.0), 0); // plays note once loaded.
      key.lastPressed = now;
    }
  }
};

Leapiano.Piano.prototype.getKeyPressed = function(position) {
  var pianoSize = (this.maxX - this.minX),
    keySize = pianoSize / this.keys.length,
    x = position[Leapiano.X] + this.maxX,
    key = parseInt(x / keySize) - 1;

  return this.keys[key];
};