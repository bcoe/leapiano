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
    _this.checkForFingerEvents(obj);
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
    piano: null
  }, opts);
};

Leapiano.Finger.prototype.update = function(position, velocity) {

  if (!this.previousPosition) {
    this.previousPosition = position;
    return;
  }

  var yVelocity = position[Leapiano.Y] - this.previousPosition[Leapiano.Y];

  this.piano.playKey(position, yVelocity);

  this.previousPosition = position;
};

Leapiano.Piano = function(opts) {
  _.extend(this, {
    midi: null,
    minX: -240.0,
    maxX: 240.0,
    minimumVelocity: 1.5,
    keys: []
  }, opts);

  this.generateKeys(24);
}

Leapiano.Piano.prototype.generateKeys = function(keyCount) {
  var note = 25,
    noteStep = (100.0 - 25.0) / keyCount;

  for (var i = 0; i < keyCount; i++) {
    this.keys.push({
      note: parseInt(note),
      lastPressed: 0.0
    });
    note += noteStep;
  }
};

Leapiano.Piano.prototype.playKey = function(position, yVelocity) {
  if (yVelocity > this.minimumVelocity) {

    var key = this.getKeyPressed(position),
      now = (new Date()).getTime();

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
    key = Math.min(parseInt(x / keySize), this.keys.length - 1);

  return this.keys[key];
};