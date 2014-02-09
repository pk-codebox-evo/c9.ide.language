/**
 * Cloud9 Language Foundation
 *
 * @copyright 2011, Ajax.org B.V.
 * @license GPLv3 <http://www.gnu.org/licenses/gpl.txt>
 */
define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "tabManager", "ace", "language",
        "language.complete", "language.tooltip"
    ];
    main.provides = ["language.keyhandler"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var aceHandle = imports.ace;
        var language = imports.language;
        var complete = imports["language.complete"];
        var tooltip = imports["language.tooltip"];
        var complete_util = require("./complete_util");
        var TokenIterator = require("ace/token_iterator").TokenIterator;
        var DEFAULT_ID_REGEX = complete_util.DEFAULT_ID_REGEX;
        var ace;
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        //var emit   = plugin.getEmitter();
        
        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;
            
            aceHandle.on("create", function(e) {
                e.editor.on("createAce", addBinding);
                
                addBinding(e.editor.ace);
                
                function addBinding(ace) {
                    var kb = ace.keyBinding;
                    var defaultCommandHandler   = kb.onCommandKey.bind(kb);
                    kb.onCommandKey = composeHandlers(onCommandKey, defaultCommandHandler, ace);
                    ace.commands.on("afterExec", onAfterExec);
                }
            });
            complete.on("replaceText", function(e) {
                onTextInput(e.newText, false);
            })
        }
        
        /***** Methods *****/
        
        function onAfterExec(e) {
            if (e.command.name === "insertstring") {
                ace = e.editor;
                onTextInput(e.args);
            } else if (e.command.name === "backspace") {
                ace = e.editor;
                if (language.isContinuousCompletionEnabled())
                    onBackspace(e);
            }
        }
        
        function composeHandlers(mainHandler, fallbackHandler, myAce) {
            return function onKeyPress() {
                ace = myAce;
                
                var result = mainHandler.apply(null, arguments);
                if (!result)
                    fallbackHandler.apply(null, arguments);
            };
        }
        
        function onTextInput(text, pasted) {
            inputTriggerTooltip(text, pasted);
            if (complete.isPopupVisible())
                return false;
            if (language.isContinuousCompletionEnabled())
                typeAlongCompleteTextInput(text, pasted);
            else
                inputTriggerComplete(text, pasted);
            return false;
        }
        
        function onCommandKey(e) {
            if (e.keyCode == 27) // Esc
                tooltip.hide();
        }
        
        function onBackspace(e) {
            if (complete.isPopupVisible())
                return false;
            var pos = ace.getCursorPosition();
            var line = ace.session.doc.getLine(pos.row);
            if (!complete_util.precededByIdentifier(line, pos.column, null, ace) && !inTextToken(pos))
                return false;
            if (inCommentToken(pos))
                return false;
            if (complete.getContinousCompletionRegex(null, ace))
                complete.deferredInvoke(false, ace);
        }
        
        function inputTriggerComplete(text, pasted) {
            var completionRegex = complete.getContinousCompletionRegex(null, ace);
            var idRegex = complete.getIdentifierRegex(null, ace);
            if (!pasted && completionRegex && text.match(completionRegex))
                handleChar(text, idRegex, completionRegex); 
        }
        
        function inputTriggerTooltip(text, pasted) {
            var tooltipRegex = tooltip.getTooltipRegex(null, ace);
            if (!pasted && text.match(tooltipRegex))
                language.onCursorChange(null, null, true);
        }
        
        function typeAlongCompleteTextInput(text, pasted) {
            var completionRegex = complete.getContinousCompletionRegex(null, ace);
            var idRegex = complete.getIdentifierRegex(null, ace);
            if (pasted)
                return false;
            handleChar(text, idRegex, completionRegex); 
        }
        
        function isJavaScript() {
            return ace.getSession().syntax === "javascript";
        }
        
        function inTextToken(pos) {
            var token = ace.getSession().getTokenAt(pos.row, pos.column - 1);
            return token && token.type && token.type === "text";
        }
        
        function inCommentToken(pos) {
            var token = ace.getSession().getTokenAt(pos.row, pos.column - 1);
            return token && token.type && token.type.match(/^comment/);
        } 
        
        function handleChar(ch, idRegex, completionRegex) {
            if (ch.match(idRegex || DEFAULT_ID_REGEX) || (completionRegex && ch.match(completionRegex))) { 
                var pos = ace.getCursorPosition();
                var line = ace.getSession().getDocument().getLine(pos.row);
                if (!complete_util.precededByIdentifier(line, pos.column, ch, ace) && !inTextToken(pos))
                    return false;
                if (inCommentToken(pos))
                    return false;
                complete.deferredInvoke(ch === ".", ace);
            }
            else if (ch === '"' || ch === "'") {
                var pos = ace.getCursorPosition();
                var line = ace.getSession().getDocument().getLine(pos.row);
                if (complete_util.isRequireJSCall(line, pos.column, "", ace, true))
                    complete.deferredInvoke(true, ace);
            }
        }
        
        /***** Lifecycle *****/
        
        plugin.on("load", function() {
            load();
        });
        plugin.on("enable", function() {
            
        });
        plugin.on("disable", function() {
            
        });
        plugin.on("unload", function() {
            loaded = false;
        });
        
        /***** Register and define API *****/
        
        /**
         */
        plugin.freezePublicAPI({
            /**
             * 
             */
            composeHandlers : composeHandlers
        });
        
        register(null, {
            "language.keyhandler": plugin
        });
    }
});
