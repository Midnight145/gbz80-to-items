
// Because it IS better !
'use strict';


// Hexadecimal digits.
var hexits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f'];
// Converts hex (a hex number as a string) into its decimal counterpart.
// hex's letters must be caps. (use String.toUpperCase())
function hexToDec(hex) {
	var dec = 0;
	// Avoid recalculating hex.length...
	var n = hex.length;
	
	for(var i = 0; i < n; i++) {
		var hexitDec = hexits.indexOf(hex[i].toLowerCase());
		// Check if it's a valid hex during translation
		if(hexitDec == -1) {
			throw new AsmError('Invalid hexadecimal ' + hex);
		}
		
		dec = dec * 16 + hexitDec;
	}
	
	return dec;
}

// Performs the opposite as hexToDec.
function decToHex(dec) {
	var hex = '';
	
	while(dec || hex.length < 2) {
		hex = hexits[dec % 16] + hex;
		dec = Math.floor(dec / 16);
	}
	
	return hex;
}

// Needs no explanation.
function binToDec(bin) {
	var dec = 0;
	var n = bin.length;
	
	for(var i = 0; i < n; i++) {
		dec *= 2;
		
		if(bin[i] == '1') {
			dec++;
		} else if(bin[i] != '0') {
			throw new AsmError('Invalid binary ' + bin);
		}
	}
	
	return dec;
}

// Give a hex number in the usual format, attempt to extract the hex part.
// If success return the decimal, otherwise return NaN.
var regHex = /^(\$|hex::?|0x)?([0-9A-Fa-f]+)(h|H)?$/;
function parseHex(str) {
	if(typeof str != 'string') {
		throw new TypeError('Expected a string !');
	}
	
	// We need either a prefix or a suffix, but not both.
	if(str.match(regHex) && (RegExp.$1 != '') != (RegExp.$3 != '')) {
		return hexToDec(RegExp.$2);
	} else {
		throw new AsmError(str + ' is badly formatted hexadecimal !');
	}
}

// Same.
var regBin = /^(%|bin::?|0b)?([01]+)(b|B)?$/;
function parseBin(str) {
	if(typeof str != 'string') {
		throw new TypeError('Expected a string !');
	}
	
	// We need either a prefix or a suffix, but not both.
	if(str.match(regBin) && (RegExp.$1 != '') != (RegExp.$3 != '')) {
		return binToDec(RegExp.$2);
	} else {
		throw new AsmError(str + ' is badly formatted binary !');
	}
}



// Custom error type. HEEEELL YEAAAA.
function AsmError(message) {
	this.message = message || '';
	
	// Remove the call to this constructor from the stack.
	var stack = (new Error()).stack.split('\n');
	this.stack = this.stack || stack.slice(1).join('\n');
	
	// Add info on the caller - this is where the exception is being thrown, after all.
	var callerInfo = stack[1].slice(stack[1].indexOf('@') + 1).split(':');
	this.fileName = this.fileName || callerInfo.slice(0, -2).join(':');
	this.lineNumber = this.lineNumber || parseInt(callerInfo.slice(-2, -1)) || '';
	this.columnNumber = this.columnNumber || parseInt(callerInfo.slice(-1)) || '';
	
	console.error(message);
}
AsmError.prototype = Object.create(Error.prototype);
AsmError.prototype.constructor = AsmError;
AsmError.prototype.name = 'AsmError';



// Global vars. Flushed before use anyways.
var byteStream = [], currentGlobalLabel = '', labels = [];
// Used for syntax checking.
var reg8  = ['b', 'c', 'd', 'e', 'h', 'l', '(hl)', 'a'],
	reg16 = ['bc', 'de', 'hl', 'af'],
	conds = ['nz', 'z', 'nc', 'c'];

function readByte(operand) {
	if(operand.length != 1) {
		throw new AsmError('Only one operand expected to readByte !');
	} else if(operand[0] == '') {
		throw new AsmError('Empty operand given !');
	}
	
	operand = operand[0];
	var number = operand;
	if(operand.match(/^\d+$/)) {
		// Decimal
		number = parseInt(operand);
	} else if(operand.match(regHex)) {
		// Hex
		number = parseHex(operand);
	} else if(operand.match(regBin)) {
		// Bin
		number = parseBin(operand);
	} else if(typeof operand == 'string') {
		// Label
		byteStream.push({size: 1, name: operand, isLabel: false});
		return 1;
	} else {
		throw new AsmError('Invalid operand passed to readByte !');
	}
	
	if(number < 0 || number > 256) {
		throw new AsmError(operand + ' is not a 8-bit number !');
	} else {
		byteStream.push(number);
	}
	
	return 1;
}

function readWord(operand) {
	if(operand.length != 1) {
		throw new AsmError('Only one operand expected to readWord !');
	} else if(operand[0] == '') {
		throw new AsmError('Empty operand given !');
	}
	
	operand = operand[0];
	var number = operand;
	if(operand.match(/^\d+$/)) {
		// Decimal
		number = parseInt(operand);
	} else if(operand.match(regHex)) {
		// Hexadecimal
		number = parseHex(operand);
	} else if(operand.match(regBin)) {
		// Binary
		number = parseBin(operand);
	} else if(typeof operand == 'string') {
		// Label
		byteStream.push({size: 2, name: operand, isLabel: false});
		byteStream.push(0);
		return 2;
	} else {
		throw new AsmError('Invalid operand passed to readWord !');
	}
	
	if(number < 0 || number > 65535) {
		throw new AsmError(operand + ' is not a 16-bit number !');
	} else {
		byteStream.push(number % 256);
		byteStream.push(Math.floor(number / 256));
	}
	
	return 2;
}

