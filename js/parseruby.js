


var RubyParser = Editor.Parser = (function() {
    function wordRegexp(words) {
        return new RegExp("^(?:" + words.join("|") + ")$");
    }
    var NORMALCONTEXT = 'rb-normal';
    var ERRORCLASS = 'rb-error';
    var COMMENTCLASS = 'rb-comment';
    var SYMBOLCLASS = 'rb-symbol';
    var CONSTCLASS = 'rb-constant';
    var OPCLASS = 'rb-operator';
    var INSTANCEMETHODCALLCLASS = 'rb-method'
    var VARIABLECLASS = 'rb-variable';
    var STRINGCLASS = 'rb-string';
    var FIXNUMSTYLE =  'rb-fixnum rb-numeric';
    var METHODCALLCLASS = 'rb-method-call';
    var HEREDOCCLASS = 'rb-heredoc';
    var WRONGCLASS = 'rb-parse-error';
    var BLOCKCOMMENT = 'rb-block-comment';
    
    var identifierStarters = /[_A-Za-z]/;    
    var stringStarters = /['"]/;
    var numberStarters = /[0-9]/;
    var keywords = wordRegexp(['begin', 'class', 'ensure', 'nil', 'self', 'when', 'end', 'def', 'false', 'not', 'super', 'while', 'alias', 'defined', 'for', 'or', 'then', 'yield', 'and', 'do', 'if', 'redo', 'true', 'begin', 'else', 'in', 'rescue', 'undef', 'break', 'elsif', 'module', 'retry', 'unless', 'case', 'end', 'next', 'return', 'until']);
    var py, keywords, types, stringStarters, stringTypes, config;



    function configure(conf) { config = conf; }
    
    var wasDef = false;
    
    
    
    var tokenizeRuby = (function() {

        function inSpecialEndedString(style, endchar) {
          return function(source, setState) {
              var stringDelim, threeStr, temp, type, word, possible = {};
              while (!source.endOfLine()) {
                  var ch = source.next();
                  // Skip escaped characters
                  if (ch == '\\') {
                    ch = source.next();
                    ch = source.next();
                  }
                  if (ch == endchar) {
                   setState(normal);
                   break;
                  }
                }
                return style;
            }          
        }
        
        function inSingleQuotedString(style) {
          return function(source, setState) {
              var stringDelim, threeStr, temp, type, word, possible = {};
              while (!source.endOfLine()) {
                  var ch = source.next();
                  // Skip escaped characters
                  if (ch == '\\') {
                    ch = source.next();
                    ch = source.next();
                  }
                  if (ch == '\'') {
                   setState(normal);
                   break;
                  }
                }
                return style;
            }          
        }
        
        function inHereDoc(style, keyword) {
          return function(source, setState) {
              var st = '';
              while (!source.endOfLine()) {
                var ch = source.next();
                if (ch == keyword[keyword.length-1]) {
                  st += source.get();
                  if (st.substr(st.length - keyword.length, keyword.length) == keyword) {
                    setState(normal);
                    return {content:st, style:style};
                  }
                }
              }
              return style;
            }          
        }
        
        
        function inDoubleQuotedString(style) {
          return function(source, setState) {
              var stringDelim, threeStr, temp, type, word, possible = {};
              while (!source.endOfLine()) {
                  var ch = source.next();
                  // Skip escaped characters
                  if (ch == '\\') {
                    ch = source.next();
                    ch = source.next();
                  }
                  if (ch == '\"') {
                   setState(normal);
                   break;
                  }
                }
                return style;
            }          
        }        
        
        function normal(source, setState) {
            var stringDelim, threeStr, temp, type, word, possible = {};
            var ch = source.next();
            
            // Handle comments
            if (ch == '#') {
                while (!source.endOfLine()) {
                    source.next();
                }
                return COMMENTCLASS;
            }


            if (ch == '@') {
                type = 'rb-instance-var';
                if (source.peek() == '@') {
                  source.next()
                  type = 'rb-class-var';
                }
                source.nextWhile(matcher(/[\w\d]/));
                word = source.get();
                return {content:word, style:type};
            }
            
            
            if (numberStarters.test(ch)) {
                source.nextWhile(matcher(/[0-9]/));
                word = source.get();
                return {content:word, style:FIXNUMSTYLE};
            }
            

            if (ch == '%') {
                type = STRINGCLASS;
                var peek = source.peek();
                if (peek == 'w' || peek == 'W') {
                  setState(inSpecialEndedString(STRINGCLASS, '}'));
                  return null;
                }
                if (peek == 'q' || peek == 'Q') {
                  source.next();
                  var ending = source.next();
                  if (ending == '(') ending = ')';
                  if (ending == '{') ending = '}';                  
                  setState(inSpecialEndedString(STRINGCLASS, ending));
                  return {content:source.get(), style:STRINGCLASS}; 
                }
                setState(inSpecialEndedString(STRINGCLASS, source.peek()));
                source.next();
                return {content:source.get(), style:STRINGCLASS}; 
            }

            if (ch == '\'') {
                setState(inSingleQuotedString(STRINGCLASS));
                return null;
            }            
            
            if (ch == '\"') {
                setState(inDoubleQuotedString(STRINGCLASS));
                return null;
            }

            if (ch == '\"') {
                setState(inDoubleQuotedString(STRINGCLASS));
                return null;
            }
          

            if (ch == '.') {
              source.nextWhile(matcher(/[\w\d]/));
              word = source.get();
              return {content:word, style:METHODCALLCLASS};
            }
            
            if (ch == '<') {
              if (source.peek() == '<') {
                source.next();
                if (identifierStarters.test(source.peek())) {
                  source.nextWhile(matcher(/[\w\d]/));
                  var keyword = source.get();
                  setState(inHereDoc(HEREDOCCLASS, keyword.substr(2, keyword.length-2)));
                  return {content:keyword, style:HEREDOCCLASS};
                }
              }
            }

                
            if (identifierStarters.test(ch)) {
                source.nextWhile(matcher(/[A-Za-z?!]/));
                word = source.get();
                //type = 'rb-identifier';
                type = INSTANCEMETHODCALLCLASS;
                
                if (keywords.test(word)) {
                  type = 'rb-keyword';
                }
                if (wasDef) {
                  type = 'rb-method rb-methodname';
                }                

                wasDef = (word == 'def');

                if (ch.toUpperCase() == ch) {
                    type = CONSTCLASS;
                    while (source.peek() == ':') {
                        source.next();
                        if (source.peek() == ':') {
                            source.next();
                            source.nextWhile(matcher(/[\w\d]/));
                        }
                    }
                    word += source.get();
                }
                
                if (false && type == INSTANCEMETHODCALLCLASS) {
                  console.log(word);
                  var char = null;
                  pushback = '';
                  while(!source.endOfLine()) {
                    char = source.next();
                    pushback += char;
                    
                    if (char == ',') { 
                      // get another variable
                    }
                    if (char == '=') { 
                      type = VARIABLECLASS;
                      break;
                    }
                  }
                  console.log('pushback "'+pushback+'"');
                  source.push(pushback);
                }
                
                //console.log(word+' is a '+type);
                return {content:word, style:type};
            }
            /**/
            return NORMALCONTEXT;
        }

        

        return function(source, startState) {
            return tokenizer(source, startState || normal);
        };
    })();

    function parseRuby(source) {

        var tokens = tokenizeRuby(source);
        var lastToken = null;
        var column = 0;
        var context = {prev: null,
                       endOfScope: false,
                       startNewScope: false,
                       level: 0,
                       next: null,
                       type: NORMALCONTEXT
                       };

        function pushContext(level, type) {
            type = type ? type : NORMALCONTEXT;
            context = {prev: context,
                       endOfScope: false,
                       startNewScope: false,
                       level: level,
                       next: null,
                       type: type
                       };
        }

        function popContext(remove) {
            remove = remove ? remove : false;
            if (context.prev) {
                if (remove) {
                    context = context.prev;
                    context.next = null;
                } else {
                    context.prev.next = context;
                    context = context.prev;
                }
            }
        }

        var iter = {
            next: function() {
                var token = tokens.next();
                var type = token.style;
                var content = token.content;
                //console.log(token);

                lastToken = token;
                return token;
            },

            copy: function() {
                var _context = context, _tokenState = tokens.state;
                return function(source) {
                    tokens = tokenizeRuby(source, _tokenState);
                    context = _context;
                    return iter;
                };
            }
        };
        return iter;
    }

    return {make: parseRuby,
            electricChars: "",
            configure: configure};
})();
