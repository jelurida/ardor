/*
    jQuery Masked Input Plugin
    Copyright (c) 2007 - 2015 Josh Bush (digitalbush.com)
    Licensed under the MIT license (http://digitalbush.com/projects/masked-input-plugin/#license)
    Version: 1.4.1
*/
!function(factory) {
    "function" == typeof define && define.amd ? define([ "jquery" ], factory) : factory("object" == typeof exports ? require("jquery") : jQuery);
}(function($) {
    var caretTimeoutId, ua = navigator.userAgent, iPhone = /iphone/i.test(ua), android = /android/i.test(ua);
    //console.log("User agent:" + ua + " " + android);
    $.mask = {
        definitions: {
            "9": "[0-9]",
            a: "[A-Za-z]",
            "*": "[A-Za-z0-9]"
        },
        autoclear: 0,
        dataName: "rawMaskFn",
        placeholder: "_"
    }, $.fn.extend({
        caret: function(begin, end) {
            var range;
            if (0 !== this.length && !this.is(":hidden")) return "number" == typeof begin ? (end = "number" == typeof end ? end : begin, 
            this.each(function() {
                this.setSelectionRange ? this.setSelectionRange(begin, end) : this.createTextRange && (range = this.createTextRange(), 
                range.collapse(!0), range.moveEnd("character", end), range.moveStart("character", begin), 
                range.select());
            })) : (this[0].setSelectionRange ? (begin = this[0].selectionStart, end = this[0].selectionEnd) : document.selection && document.selection.createRange && (range = document.selection.createRange(), 
            begin = 0 - range.duplicate().moveStart("character", -1e5), end = begin + range.text.length), 
            {
                begin: begin,
                end: end
            });
        },
        unmask: function() {
            return this.trigger("unmask");
        },
        mask: function(mask, settings) {
            var input, defs, tests, partialPosition, firstNonMaskPos, lastRequiredNonMaskPos, len, oldVal;
            function initMask(newMask) {
                mask = newMask;
                tests = [];
                partialPosition = len = newMask.length;
                firstNonMaskPos = null;
                $.each(newMask.split(""), function(i, c) {
                    "?" == c ? (len--, partialPosition = i) : defs[c] ? (tests.push(new RegExp(defs[c])), 
                    null === firstNonMaskPos && (firstNonMaskPos = tests.length - 1), partialPosition > i && (lastRequiredNonMaskPos = tests.length - 1)) : tests.push(null);
                });
            }
            if (!mask && this.length > 0) {
                input = $(this[0]);
                var fn = input.data($.mask.dataName);
                return fn ? fn() : void 0;
            }
            return settings = $.extend({
                autoclear: $.mask.autoclear,
                placeholder: $.mask.placeholder,
                completed: null
            }, settings), defs = $.mask.definitions,
                initMask(mask), this.trigger("unmask").each(function() {
                function tryFireCompleted() {
                    if (settings.completed) {
                        for (var i = firstNonMaskPos; lastRequiredNonMaskPos >= i; i++) if (tests[i] && buffer[i] === getPlaceholder(i)) return;
                        settings.completed.call(input);
                    }
                }
                function getPlaceholder(i) {
                    return settings.placeholder.charAt(i < settings.placeholder.length ? i : 0);
                }
                function seekNext(pos) {
                    for (;++pos < len && !tests[pos]; ) ;
                    return pos;
                }
                function seekPrev(pos) {
                    for (;--pos >= 0 && !tests[pos]; ) ;
                    return pos;
                }
                function shiftL(begin, end) {
                    var i, j;
                    if (!(0 > begin)) {
                        for (i = begin, j = seekNext(end); len > i; i++) if (tests[i]) {
                            if (!(len > j && tests[i].test(buffer[j]))) break;
                            buffer[i] = buffer[j], buffer[j] = getPlaceholder(j), j = seekNext(j);
                        }
                        writeBuffer(), input.caret(Math.max(firstNonMaskPos, begin));
                    }
                }
                function shiftR(pos) {
                    var i, c, j, t;
                    for (i = pos, c = getPlaceholder(pos); len > i; i++) if (tests[i]) {
                        if (j = seekNext(i), t = buffer[i], buffer[i] = c, !(len > j && tests[j].test(t))) break;
                        c = t;
                    }
                }
                function androidInputEvent() {
                    var curVal = input.val(), pos = input.caret();
                    //console.log("androidInputEvent " + pos.begin + "-" + pos.end + " " + curVal + " " + oldVal);

                    if (settings.unmask !== false) {
                        if (oldVal && oldVal == NRS.getAccountMask("_")
                                && (curVal.length == 0
                                    || (oldVal.length > curVal.length && pos.begin == NRS.getAccountMask().length - 1))) {
                            //Deleted the whole string, or a backspaces was pressed after the prefix
                            input.val("");
                            $(this).trigger("unmask");
                            return;
                        }
                    }

                    //A dirty fix for the weird Android 6 keyboard which deletes the text from the current pos to the
                    //input start at every char, and then inserts it again
                    if (pos.begin == 0 && pos.end == 0 && oldVal && oldVal.endsWith(curVal)) return;
                    
                    if (oldVal && oldVal.length && oldVal.length > curVal.length) {
                        checkVal(!0);
                        for (; pos.end > 0 && !tests[pos.end - 1]; ) pos.end--;
                        if (0 === pos.end) for (;pos.end < firstNonMaskPos && !tests[pos.end]; ) pos.end++;
                        androidSetCaret(input, pos.end);
                    } else {
                        var curValUpper = curVal.toUpperCase();
                        var addressStart = curValUpper.indexOf(NRS.getAccountMask(), NRS.getAccountMask().length);
                        if (addressStart > 0) {
                            var insertedAddress = curValUpper.substr(addressStart, NRS.getAccountMask().length + 20);
                            if (NRS.isRsAccount(insertedAddress)) {
                                //since pasting into a masked field will first trigger androidInputEvent, search for inserted address and use it
                                input.val(insertedAddress);
                            }
                        }
                        checkVal(!0);
                        var caretAdjusted = false;
                        var newVal = input.val();
                        //console.log("checkVal " + curValUpper + " " + newVal);
                        if (curValUpper.length == newVal.length + 1) {
                            for (var i = 0; i < newVal.length; i++) {
                                if (tests[i] && newVal.charAt(i) == getPlaceholder(i)) {
                                    if (i > 0 && curValUpper.charAt(i-1) == getPlaceholder(i)) {
                                        //checkVal moved the inserted character to position i-1 (which was empty before). Adjust the caret
                                        androidSetCaret(input, i);
                                        caretAdjusted = true;
                                    }
                                    if (i > 1 && curValUpper.charAt(i-1) == newVal.charAt(i-2) &&
                                            curValUpper.charAt(i-2) == newVal.charAt(i-1) && !tests[i-2]) {
                                         //Entered a letter before an empty position. Move the caret after the new letter
                                         androidSetCaret(input, i);
                                         caretAdjusted = true;
                                    }
                                    break;
                                }
                            }
                        }
                        if (!caretAdjusted) {
                            for (; pos.end < len && !tests[pos.end]; ) pos.end++;
                            androidSetCaret(input, pos.end);
                        }
                    }
                    tryFireCompleted();
                }
                function androidSetCaret(input, pos) {
                    var proxy = function() {
                        //console.log("androidSetCaret " + pos);
                        $.proxy($.fn.caret, input, pos)();
                    };
                    setTimeout(proxy, 0);
                }
                function blurEvent() {
                    checkVal(), input.val() != focusText && input.change();
                }
                function keydownEvent(e) {
                    //console.log("keydownEvent " + e.keyCode + " " + e.which);
                    //ignore tab
                    if (e.keyCode == 9) {
                        return true;
                    }
                    if (e.keyCode == 8) {
                        var currentInput = input.val();
                        var pos = input.caret();

                        if (settings.unmask !== false) {
                            //backspace, remove
                            if ((pos.begin == 0 && pos.end == NRS.getAccountMask().length + 20) || (currentInput == NRS.getAccountMask("_") && pos.begin == NRS.getAccountMask().length)) {
                                input.val("");
                                $(this).trigger("unmask");
                                return;
                            }
                        }
                    }

                    if (!input.prop("readonly")) {
                        var pos, begin, end, k = e.which || e.keyCode;
                        8 === k || 46 === k || iPhone && 127 === k ? (pos = input.caret(), 
                        begin = pos.begin, end = pos.end, end - begin === 0 && (begin = 46 !== k ? seekPrev(begin) : end = seekNext(begin - 1), 
                        end = 46 === k ? seekNext(end) : end), clearBuffer(begin, end), shiftL(begin, end - 1), 
                        e.preventDefault()) : 13 === k ? blurEvent.call(this, e) : 27 === k && (input.val(focusText),
                        input.caret(0, checkVal()), e.preventDefault());
                    }
                }
                function keypressEvent(e) {
                    //console.log("keypressEvent " + e.keyCode + " " + e.which);
                    //ignore tab
                    if (e.keyCode == 9) {
                        return true;
                    }
                    var p, c, next, k = e.which,
                        pos = input.caret();
                    if (0 == k) {
                        if (pos.begin >= len) return input.val(input.val().substr(0, len)), e.preventDefault(), !1;
                        pos.begin == pos.end && (k = input.val().charCodeAt(pos.begin - 1), pos.begin--,
                            pos.end--);
                    }

                    if (!input.prop("readonly")) {
                        var p, c, next, k = e.which || e.keyCode, pos = input.caret();
                        if (!(e.ctrlKey || e.altKey || e.metaKey || 32 > k) && k && 13 !== k) {
                            if (pos.end - pos.begin !== 0 && (clearBuffer(pos.begin, pos.end), shiftL(pos.begin, pos.end - 1)), 
                            p = seekNext(pos.begin - 1), len > p && (c = String.fromCharCode(k).toUpperCase(), tests[p].test(c))) {
                                if (shiftR(p), buffer[p] = c, writeBuffer(), next = seekNext(p), android) {
                                    androidSetCaret(input, next);
                                } else input.caret(next);
                                pos.begin <= lastRequiredNonMaskPos && tryFireCompleted();
                            }
                            e.preventDefault();
                        }
                    }
                }
                function clearBuffer(start, end) {
                    var i;
                    for (i = start; end > i && len > i; i++) tests[i] && (buffer[i] = getPlaceholder(i));
                }
                function writeBuffer() {
                    var value = buffer.join("");
                    input.val(value);
                    oldVal = value;
                }
                function checkVal(allow) {
                    var i, c, pos, test = input.val(), lastMatch = -1;
                    for (i = 0, pos = 0; len > i; i++) if (tests[i]) {
                        for (buffer[i] = getPlaceholder(i); pos++ < test.length; ) if (c = test.charAt(pos - 1).toUpperCase(), 
                        tests[i].test(c)) {
                            buffer[i] = c, lastMatch = i;
                            break;
                        }
                        if (pos > test.length) {
                            clearBuffer(i + 1, len);
                            break;
                        }
                    } else buffer[i] === test.charAt(pos) && pos++, partialPosition > i && (lastMatch = i);
                    return allow ? writeBuffer() : partialPosition > lastMatch + 1 ? settings.autoclear || buffer.join("") === defaultBuffer ? (input.val() && input.val(""), 
                    clearBuffer(0, len)) : writeBuffer() : (writeBuffer(), input.val(input.val().substring(0, lastMatch + 1))), 
                    partialPosition ? i : firstNonMaskPos;
                }

                function initBuffer() {
                    buffer = $.map(mask.split(""), function(c, i) {
                        return "?" != c ? defs[c] ? getPlaceholder(i) : c : void 0;
                    });
                    defaultBuffer = buffer.join("");
                }

                function adjustMaskPrefix(newAddress) {
                    let newPrefix = newAddress.split("-")[0];
                    let maskPrefixLength = mask.indexOf("-");
                    let newMask = newPrefix + mask.substr(maskPrefixLength);
                    initMask(newMask);
                    initBuffer();
                }

                var input = $(this), buffer, defaultBuffer, focusText = input.val();
                initBuffer();
                input.bind("keyup.remask", function(e) {
                    if (input.val().toUpperCase() == NRS.getAccountMask()) {
                        input.val("").mask(NRS.getAccountMask("*"))./*unbind(".remask").*/trigger("focus");
                    }
                }).bind("paste.remask", function(e) {
                    let adjustedInput = null;
                    if (e.originalEvent && e.originalEvent.clipboardData) {
                        let pastedText = e.originalEvent.clipboardData.getData("text");
                        if (NRS.isRsAccount(pastedText)) {
                            adjustedInput = pastedText;
                        } else {
                            let prePasteValue = input.val();
                            let prefixLength = prePasteValue.indexOf("-") + 1;
                            let caret = input.caret();
                            //move the caret after the prefix
                            caret.begin = Math.max(caret.begin, prefixLength);
                            caret.end = Math.max(caret.end, prefixLength);
                            adjustedInput = prePasteValue.slice(0, caret.begin) + pastedText + prePasteValue.slice(caret.end);
                        }
                    }
                    setTimeout(function() {
                        let newInput;
                        if (adjustedInput !== null) {
                            newInput = adjustedInput;
                        } else {
                            newInput = input.val();
                        }
                        newInput = NRS.nxtToAccountPrefix(newInput);
                        input.val(newInput);
                        var myRegexStr = NRS.constants.ACCOUNT_REGEX_STR.substring(1);
                        var newAddress = String(newInput.match(new RegExp(myRegexStr, "i"))).split(",")[0];
                        newAddress = NRS.nxtToAccountPrefix(newAddress);
                        if (NRS.isRsAccount(newAddress)) {
                            input.val(newAddress);
                            adjustMaskPrefix(newAddress);
                            checkVal(true);
                        } else if (NRS.isRsAccount(newInput) || NRS.getRsAccountRegex(true).test(newInput)) {
                            input.mask(NRS.getAccountMask("*")).trigger("checkRecipient").unbind(".remask");
                        }
                    }, 0);
                });

                input.data($.mask.dataName, function() {
                    return $.map(buffer, function(c, i) {
                        return tests[i] && c != getPlaceholder(i) ? c : null;
                    }).join("");
                }), input.one("unmask", function() {
                    input.off(".mask").removeData($.mask.dataName);
                }).on("focus.mask", function() {
                    if (!input.prop("readonly")) {
                        clearTimeout(caretTimeoutId);
                        focusText = input.val();
                        var pos = checkVal();
                        caretTimeoutId = setTimeout(function() {
                            input.get(0) === document.activeElement && (writeBuffer(), pos == mask.replace("?", "").length ? input.caret(0, pos) : input.caret(pos));
                        }, 10);
                    }
                }).on("blur.mask", blurEvent).on("keydown.mask", keydownEvent).on("keypress.mask", keypressEvent).on("input.mask paste.mask", function() {
                    input.prop("readonly") || setTimeout(function() {
                        var pos = checkVal(!0);
                        input.caret(pos), tryFireCompleted();
                    }, 0);
                }), android && input.off("input.mask").off("paste.mask").on("input.mask", androidInputEvent),
                checkVal();
            });
        }
    });
});