function determineLdType(operand) {
	if(operand.length != 2) {
		throw new AsmError('ld needs two operands !');
	}
	
	var target = reg8.indexOf(operand[0]);
	var dest;
	if(target != -1) {
		// Check for a reg8 target.
		dest = reg8.indexOf(operand[1]);
		if(dest != -1) {
			// That's reg8 to reg8. The easy one.
			
			byteStream.push(64 + target * 8 + dest);
			return 1;
		} else if(target == 7 && operand[1][0] == '(' && operand[1][operand[1].length - 1] == ')') {
			// A memory load to a.
			if(operand[1] == '(bc)') {
				// ld a, (bc)
				
				byteStream.push(10);
				return 1;
			} else if(operand[1] == '(de)') {
				// ld a, (de)
				
				byteStream.push(26);
				return 1;
			} else if(operand[1] == '(hli)') {
				
				byteStream.push(42);
				return 1;
			} else if(operand[1] == '(hld)') {
				
				byteStream.push(58);
				return 1;
			} else if(operand[1] == '(c)' || /\(\$?ff00\+c\)/.test(operand[1])) {
				
				byteStream.push(242);
				return 1;
			} else {
				// ld a, (mem16)
				
				byteStream.push(250);
				readWord([operand[1].slice(1, -1).trim()]);
				return 3;
			}
			
		} else {
			// Assume an immediate load.
			byteStream.push(6 + target * 8);
			readByte([operand[1]]);
			
			return 2;
		}
		
	} else if(operand[1] == 'a') {
		// Memory load from a
		if(operand[0] == '(bc)') {
			
			byteStream.push(2);
			return 1;
		} else if(operand[0] == '(de)') {
			
			byteStream.push(18);
			return 1;
		} else if(operand[0] == '(hli)') {
			
			byteStream.push(34);
			return 1;
		} else if(operand[0] == '(hld)') {
			
			byteStream.push(50);
			return 1;
		} else if(operand[0] == '(c)' || /\(\$?ff00\+c\)/.test(operand[0])) {
			
			byteStream.push(226);
			return 1;
		} else {
			// ld (mem16), a
			
			byteStream.push(234);
			readWord([operand[0].slice(1, -1).trim()]);
			return 3;
		}
	} else if(operand[0] == 'bc') {
		// ld bc, imm16
		
		byteStream.push(1);
		readWord([operand[1]]);
		return 3;
	} else if(operand[0] == 'de') {
		// ld de, imm16
		
		byteStream.push(17);
		readWord([operand[1]]);
		return 3;
	} else if(operand[0] == 'hl') {
		if(operand[1].match(/^\(\s*sp\s*\+(-?\s*(?:\d+)|((?:\$|hex::?|0x)?(?:[0-9A-Fa-f]+)(?:h|H)?)|((?:%|bin::?|0b)?(?:[01]+)(?:b|B)?))\s*\)$/)) {
			// ld hl, [sp+imm8]
			
			byteStream.push(248);
			readByte([RegExp.$1]);
			return 2;
		} else {
			// ld hl, imm16
			byteStream.push(33);
			readWord([operand[1]]);
			return 3;
		}
	} else if(operand[0] == 'sp') {
		if(operand[1] == 'hl') {
			byteStream.push(249);
			return 1;
		} else {
			byteStream.push(49);
			readWord(operand[1]);
			return 3;
		}
	} else {
		throw new AsmError('Unknown operands to ld !');
	}
}

function determineLdiType(operand) {
	if(operand.length != 2) {
		throw new AsmError('ldi takes exactly two arguments !');
	}
	
	if(operand[0] == 'a' && operand[1] == '(hl)') {
		byteStream.push(42);
	} else if(operand[0] == '(hl)' && operand[1] == 'a') {
		byteStream.push(34);
	} else {
		throw new AsmError('Invalid use of ldi ! Either "ldi (hl), a" or "ldi a, (hl)" are valid.');
	}
	
	return 1;
}

function determineLddType(operand) {
	if(operand.length != 2) {
		throw new AsmError('ldd takes exactly two arguments !');
	}
	
	if(operand[0] == 'a' && operand[1] == '(hl)') {
		byteStream.push(58);
	} else if(operand[0] == '(hl)' && operand[1] == 'a') {
		byteStream.push(50);
	} else {
		throw new AsmError('Invalid use of ldd ! Either "ldd (hl), a" or "ldd a, (hl)" are valid.');
	}
	
	return 1;
}

function determineLdhType(operand) {
	if(operand.length != 2) {
		throw new AsmError('ldh takes exactly two arguments !');
	}
	
	if(operand[0] != 'a' && operand[1] != 'a') {
		throw new AsmError('ldh requires a as one of its operands !');
	}
	
	var isLoadFromMem = operand[0] == 'a';
	var memAccess = operand[0 + isLoadFromMem].trim();
	if(memAccess.match(/^\(((\$|hex::?|0x)?[fF]{2}00(h|H)?\s+\+\s+)?c\)$/) || memAccess == '(c)') {
		if(isLoadFromMem) {
			throw new AsmError('Invalid operand to ldh !');
		}
		
		// ldh ($FF00 + c), a
		byteStream.push(226);
		return 1;
	} else if(memAccess.match(/^\((?:\$|hex::?|0x)(?:[fF]{2}(?:00\s+\+\s+(?:\$|hex::?|0x)?)?)?([0-9A-Fa-f]{2})\)$/)) {
		byteStream.push(224 + isLoadFromMem * 16);
		readByte(['$' + RegExp.$1]);
		return 2;
	} else {
		throw new AsmError('Invalid operand to ldh : ' + memAccess);
	}
}

function determineAddType(operand) {
	if(operand.length != 2) {
		try {
			// Try to read a "add imm8", and but throw an operand error if it fails
			if(operand.length != 1) {
				// Error message doesn't matter : it will be caught.
				throw new AsmError('Welp, at least I tried being lenient.');
			}
			
			byteStream.push(198);
			readByte(operand);
			return 2;
			
		} catch(err) {
			throw new AsmError('add takes exactly 2 operands !');
		}
	}
	
	var reg2;
	if(operand[0] == 'hl') {
		reg2 = reg16.indexOf(operand[1]);
		if(reg2 == -1) {
			throw new AsmError('add hl, reg16 expects a 16-bit register as second argument, but ' + operand[1] + ' obtained.');
		}
		
		byteStream.push(reg2 * 16 + 9);
		return 1;
		
	} else if(operand[0] == 'a') {
		reg2 = reg8.indexOf(operand[1]);
		if(reg2 == -1) {
			// Immediate add
			byteStream.push(198);
			readByte(operand.slice(1));
			return 2;
		}
		
		byteStream.push(128 + reg2);
		return 1;
	} else {
		throw new AsmError('add can only have a or hl as target !');
	}
}

function determineAdcType(operand) {
	var source;
	
	if(operand.length != 1) {
		if(operand.length != 2) {
			throw new AsmError('adc takes exactly 2 operands !');
		} else if(operand[0] != 'a') {
			throw new AsmError('Only possible target for adc is a !');
		}
		source = operand[1];
	} else {
		source = operand[0];
	}
	
	var sourceID = reg8.indexOf(source);
	if(sourceID != -1) {
		byteStream.push(136 + sourceID);
		return 1;
	} else {
		byteStream.push(206);
		readByte([source]);
		return 2;
	}
}

