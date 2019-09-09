'use strict';

/* global goo */

var setup = function (args, ctx) {
	BeatSync.setTempo(args.tempo);
};

var cleanup = function (args, ctx) {
	BeatSync.clear();
};

var update = function (args, ctx) {
	BeatSync.process();
};

var parameters = [{
	key: 'tempo',
	type: 'int',
	'default': 120,
	min: 60,
	max: 300
}];

// BeatSync
window.BeatSync = (function() {
	var _tempo = 120;
	var _startTime = goo.AudioContext.getContext().currentTime;
	var _currentTime = _startTime;
	var _arms = [];
	var _tweens = [];
	var _barTime = 60 / _tempo;
	
	function setTempo(tempo) {
		_currentTime = goo.AudioContext.getContext().currentTime;
		var previousStartTime = _startTime;
		var previousBeat = nextBeat() - _barTime * 4;
		var offset = _currentTime - previousBeat;
		var barOffset = offset / _barTime;
		_tempo = tempo;
		_barTime = 60 / _tempo;
		_startTime = _currentTime - barOffset * _barTime;
	}
	function clear() {
		_tweens = [];
		_arms = [];
	}
	
	function nextBeat(barOffset, quantization) {
		if (_currentTime < goo.AudioContext.getContext().currentTime - 1) {
			_currentTime = goo.AudioContext.getContext().currentTime;
		}
		quantization = quantization || 1;
		barOffset = barOffset || 0;

		var quantizedBarTime = _barTime * 4 / quantization;

		var next = Math.ceil((_currentTime - _startTime) / quantizedBarTime) * quantizedBarTime +
			_startTime +
			barOffset * _barTime;
		while (next <= _currentTime) {
			next += quantizedBarTime;
		}
		return next;		
	}
	
	function arm(callback, barOffset, quantization) {
		_arms.push({
			startTime: nextBeat(barOffset, quantization),
			callback: callback
		});
	}
	
	function tween(callback, barOffset, quantization, barLength) {
		return goo.PromiseUtils.createPromise(function(resolve, reject) {
			var startTime;
			var duration = barLength * _barTime;
			if (barLength !== undefined) {
				startTime = nextBeat(barOffset, quantization);
				duration = barLength * _barTime;
			} else {
				startTime = _currentTime;
				duration = nextBeat(barOffset, quantization) - startTime;
			}
			_tweens.push({
				startTime: startTime,
				duration: duration,
				callback: function(t) {
					t = Math.min(t, 1);
					callback(t);
					if (t === 1) {
						resolve();
						return true;
					} else {
						return false;
					}
				}
			});
		});		
	}
	function process() {
		_currentTime = goo.AudioContext.getContext().currentTime;
		for (var i = _tweens.length - 1; i >= 0; i--) {
			var tween = _tweens[i];
			if (_currentTime < tween.startTime) {
				continue;
			}
			var t = (_currentTime - tween.startTime) / tween.duration;
			var isDone = tween.callback(t);
			if (isDone) {
				_tweens.splice(i, 1);
			}
		}
		for (var i = _arms.length - 1; i >= 0; i--) {
			var arm = _arms[i];
			if (_currentTime >= arm.startTime) {
				arm.callback();
				_arms.splice(i, 1);
			}
		}			
	}
	return {
		setTempo: setTempo,
		nextBeat: nextBeat,
		arm: arm,
		tween: tween,
		process: process,
		clear: clear,
		getCurrentTime: function() { return _currentTime; }
	};
}());


// Engine fix
goo.Sound.prototype.stop = function (when) {
	this._paused = false;
	this._pausePos = 0;
	if (this._endPromise) {
		this._endPromise.resolve();
	}
	if (this._currentSource) {
		this._stop(when);
	}
};

goo.Sound.prototype._stop = function (when) {
	when = when || 0;
	this._currentSource.stop(when);
	this._currentSource = null;
};