function determineSubType(operand) {
	var source;
	
	if(operand.length != 1) {
		if(operand.length != 2) {
			throw new AsmError('sub takes exactly 2 operands !');
		} else if(operand[0] != 'a') {
			throw new AsmError('Only possible target for sub is a !');
		}
		source = operand[1];
	} else {
		source = operand[0];
	}
	
	var sourceID = reg8.indexOf(source);
	if(sourceID != -1) {
		byteStream.push(144 + sourceID);
		return 1;
	} else {
		byteStream.push(214);
		readByte([source]);
		return 2;
	}
}

function determineSbcType(operand) {
	var source;
	
	if(operand.length != 1) {
		if(operand.length != 2) {
			throw new AsmError('sbc takes exactly 2 operands !');
		} else if(operand[0] != 'a') {
			throw new AsmError('Only possible target for sbc is a !');
		}
		source = operand[1];
	} else {
		source = operand[0];
	}
	
	var sourceID = reg8.indexOf(source);
	if(sourceID != -1) {
		byteStream.push(152 + sourceID);
		return 1;
	} else {
		byteStream.push(222);
		readByte([operand[1]]);
		return 2;
	}
}

function determineIncType(operand) {
	if(operand.length != 1) {
		throw new AsmError('inc takes exactly one argument !');
	}
	
	var reg = reg8.indexOf(operand[0]);
	if(reg != -1) {
		byteStream.push(4 + reg * 8);
		return 1;
	}
	
	reg = reg16.indexOf(operand[0]);
	if(reg != -1) {
		byteStream.push(3 + reg * 16);
		return 1;
	}
	
	if(operand[0] == 'sp') {
		byteStream.push(51);
		return 1;
	} else {
		throw new AsmError('Expected a reg8, reg16 or sp as operand for inc, but got \'' + operand + '\'')
	}
}

function determineDecType(operand) {
	if(operand.length != 1) {
		throw new AsmError('dec takes exactly one argument !');
	}
	
	var reg = reg8.indexOf(operand[0]);
	if(reg != -1) {
		byteStream.push(5 + reg * 8);
		return 1;
	}
	
	reg = reg16.indexOf(operand[0]);
	if(reg != -1) {
		byteStream.push(11 + reg * 16);
		return 1;
	}
	
	if(operand[0] == 'sp') {
		byteStream.push(59);
		return 1;
	} else {
		throw new AsmError('Expected a reg8, reg16 or sp as operand for dec, but got \'' + operand + '\'')
	}
}

function determineAndType(operand) {
	var source;
	
	if(operand.length != 1) {
		if(operand.length != 2) {
			throw new AsmError('and takes exactly 2 operands !');
		} else if(operand[0] != 'a') {
			throw new AsmError('Only possible target for and is a !');
		}
		source = operand[1];
	} else {
		source = operand[0];
	}
	
	var sourceID = reg8.indexOf(source);
	if(sourceID != -1) {
		byteStream.push(160 + sourceID);
		return 1;
	} else {
		byteStream.push(230);
		readByte([source]);
		return 2;
	}
}

function determineOrType(operand) {
	var source;
	
	if(operand.length != 1) {
		if(operand.length != 2) {
			throw new AsmError('or takes exactly 2 operands !');
		} else if(operand[0] != 'a') {
			throw new AsmError('Only possible target for or is a !');
		}
		source = operand[1];
	} else {
		source = operand[0];
	}
	
	var sourceID = reg8.indexOf(source);
	if(sourceID != -1) {
		byteStream.push(176 + sourceID);
		return 1;
	} else {
		byteStream.push(246);
		readByte([source]);
		return 2;
	}
}

function determineXorType(operand) {
	var source;
	
	if(operand.length != 1) {
		if(operand.length != 2) {
			throw new AsmError('xor takes exactly 2 operands !');
		} else if(operand[0] != 'a') {
			throw new AsmError('Only possible target for xor is a !');
		}
		source = operand[1];
	} else {
		source = operand[0];
	}
	
	var sourceID = reg8.indexOf(source);
	if(sourceID != -1) {
		byteStream.push(168 + sourceID);
		return 1;
	} else {
		byteStream.push(238);
		readByte([source]);
		return 2;
	}
}

function determineCpType(operand) {
	var source;
	
	if(operand.length != 1) {
		if(operand.length != 2) {
			throw new AsmError('cp takes exactly 2 operands !');
		} else if(operand[0] != 'a') {
			throw new AsmError('Only possible target for cp is a !');
		}
		source = operand[1];
	} else {
		source = operand[0];
	}
	
	var sourceID = reg8.indexOf(source);
	if(sourceID != -1) {
		byteStream.push(184 + sourceID);
		return 1;
	} else {
		byteStream.push(254);
		readByte([source]);
		return 2;
	}
}

function determineJrTypeAndDest(operand) {
	if(operand.length == 1) {
		operand.push(operand[0]);
		byteStream.push(24);
	} else if(operand.length == 2) {
		var cond = conds.indexOf(operand[0]);
		if(cond == -1) {
			throw new AsmError('Invalid condition for jr !');
		}
		
		byteStream.push(32 + cond * 8);
	} else {
		throw new AsmError('Invalid operands to jr ! ');
	}
	
	readWord([operand[1]]);
	var high = byteStream.pop(), low = byteStream.pop();
	if(typeof low == 'object') {
		low.size = 1;
		low.isLabel = true;
		byteStream.push(low);
	} else {
		
		var addr = high * 256 + low;
		var i = 0, uniqueName = 'jr:0';
		while(labels.indexOf(uniqueName) != -1) {
			i++;
			uniqueName = 'jr:' + i;
		}
		labels.push({name: uniqueName, offset: addr});
		byteStream.push({size: 1, name: uniqueName, isLabel: true});
	}

	return 2;
}

function determineJpTypeAndDest(operand) {
	if(operand.length == 1) {
		if(operand[0] == 'hl' || operand[0] == '(hl)') {
			// jp (hl)
			byteStream.push(233);
			return 1;
		}
		
		operand.push(operand[0]);
		byteStream.push(195);
	} else if(operand.length == 2) {
		var cond = conds.indexOf(operand[0]);
		if(cond == -1) {
			throw new AsmError('Invalid condition for jp !');
		}
		
		byteStream.push(194 + cond * 8);
	} else {
		throw new AsmError('Invalid operands to jp ! ');
	}
	
	readWord([operand[1]]);
	if(typeof byteStream[byteStream.length - 2] == 'object') {
		byteStream[byteStream.length - 2].isLabel = true;
	}
	return 3;
}

function determineCallTypeAndDest(operand) {
	if(operand.length == 1) {
		operand.push(operand[0]);
		byteStream.push(205);
	} else if(operand.length == 2) {
		var cond = conds.indexOf(operand[0]);
		if(cond == -1) {
			throw new AsmError('Invalid condition for call !');
		}
		
		byteStream.push(196 + cond * 8);
	} else {
		throw new AsmError('Invalid operands to call ! ');
	}
	
	readWord([operand[1]]);
	if(typeof byteStream[byteStream.length - 2] == 'object') {
		byteStream[byteStream.length - 2].isLabel = true;
	}
	return 3;
}

function determineRetType(operand) {
	if(operand.length != 1) {
		throw new AsmError('ret takes only one operand !');
	}
	
	if(operand[0] == '') {
		byteStream.push(201);
	} else {
		var condOfs = conds.indexOf(operand[0]);
		if(condOfs == -1) {
			throw new AsmError('ret takes one of the following conditionals : nz, z, nc, or c');
		}
		
		byteStream.push(192 + condOfs * 8);
	}
	return 1;
}

function determineRstDestination(operand) {
	if(operand.length != 1) {
		throw new AsmError('rst takes exactly one operand !');
	} else if(!operand[0].match(/^[0-3][08]h$/)) {
		throw new AsmError('rst vector must be of 00h, 08h, 10h, 18h, 20h, 28h, 30h, or 38h !');
	}
	
	byteStream.push(199 + parseHex(operand[0]));
	return 1;
}

function determinePushType(operand) {
	if(operand.length != 1) {
		throw new AsmError('push takes exactly one operand !');
	}
	
	var reg = reg16.indexOf(operand[0]);
	if(reg == -1) {
		throw new AsmError('push : unknown operand ' + operand[0] + ' (expected bc, de, hl or af)');
	}
	
	byteStream.push(197 + reg * 16);
	return 1;
}

function determinePopType(operand) {
	if(operand.length != 1) {
		throw new AsmError('pop takes exactly one operand !');
	}
	
	var reg = reg16.indexOf(operand[0]);
	if(reg == -1) {
		throw new AsmError('pop : unknown operand ' + operand[0] + ' (expected bc, de, hl or af)');
	}
	
	byteStream.push(193 + reg * 16);
	return 1;
}

function placeNop(operand) {
	if(operand.length != 1 || operand[0] != '') {
		throw new AsmError('nop takes no operands !');
	}
	
	byteStream.push(0);
	return 1;
}

function placeScf(operand) {
	if(operand.length != 1 || operand[0] != '') {
		throw new AsmError('scf takes no operands !');
	}
	
	byteStream.push(55);
	return 1;
}

function placeCcf(operand) {
	if(operand.length != 1 || operand[0] != '') {
		throw new AsmError('ccf takes no operands !');
	}
	
	byteStream.push(63);
	return 1;
}

function placeCpl(operand) {
	if(operand.length != 1 || operand[0] != '') {
		throw new AsmError('cpl takes no operands !');
	}
	
	byteStream.push(47);
	return 1;
}

function placeDaa(operand) {
	if(operand.length != 1 || operand[0] != '') {
		throw new AsmError('daa takes no operands !');
	}
	
	byteStream.push(39);
	return 1;
}

function placeRla(operand) {
	if(operand.length != 1 || operand[0] != '') {
		throw new AsmError('rla takes no operands !');
	}
	
	byteStream.push(23);
	return 1;
}

function placeRra(operand) {
	if(operand.length != 1 || operand[0] != '') {
		throw new AsmError('rra takes no operands !');
	}
	
	byteStream.push(31);
	return 1;
}

function placeRlca(operand) {
	if(operand.length != 1 || operand[0] != '') {
		throw new AsmError('rlca takes no operands !');
	}
	
	byteStream.push(7);
	return 1;
}

function placeRrca(operand) {
	if(operand.length != 1 || operand[0] != '') {
		throw new AsmError('rrca takes no operands !');
	}
	
	byteStream.push(15);
	return 1;
}

function determineRlcType(operand) {
	if(operand.length != 1) {
		throw new AsmError('rlc takes only one operand !');
	}
	
	var reg = reg8.indexOf(operand[0]);
	if(reg == -1) {
		throw new AsmError('rlc\'s operand mus be a reg8 !');
	}
	
	byteStream.push(203);
	byteStream.push(reg);
	return 2;
}

function determineRrcType(operand) {
	if(operand.length != 1) {
		throw new AsmError('rrc takes only one operand !');
	}
	
	var reg = reg8.indexOf(operand[0]);
	if(reg == -1) {
		throw new AsmError('rrc\'s operand mus be a reg8 !');
	}
	
	byteStream.push(203);
	byteStream.push(8 + reg);
	return 2;
}

function determineRlType(operand) {
	if(operand.length != 1) {
		throw new AsmError('rl takes only one operand !');
	}
	
	var reg = reg8.indexOf(operand[0]);
	if(reg == -1) {
		throw new AsmError('rl\'s operand mus be a reg8 !');
	}
	
	byteStream.push(203);
	byteStream.push(16 + reg);
	return 2;
}

function determineRrType(operand) {
	if(operand.length != 1) {
		throw new AsmError('rr takes only one operand !');
	}
	
	var reg = reg8.indexOf(operand[0]);
	if(reg == -1) {
		throw new AsmError('rr\'s operand mus be a reg8 !');
	}
	
	byteStream.push(203);
	byteStream.push(24 + reg);
	return 2;
}

function determineSlaType(operand) {
	if(operand.length != 1) {
		throw new AsmError('sla takes only one operand !');
	}
	
	var reg = reg8.indexOf(operand[0]);
	if(reg == -1) {
		throw new AsmError('sla\'s operand mus be a reg8 !');
	}
	
	byteStream.push(203);
	byteStream.push(32 + reg);
	return 2;
}

function determineSraType(operand) {
	if(operand.length != 1) {
		throw new AsmError('sra takes only one operand !');
	}
	
	var reg = reg8.indexOf(operand[0]);
	if(reg == -1) {
		throw new AsmError('sra\'s operand mus be a reg8 !');
	}
	
	byteStream.push(203);
	byteStream.push(40 + reg);
	return 2;
}

function determineSwapType(operand) {
	if(operand.length != 1) {
		throw new AsmError('swap takes only one operand !');
	}
	
	var reg = reg8.indexOf(operand[0]);
	if(reg == -1) {
		throw new AsmError('swap\'s operand mus be a reg8 !');
	}
	
	byteStream.push(203);
	byteStream.push(48 + reg);
	return 2;
}

function determineSrlType(operand) {
	if(operand.length != 1) {
		throw new AsmError('srl takes only one operand !');
	}
	
	var reg = reg8.indexOf(operand[0]);
	if(reg == -1) {
		throw new AsmError('srl\'s operand mus be a reg8 !');
	}
	
	byteStream.push(203);
	byteStream.push(56 + reg);
	return 2;
}

function determineBitType(operand) {
	if(operand.length != 2) {
		throw new AsmError('bit takes exactly two operands !');
	}
	
	var bit = parseInt(operand[0]);
	if(isNaN(bit) || bit < 0 || bit > 7) {
		throw new AsmError('bit\'s first operand must be a number in range 0 - 7 (inclusive) !');
	}
	
	var reg = reg8.indexOf(operand[1]);
	if(reg == -1) {
		throw new AsmError('bit\'s second operand must be a reg8 !');
	}
	
	byteStream.push(203);
	byteStream.push(64 + bit * 8 + reg);
	return 2;
}

function determineResType(operand) {
	if(operand.length != 2) {
		throw new AsmError('res takes exactly two operands !');
	}
	
	var bit = parseInt(operand[0]);
	if(isNaN(bit) || bit < 0 || bit > 7) {
		throw new AsmError('res\'s first operand must be a number in range 0 - 7 (inclusive) !');
	}
	
	var reg = reg8.indexOf(operand[1]);
	if(reg == -1) {
		throw new AsmError('res\'s second operand must be a reg8 !');
	}
	
	byteStream.push(203);
	byteStream.push(128 + bit * 8 + reg);
	return 2;
}

function determineSetType(operand) {
	if(operand.length != 2) {
		throw new AsmError('set takes exactly two operands !');
	}
	
	var bit = parseInt(operand[0]);
	if(isNaN(bit) || bit < 0 || bit > 7) {
		throw new AsmError('set\'s first operand must be a number in range 0 - 7 (inclusive) !');
	}
	
	var reg = reg8.indexOf(operand[1]);
	if(reg == -1) {
		throw new AsmError('set\'s second operand must be a reg8 !');
	}
	
	byteStream.push(203);
	byteStream.push(192 + bit * 8 + reg);
	return 2;
}

function placeHalt(operand) {
	if(operand.length != 1 || operand[0] != '') {
		throw new AsmError('nop takes no operands !');
	}
	
	byteStream.push(118);
	return 1;
}

function placeStop(operand) {
	if(operand.length != 1 || operand[0] != '') {
		throw new AsmError('nop takes no operands !');
	}
	
	byteStream.push(16);
	byteStream.push(0);
	return 2;
}

function placeEi(operand) {
	if(operand.length != 1 || operand[0] != '') {
		throw new AsmError('nop takes no operands !');
	}
	
	byteStream.push(251);
	return 1;
}

function placeDi(operand) {
	if(operand.length != 1 || operand[0] != '') {
		throw new AsmError('nop takes no operands !');
	}
	
	byteStream.push(243);
	return 1;
}

function placeReti(operand) {
	if(operand.length != 1 || operand[0] != '') {
		throw new AsmError('nop takes no operands !');
	}
	
	byteStream.push(217);
	return 1;
}

var instructions = [{name: 'db', func: readByte}, {name: 'dw', func: readWord},
					{name: 'ld', func: determineLdType}, {name: 'ldi', func: determineLdiType}, {name: 'ldd', func: determineLddType}, {name: 'ldh', func: determineLdhType},
					{name: 'add', func: determineAddType}, {name: 'adc', func: determineAdcType}, {name: 'sub', func: determineSubType}, {name: 'sbc', func: determineSbcType},
					{name: 'inc', func: determineIncType}, {name: 'dec', func: determineDecType},
					{name: 'and', func: determineAndType}, {name: 'or', func: determineOrType}, {name: 'xor', func: determineXorType}, {name: 'cp', func: determineCpType},
					{name: 'jr', func: determineJrTypeAndDest}, {name: 'jp', func: determineJpTypeAndDest},
					{name: 'call', func: determineCallTypeAndDest}, {name: 'ret', func: determineRetType}, {name: 'rst', func: determineRstDestination},
					{name: 'push', func: determinePushType}, {name: 'pop', func: determinePopType},
					{name: 'nop', func: placeNop},
					{name: 'scf', func: placeScf}, {name: 'ccf', func: placeCcf}, {name: 'cpl', func: placeCpl}, {name: 'daa', func: placeDaa},
					{name: 'rla', func: placeRla}, {name: 'rra', func: placeRra}, {name: 'rlca', func: placeRlca}, {name: 'rrca', func: placeRrca},
					{name: 'rlc', func: determineRlcType}, {name: 'rrc', func: determineRrcType}, {name: 'rl', func: determineRlType}, {name: 'rr', func: determineRrType},
						{name: 'swap', func: determineSwapType}, {name: 'srl', func: determineSrlType}, {name: 'sla', func: determineSlaType}, {name: 'sra', func: determineSraType},
					{name: 'bit', func: determineBitType}, {name: 'res', func: determineResType}, {name: 'set', func: determineSetType},
					{name: 'halt', func: placeHalt}, {name: 'stop', func: placeStop},
					{name: 'ei', func: placeEi}, {name: 'di', func: placeDi},
					{name: 'reti', func: placeReti}];

var items = [
		"? (0x00)",
		"Master Ball (0x01)",
		"Ultra Ball (0x02)",
		"Brightpowder (0x03)",
		"Great Ball (0x04)",
		"Poké Ball (0x05)",
		"Teru-Sama (0x06)",
		"Bicycle (0x07)",
		"Moon Stone (0x08)",
		"Antidote (0x09)",
		"Burn Heal (0x0A)",
		"Ice Heal (0x0B)",
		"Awakening (0x0C)",
		"Paralyz Heal (0x0D)",
		"Full Restore (0x0E)",
		"Max Potion (0x0F)",
		"Hyper Potion (0x10)",
		"Super Potion (0x11)",
		"Potion (0x12)",
		"Escape Rope (0x13)",
		"Repel (0x14)",
		"Max Elixer (0x15)",
		"Fire Stone (0x16)",
		"Thunderstone (0x17)",
		"Water Stone (0x18)",
		"Teru-Sama (0x19)",
		"HP Up (0x1A)",
		"Protein (0x1B)",
		"Iron (0x1C)",
		"Carbos (0x1D)",
		"Lucky Punch (0x1E)",
		"Calcium (0x1F)",
		"Rare Candy (0x20)",
		"X Accuracy (0x21)",
		"Leaf Stone (0x22)",
		"Metal Powder (0x23)",
		"Nugget (0x24)",
		"Poké Doll (0x25)",
		"Full Heal (0x26)",
		"Revive (0x27)",
		"Max Revive (0x28)",
		"Guard Spec. (0x29)",
		"Super Repel (0x2A)",
		"Max Repel (0x2B)",
		"Dire Hit (0x2C)",
		"Teru-Sama (0x2D)",
		"Fresh Water (0x2E)",
		"Soda Pop (0x2F)",
		"Lemonade (0x30)",
		"X Attack (0x31)",
		"Teru-Sama (0x32)",
		"X Defend (0x33)",
		"X Speed (0x34)",
		"X Special (0x35)",
		"Coin Case (0x36)",
		"Itemfinder (0x37)",
		"Teru-Sama (0x38)",
		"Exp. Share (0x39)",
		"Old Rod (0x3A)",
		"Good Rod (0x3B)",
		"Silver Leaf (0x3C)",
		"Super Rod (0x3D)",
		"PP Up (0x3E)",
		"Ether (0x3F)",
		"Max Ether (0x40)",
		"Elixer (0x41)",
		"Red Scale (0x42)",
		"Secretpotion (0x43)",
		"S.S. Ticket (0x44)",
		"Mystery Egg (0x45)",
		"Teru-Sama (0x46)",
		"Silver Wing (0x47)",
		"Moomoo Milk (0x48)",
		"Quick Claw (0x49)",
		"Psncureberry (0x4A)",
		"Gold Leaf (0x4B)",
		"Soft Sand (0x4C)",
		"Sharp Beak (0x4D)",
		"Przcureberry (0x4E)",
		"Burnt Berry (0x4F)",
		"Ice Berry (0x50)",
		"Poison Barb (0x51)",
		"King's Rock (0x52)",
		"Bitter Berry (0x53)",
		"Mint Berry (0x54)",
		"Red Apricorn (0x55)",
		"Tinymushroom (0x56)",
		"Big Mushroom (0x57)",
		"Silverpowder (0x58)",
		"Blu Apricorn (0x59)",
		"Teru-Sama (0x5A)",
		"Amulet Coin (0x5B)",
		"Ylw Apricorn (0x5C)",
		"Grn Apricorn (0x5D)",
		"Cleanse Tag (0x5E)",
		"Mystic Water (0x5F)",
		"Twistedspoon (0x60)",
		"Wht Apricorn (0x61)",
		"Black Belt (0x62)",
		"Blk Apricorn (0x63)",
		"Teru-Sama (0x64)",
		"Pnk Apricorn (0x65)",
		"Blackglasses (0x66)",
		"Slowpoketail (0x67)",
		"Pink Bow (0x68)",
		"Stick (0x69)",
		"Smoke Ball (0x6A)",
		"Nevermeltice (0x6B)",
		"Magnet (0x6C)",
		"Miracleberry (0x6D)",
		"Pearl (0x6E)",
		"Big Pearl (0x6F)",
		"Everstone (0x70)",
		"Spell Tag (0x71)",
		"Ragecandybar (0x72)",
		"Teru-Sama (0x73)",
		"Teru-Sama (0x74)",
		"Miracle Seed (0x75)",
		"Thick Club (0x76)",
		"Focus Band (0x77)",
		"Teru-Sama (0x78)",
		"Energypowder (0x79)",
		"Energy Root (0x7A)",
		"Heal Powder (0x7B)",
		"Revival Herb (0x7C)",
		"Hard Stone (0x7D)",
		"Lucky Egg (0x7E)",
		"Card Key (0x7F)",
		"Machine Part (0x80)",
		"Teru-Sama (0x81)",
		"Lost Item (0x82)",
		"Stardust (0x83)",
		"Star Piece (0x84)",
		"Basement Key (0x85)",
		"Pass (0x86)",
		"Teru-Sama (0x87)",
		"Teru-Sama (0x88)",
		"Teru-Sama (0x89)",
		"Charcoal (0x8A)",
		"Berry Juice (0x8B)",
		"Scope Lens (0x8C)",
		"Teru-Sama (0x8D)",
		"Teru-Sama (0x8E)",
		"Metal Coat (0x8F)",
		"Dragon Fang (0x90)",
		"Teru-Sama (0x91)",
		"Leftovers (0x92)",
		"Teru-Sama (0x93)",
		"Teru-Sama (0x94)",
		"Teru-Sama (0x95)",
		"Mysteryberry (0x96)",
		"Dragon Scale (0x97)",
		"Berserk Gene (0x98)",
		"Teru-Sama (0x99)",
		"Teru-Sama (0x9A)",
		"Teru-Sama (0x9B)",
		"Sacred Ash (0x9C)",
		"Heavy Ball (0x9D)",
		"Flower Mail (0x9E)",
		"Level Ball (0x9F)",
		"Lure Ball (0xA0)",
		"Fast Ball (0xA1)",
		"Teru-Sama (0xA2)",
		"Light Ball (0xA3)",
		"Friend Ball (0xA4)",
		"Moon Ball (0xA5)",
		"Love Ball (0xA6)",
		"Normal Box (0xA7)",
		"Gorgeous Box (0xA8)",
		"Sun Stone (0xA9)",
		"Polkadot Bow (0xAA)",
		"Teru-Sama (0xAB)",
		"Up-Grade (0xAC)",
		"Berry (0xAD)",
		"Gold Berry (0xAE)",
		"Squirtbottle (0xAF)",
		"Teru-Sama (0xB0)",
		"Park Ball (0xB1)",
		"Rainbow Wing (0xB2)",
		"Teru-Sama (0xB3)",
		"Brick Piece (0xB4)",
		"Surf Mail (0xB5)",
		"LiteBlue Mail (0xB6)",
		"Portrait Mail (0xB7)",
		"Lovely Mail (0xB8)",
		"Eon Mail (0xB9)",
		"Morph Mail (0xBA)",
		"Blue Sky Mail (0xBB)",
		"Music Mail (0xBC)",
		"Mirage Mail (0xBD)",
		"Teru-Sama (0xBE)",
		"TM01 (0xBF)",
		"TM02 (0xC0)",
		"TM03 (0xC1)",
		"TM04 (0xC2)",
		"TM04 (useless) (0xC3)",
		"TM05 (0xC4)",
		"TM06 (0xC5)",
		"TM07 (0xC6)",
		"TM08 (0xC7)",
		"TM09 (0xC8)",
		"TM10 (0xC9)",
		"TM11 (0xCA)",
		"TM12 (0xCB)",
		"TM13 (0xCC)",
		"TM14 (0xCD)",
		"TM15 (0xCE)",
		"TM16 (0xCF)",
		"TM17 (0xD0)",
		"TM18 (0xD1)",
		"TM19 (0xD2)",
		"TM20 (0xD3)",
		"TM21 (0xD4)",
		"TM22 (0xD5)",
		"TM23 (0xD6)",
		"TM24 (0xD7)",
		"TM25 (0xD8)",
		"TM26 (0xD9)",
		"TM27 (0xDA)",
		"TM28 (0xDB)",
		"TM28 (useless) (0xDC)",
		"TM29 (0xDD)",
		"TM30 (0xDE)",
		"TM31 (0xDF)",
		"TM32 (0xE0)",
		"TM33 (0xE1)",
		"TM34 (0xE2)",
		"TM35 (0xE3)",
		"TM36 (0xE4)",
		"TM37 (0xE5)",
		"TM38 (0xE6)",
		"TM39 (0xE7)",
		"TM40 (0xE8)",
		"TM41 (0xE9)",
		"TM42 (0xEA)",
		"TM43 (0xEB)",
		"TM44 (0xEC)",
		"TM45 (0xED)",
		"TM46 (0xEE)",
		"TM47 (0xEF)",
		"TM48 (0xF0)",
		"TM49 (0xF1)",
		"TM50 (0xF2)",
		"HM01 (0xF3)",
		"HM02 (0xF4)",
		"HM03 (0xF5)",
		"HM04 (0xF6)",
		"HM05 (0xF7)",
		"HM06 (0xF8)",
		"HM07 (0xF9)",
		"HM08 (0xFA)",
		"HM09 (0xFB)",
		"HM10 (0xFC)",
		"HM11 (0xFD)",
		"HM12 (0xFE)",
		"CANCEL (0xFF)"];
var attribs = [
	{used: false, valid: false, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: false, qty: true},
	{used: false, valid: true, qty: false},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty:true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: false, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: false, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: false},
	{used: false, valid: true, qty: false},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: false},
	{used: false, valid: true, qty: false},
	{used: false, valid: true, qty: false},
	{used: false, valid: true, qty: false},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: false},
	{used: false, valid: true, qty: false},
	{used: false, valid: true, qty: false},
	{used: false, valid: true, qty: false},
	{used: false, valid: false, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: false, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: false, qty: true},
	{used: false, valid: false, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: false},
	{used: false, valid: true, qty: false},
	{used: false, valid: false, qty: true},
	{used: false, valid: true, qty: false},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: false},
	{used: false, valid: true, qty: false},
	{used: false, valid: false, qty: true},
	{used: false, valid: false, qty: true},
	{used: false, valid: false, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: false, qty: true},
	{used: false, valid: false, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: false, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: false, qty: true},
	{used: false, valid: false, qty: true},
	{used: false, valid: false, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: false, qty: true},
	{used: false, valid: false, qty: true},
	{used: false, valid: false, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: false},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: false},
	{used: false, valid: false, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: false, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: false, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: true, qty: true},
	{used: false, valid: false, qty: true},
	{used: false, valid: false, qty: true},
	{used: false, valid: false, qty: true},
	{used: false, valid: false, qty: true},
	{used: false, valid: false, qty: true},
	{used: false, valid: false, qty: true}];
function compile(evt) {
	// Prevent submitting the form (would trigger a page reload or scroll)
	evt.preventDefault();
	
	// Removes the line labels
	$('#dismissError').trigger('click');
	
	// Get all code lines
	var codeElem = document.getElementById('code'),
		lines = codeElem.innerText.split('\n'),
		lastElem = lines.pop();
	
	// Sometimes there is a trailing <br /> that doesn't generate any newline on-screen.
	// If causes a problem with line numbering, though.
	if(lastElem != '') {
		lines.push(lastElem);
	}
	
	codeElem.innerHTML = lines.join('<br />');
	// Declare variables
	var n = lines.length, i, lineNums = [];
	
	for(i = 1; i <= n; i++) {
		lineNums.push('' + i);
	}
	$('#lineNumbers').html(lineNums.join('<br/>')).removeClass('hidden').attr('aria-hidden', 'false');
	
	labels = [];
	currentGlobalLabel = '';
	function getLabelOffset(labelName) {
		var labelOffset = -1;
		labels.forEach(function(label) {
			if(label.name == b) {
				labelOffset = label;
			}
		});
		
		if(labelOffset == -1) {
			throw new AsmError('Line ' + i + ' : Unknown label \'' + b + '\'');
		}
		return labelOffset;
	}
	
	try {
		var offset = hexToDec($('#baseOffset').val().toLowerCase());
	} catch(err) {
		throw new AsmError('Failed to parse Base offset : ' + err.message);
	}
	var baseOffset = offset;
	
	
	/** BEGIN ASSEMBLER **/
	
	// Flush the byte stream
	byteStream = [];
	
	for(i = 0; i < n; ) {
		lines[i].search(/\[(.+)\]/);
		var pieces = lines[i].toLowerCase()
							 .replace('[', '(').replace(']', ')') // Braces will be parsed the same as parentheses. Note that "ld [hl), 1" becomes valid...whatever.
							 .trim() // Trim to make sure the first character is wordy
							 .split(';')[0] // Get the part before the comment,
							 .split(/\s+/); // And split each part, allowing each to be separated by any "white" characters
		var instrName = pieces[0]; // Get the instruction name
		var operands = pieces.slice(1).join('').split(','); // Get the operand part
		
		i++;
		
		if(instrName != '') { // If the line contains nothing, don't process it
			
			if(instrName[0] == '.') {
				// Local label
				// Name will be in format "Global.Local"
				instrName = instrName.trim();
				if(instrName.slice(1) == '') {
					throw new AsmError('Line ' + i + ' : Empty label name !');
				}
				
				if(labels.indexOf(currentGlobalLabel + instrName) != -1) {
					throw new AsmError('Line ' + i + ' : Duplicate label ' + currentGlobalLabel + instrName);
				}
				labels.push({name: currentGlobalLabel + instrName, offset: offset});
				
			} else if(instrName.indexOf(':') != -1) {
				// Global label
				instrName = instrName.replace(':', '').replace(':', '').trim();
				if(instrName == '') {
					throw new AsmError('Line ' + i + ' : Empty label name !');
				}
				
				if(labels.indexOf(instrName) != -1) {
					throw new AsmError('Line ' + i + ' : Duplicate label ' + instrName);
				}
				labels.push({name: instrName, offset: offset});
				currentGlobalLabel = instrName;
				
			} else {
				// Instruction
				var ranFunc = false;
				instructions.forEach(function(instruction) {
					if(instruction.name == instrName) {
						// The function return how many bytes were written.
						try {
							var len = instruction.func(operands);
							offset += len;
							
							// Add the current line number to all added objects
							for(var index = 1; index <= len; index++) {
								if(typeof byteStream[byteStream.length - index] == 'object') {
									byteStream[byteStream.length - index].line = i;
								}
							}
						} catch(err) {
							err.message = 'Line ' + i + ' : ' + err.message;
							throw err;
						}
						ranFunc = true;
					}
				});
				
				if(!ranFunc) {
					throw new AsmError('Line ' + i + ' : Unknown instruction : ' + instrName + ' (line ' + i + ')');
				}
			}
		}
		
		if(offset >= 65536) {
			throw new AsmError('Line ' + i + ' : You went beyond $FFFF in memory !');
		}
	}
	
	/** END ASSEMBLER **/
	
	/** BEGIN COMPILER **/
	
	n = byteStream.length;
	offset = baseOffset;
	var itemList = [];
	var warnings = {duplicate: false, quantity: false, invalid: false};
	
	function processByteStreamElem(i) {
		var b = byteStream[i];
		
		switch(typeof b) {
			case 'number':
				// Leave untouched.
			break;
			
			case 'object':
				// Replace the label with its data, according to the accompanying size attribute.
				var addr = -1;
				labels.forEach(function(label) {
					if(label.name == b.name) {
						addr = label.offset;
					}
				});
				if(addr == -1) {
					if(b.label) {
						console.table(labels);
						throw new AsmError('Line ' + b.line + ' : Label ' + b.name + ' is unknown !');
					} else {
						throw new AsmError('Line ' + b.line + ' : Invalid operand ' + b.name + ' !');
					}
				}
				
				// 8-bit will calculate (jr) offset, 16-bit will calculate the address.
				if(b.size == 2) {
					// 16-bit
					b = addr % 256;
					byteStream[i+1] = Math.floor(addr / 256);
				} else {
					// 8-bit
					b = addr - (offset + 2);
					if(b < -128 || b > 127) {
						throw new AsmError('Line ' + b.line + ' : jr displacement too important ! Can\'t jr from $' + offset + ' to ' + byteStream[i]);
					}
					
					// Signed to unsigned
					if(b < 0) {
						b += 256;
					}
				}
				
				byteStream[i] = b;
			break;
			
			default:
				console.table(byteStream);
				throw new AsmError('Encountered invalid byte stream value at index ' + i);
		}
	}
	
	for(i = 0; i < n; i++) {
		processByteStreamElem(i);
		var b = byteStream[i];
		
		// We now process the thing.
		if(attribs[b].used) {
			warnings.duplicate = true;
		} else {
			attribs[b].used = true;
		}
		if(!attribs[b].qty && i+1 != byteStream.length && byteStream[i+1] != 1) {
			warnings.quantity = true;
		}
		if(!attribs[b].valid) {
			warnings.invalid = true;
		}
		var line = items[b];
		if(!attribs[b].valid) {
			line += ' (hex:' + decToHex(b).toUpperCase() + ')';
		}
		
		line += '</div><div class="col-sm-5">';
		offset++;
		i++;
		
		if(i == byteStream.length) {
			line += 'x[Any qty]';
		} else {
			processByteStreamElem(i);
			line += 'x' + byteStream[i] + ' (hex:' + decToHex(byteStream[i]).toUpperCase() + ')';
		}
		
		itemList.push(line);
		
		offset++;
	}
	
	/** END COMPILER **/
	
	var output = itemList.join('</div><div class="col-sm-7">');
	$('#output').html('<div class="col-sm-7">' + (output == '' ? 'Please type in something on the left.' : output) + '</div>');
}


// Is ran once the DOM has loaded
$(function() {
	// Set the code area to be editable
	$('#code').attr('contentEditable', 'true'); // .html('&nbsp;');
	
	$('#dismissError').click(function() {
		$('#errorPanel, #lineNumbers').addClass('hidden').attr('aria-hidden', 'true');
	});
	
	$('#code').focus(function() {
		$('#lineNumbers').addClass('hidden').attr('aria-hidden', 'true');
	});
	
	$('.form-inline').on('submit', function(evt) {
		$('#app').attr('aria-busy', 'true');
		
		try {
			compile(evt);
		} catch(err) {
			if(err.name == 'AsmError') { // Compilation error, nothing too bad
				$('#errorTitle').html('Error !');
				$('#errorText').html(err.message);
			} else { // Bad internal error
				$('#errorTitle').html('Internal ' + err.name + ' !');
				$('#errorText').html(err.message + ' (line ' + err.lineNumber + ')'
										+ '<br />Stack trace :<br/>' + err.stack.split('\n').join('<br />')
										+ '<br /><br />Please copy this plus the code you\'re trying to compile and report to the developer. Thanksies !');
			}
			$('#errorPanel').removeClass('hidden').attr('aria-hidden', 'false');
			throw err;
		} finally {
			$('#app').attr('aria-busy', 'false');
		}
	});
	
	// Otherwise the <p> is a bit small and tedious to get focus on.
	$('.panel-body').click(function() {
		document.getElementById('code').focus();
	});
});
