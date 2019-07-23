

var win;
if (typeof(window) === 'undefined') {
    var loc = {
        hostname: ''
    };
    win = {
        navigator: { userAgent: '' },
        document: {
            location: loc,
            referrer: ''
        },
        screen: { width: 0, height: 0 },
        location: loc
    };
} else {
    win = window;
}

var ArrayProto = Array.prototype,
    FuncProto = Function.prototype,
    ObjProto = Object.prototype,
    slice = ArrayProto.slice,
    toString = ObjProto.toString,
    hasOwnProperty = ObjProto.hasOwnProperty,
    windowConsole = win.console,
    navigator = win.navigator,
    document = win.document,
    windowOpera = win.opera,
    screen = win.screen,
    userAgent = navigator.userAgent;

var nativeBind = FuncProto.bind,
    nativeForEach = ArrayProto.forEach,
    nativeIndexOf = ArrayProto.indexOf,
    nativeIsArray = Array.isArray,
    breaker = {};

/*  undercore function   */

var _ = {
    trim: function(str) {
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/Trim#Polyfill
        return str.replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, '');
    }
};

_.bind = function(func, context) {
    var args, bound;
    if (nativeBind && func.bind === nativeBind) {
        return nativeBind.apply(func, slice.call(arguments, 1));
    }
    if (!_.isFunction(func)) {
        throw new TypeError();
    }
    args = slice.call(arguments, 2);
    bound = function() {
        if (!(this instanceof bound)) {
            return func.apply(context, args.concat(slice.call(arguments)));
        }
        var ctor = {};
        ctor.prototype = func.prototype;
        var self = new ctor();
        ctor.prototype = null;
        var result = func.apply(self, args.concat(slice.call(arguments)));
        if (Object(result) === result) {
            return result;
        }
        return self;
    };
    return bound;
};

_.includes = function(str, needle) {
    return str.indexOf(needle) !== -1;
};

_.isUndefined = function(obj) {
    return obj === void 0;
};

_.register_event = (function() {
    // written by Dean Edwards, 2005
    // with input from Tino Zijdel - crisp@xs4all.nl
    // with input from Carl Sverre - mail@carlsverre.com
    // with input from Mixpanel
    // http://dean.edwards.name/weblog/2005/10/add-event/
    // https://gist.github.com/1930440

    /**
     * @param {Object} element
     * @param {string} type
     * @param {function(...*)} handler
     * @param {boolean=} oldSchool
     * @param {boolean=} useCapture
     */
    var register_event = function(element, type, handler, oldSchool, useCapture) {
        if (!element) {
            console.error('No valid element provided to register_event');
            return;
        }

        if (element.addEventListener && !oldSchool) {
            element.addEventListener(type, handler, !!useCapture);
        } else {
            var ontype = 'on' + type;
            var old_handler = element[ontype]; // can be undefined
            element[ontype] = makeHandler(element, handler, old_handler);
        }
    };

    function makeHandler(element, new_handler, old_handlers) {
        var handler = function(event) {
            event = event || fixEvent(window.event);

            // this basically happens in firefox whenever another script
            // overwrites the onload callback and doesn't pass the event
            // object to previously defined callbacks.  All the browsers
            // that don't define window.event implement addEventListener
            // so the dom_loaded handler will still be fired as usual.
            if (!event) {
                return undefined;
            }

            var ret = true;
            var old_result, new_result;

            if (_.isFunction(old_handlers)) {
                old_result = old_handlers(event);
            }
            new_result = new_handler.call(element, event);

            if ((false === old_result) || (false === new_result)) {
                ret = false;
            }

            return ret;
        };

        return handler;
    }

    function fixEvent(event) {
        if (event) {
            event.preventDefault = fixEvent.preventDefault;
            event.stopPropagation = fixEvent.stopPropagation;
        }
        return event;
    }
    fixEvent.preventDefault = function() {
        this.returnValue = false;
    };
    fixEvent.stopPropagation = function() {
        this.cancelBubble = true;
    };

    return register_event;
})();

_.each = function(obj, iterator, context) {
    if (obj === null || obj === undefined) {
        return;
    }
    if (nativeForEach && obj.forEach === nativeForEach) {
        obj.forEach(iterator, context);
    } else if (obj.length === +obj.length) {
        for (var i = 0, l = obj.length; i < l; i++) {
            if (i in obj && iterator.call(context, obj[i], i, obj) === breaker) {
                return;
            }
        }
    } else {
        for (var key in obj) {
            if (hasOwnProperty.call(obj, key)) {
                if (iterator.call(context, obj[key], key, obj) === breaker) {
                    return;
                }
            }
        }
    }
};

_.extend = function(obj) {
    _.each(slice.call(arguments, 1), function(source) {
        for (var prop in source) {
            if (source[prop] !== void 0) {
                obj[prop] = source[prop];
            }
        }
    });
    return obj;
};


/*   end   */


/*  autocheck utils function   */

var getClassName = function (el) {
    switch(typeof el.className) {
        case 'string':
            return el.className;
        case 'object': // handle cases where className might be SVGAnimatedString or some other type
            return el.className.baseVal || el.getAttribute('class') || '';
        default: // future proof
            return '';
    }
};

var getSafeText = function (el) {
    var elText = '';

    if (shouldTrackElement(el) && el.childNodes && el.childNodes.length) {
        _.each(el.childNodes, function(child) {
            if (isTextNode(child) && child.textContent) {
                elText += _.trim(child.textContent)
                // scrub potentially sensitive values
                    .split(/(\s+)/).filter(shouldTrackValue).join('')
                    // normalize whitespace
                    .replace(/[\r\n]/g, ' ').replace(/[ ]+/g, ' ')
                    // truncate
                    .substring(0, 255);
            }
        });
    }

    return _.trim(elText);
};

var isElementNode = function (el) {
    return el && el.nodeType === 1;
};

var isTag = function (el, tag) {
    return el && el.tagName && el.tagName.toLowerCase() === tag.toLowerCase();
};

var isTextNode = function (el) {
    return el && el.nodeType === 3;
};

var shouldTrackDomEvent = function (el, event) {
    if (!el || isTag(el, 'html') || !isElementNode(el)) {
        return false;
    }
    var tag = el.tagName.toLowerCase();
    switch (tag) {
        case 'html':
            return false;
        case 'form':
            return event.type === 'submit';
        case 'input':
            if (['button', 'submit'].indexOf(el.getAttribute('type')) === -1) {
                return event.type === 'change';
            } else {
                return event.type === 'click';
            }
        case 'select':
        case 'textarea':
            return event.type === 'change';
        default:
            return event.type === 'click';
    }
};

var shouldTrackElement = function (el) {
    for (var curEl = el; curEl.parentNode && !isTag(curEl, 'body'); curEl = curEl.parentNode) {
        var classes = getClassName(curEl).split(' ');
        if (_.includes(classes, 'mp-sensitive') || _.includes(classes, 'mp-no-track')) {
            return false;
        }
    }

    if (_.includes(getClassName(el).split(' '), 'mp-include')) {
        return true;
    }

    // don't send data from inputs or similar elements since there will always be
    // a risk of clientside javascript placing sensitive data in attributes
    if (
        isTag(el, 'input') ||
        isTag(el, 'select') ||
        isTag(el, 'textarea') ||
        el.getAttribute('contenteditable') === 'true'
    ) {
        return false;
    }

    // don't include hidden or password fields
    var type = el.type || '';
    if (typeof type === 'string') { // it's possible for el.type to be a DOM element if el is a form with a child input[name="type"]
        switch(type.toLowerCase()) {
            case 'hidden':
                return false;
            case 'password':
                return false;
        }
    }

    // filter out data from fields that look like sensitive fields
    var name = el.name || el.id || '';
    if (typeof name === 'string') { // it's possible for el.name or el.id to be a DOM element if el is a form with a child input[name="name"]
        var sensitiveNameRegex = /^cc|cardnum|ccnum|creditcard|csc|cvc|cvv|exp|pass|pwd|routing|seccode|securitycode|securitynum|socialsec|socsec|ssn/i;
        if (sensitiveNameRegex.test(name.replace(/[^a-zA-Z0-9]/g, ''))) {
            return false;
        }
    }

    return true;
};


var shouldTrackValue = function (value) {
    if (value === null || _.isUndefined(value)) {
        return false;
    }

    if (typeof value === 'string') {
        value = _.trim(value);

        // check to see if input value looks like a credit card number
        // see: https://www.safaribooksonline.com/library/view/regular-expressions-cookbook/9781449327453/ch04s20.html
        var ccRegex = /^(?:(4[0-9]{12}(?:[0-9]{3})?)|(5[1-5][0-9]{14})|(6(?:011|5[0-9]{2})[0-9]{12})|(3[47][0-9]{13})|(3(?:0[0-5]|[68][0-9])[0-9]{11})|((?:2131|1800|35[0-9]{3})[0-9]{11}))$/;
        if (ccRegex.test((value || '').replace(/[\- ]/g, ''))) {
            return false;
        }

        // check to see if input value looks like a social security number
        var ssnRegex = /(^\d{3}-?\d{2}-?\d{4}$)/;
        if (ssnRegex.test(value)) {
            return false;
        }
    }

    return true;
};

var getXpath = function (element) {
    if (element.id !== ""){
        return '//*[@id=\"' + element.id + '\"]';
    }

    if (element == document.body) {//递归到body处，结束递归
        return '/html/' + element.tagName.toLowerCase();
    }

    var ix = 1,//在nodelist中的位置，且每次点击初始化
        siblings = element.parentNode.childNodes;//同级的子元素

    for (var i = 0, l = siblings.length; i < l; i++) {
        var sibling = siblings[i];
        //如果这个元素是siblings数组中的元素，则执行递归操作
        if (sibling == element) {
            return arguments.callee(element.parentNode) + '/' + element.tagName.toLowerCase() + '[' + (ix) + ']';
            //如果不符合，判断是否是element元素，并且是否是相同元素，如果是相同的就开始累加
        } else if (sibling.nodeType == 1 && sibling.tagName == element.tagName) {
            ix++;
        }
    }
};


var formatDatetime = function (time, format = 'YY-MM-DD hh:mm:ss') {
    var date = new Date(time);

    var year = date.getFullYear(),
        month = date.getMonth() + 1,//月份是从0开始的
        day = date.getDate(),
        hour = date.getHours(),
        min = date.getMinutes(),
        sec = date.getSeconds();

    var preArr = Array.apply(null, Array(10)).map(function (elem, index) {
        return '0' + index;
    });////开个长度为10的数组 格式为 00 01 02 03

    var newTime = format.replace(/YY/g, year)
        .replace(/MM/g, preArr[month] || month)
        .replace(/DD/g, preArr[day] || day)
        .replace(/hh/g, preArr[hour] || hour)
        .replace(/mm/g, preArr[min] || min)
        .replace(/ss/g, preArr[sec] || sec);

    return newTime;

};

var RandomTen = function (aNum) {
    try {
        var Num=10,string='';
        if( aNum!=null ){
            Num=aNum;
        }
        //通过循环获得随机10位数
        for( var i=0;i<Num;i++ ){
            string+=parseInt( Math.random(0,1)*100 ) ;
        }
        return string;
    }
    catch (e) {
        console.log(e);
    }
};

var getCookie = function (name) {
    var arr,reg = new RegExp("(^| )"+name+"=([^;]*)(;|$)");

    if(arr=document.cookie.match(reg))
        return unescape(arr[2]);
    else
        return null;
};

var setCookie = function (name, value) {
    var Days = 365;
    var exp = new Date();
    // exp.setTime(exp.getTime() + Days*60*1000);
    exp.setTime(exp.getTime() + Days*24*60*60*1000);

    var domain = window.location.host;//默认是本地存储cookie(localhost)
    var domains = domain.split('.');

    if (domains.length === 3){//用于线上cookie保存
        domains = domains.slice(1,3);
        domain = '.' + domains.join('.');
    }else{
        var domainsArr = domain.split(':');
        if(domainsArr.length==2){
            domain = domainsArr[0];
        }
    }
    document.cookie = name + "=" + escape (value) + "; expires=" + exp.toGMTString() + ";path=/;domain="+domain;
};

var judgeUser = function (ip, date) {
    try {
        var storage = getCookie( 'webtool' ),Date;
        if (storage == null){
            Date = ip+RandomTen()+":"+date;
            setCookie('webtool', unescape(Date));
        }
    }
    catch (e) {
        console.log(e);
    }
};

const _send_request = async (url, dt) => {
    try {
        console.log(dt);
        console.log(typeof dt);
        var config = {
            headers: {"content-type":"application/json"}
        };
        const response = await axios.post(url, dt, config);
        console.log('sending message....');
        console.log(response);
    }
    catch (e) {
        console.log(e);
    }
};


/*   end   */


var autocheck = {

    _getEventTarget: function(e) {
        // https://developer.mozilla.org/en-US/docs/Web/API/Event/target#Compatibility_notes
        if (typeof e.target === 'undefined') {
            return e.srcElement;
        } else {
            return e.target;
        }
    },

    _previousElementSibling: function(el) {
        if (el.previousElementSibling) {
            return el.previousElementSibling;
        } else {
            do {
                el = el.previousSibling;
            } while (el && !isElementNode(el));
            return el;
        }
    },

    _getPropertiesFromElement: function(elem) {
        var props = {
            'classes': getClassName(elem).split(' '),
            'tag_name': elem.tagName.toLowerCase()
        };

        if (shouldTrackElement(elem)) {
            _.each(elem.attributes, function(attr) {
                if (shouldTrackValue(attr.value)) {
                    props['attr__' + attr.name] = attr.value;
                }
            });
        }

        var nthChild = 1;
        var nthOfType = 1;
        var currentElem = elem;
        while (currentElem = this._previousElementSibling(currentElem)) { // eslint-disable-line no-cond-assign
            nthChild++;
            if (currentElem.tagName === elem.tagName) {
                nthOfType++;
            }
        }
        props['nth_child'] = nthChild;
        props['nth_of_type'] = nthOfType;

        return props;
    },

    _getDefaultProperties: function(eventType) {
        return {
            '$event_type': eventType,
            '$ce_version': 1,
            '$host': window.location.host,
            '$pathname': window.location.pathname
        };
    },

    _getCustomProperties: function(targetElementList) {
        var props = {};
        _.each(this._customProperties, function(customProperty) {
            _.each(customProperty['event_selectors'], function(eventSelector) {
                var eventElements = document.querySelectorAll(eventSelector);
                _.each(eventElements, function(eventElement) {
                    if (_.includes(targetElementList, eventElement) && shouldTrackElement(eventElement)) {
                        props[customProperty['name']] = this._extractCustomPropertyValue(customProperty);
                    }
                }, this);
            }, this);
        }, this);
        return props;
    },

    _trackEvent: function(e, instance) {

        /*** Don't mess with this code without running IE8 tests on it ***/
        var target = this._getEventTarget(e);
        if (isTextNode(target)) { // defeat Safari bug (see: http://www.quirksmode.org/js/events_properties.html)
            target = target.parentNode;
        }

        if (shouldTrackDomEvent(target, e)) {
            var targetElementList = [target];
            var curEl = target;
            while (curEl.parentNode && !isTag(curEl, 'body')) {
                targetElementList.push(curEl.parentNode);
                curEl = curEl.parentNode;
            }

            var elementsJson = [];
            var href, explicitNoTrack = false;
            _.each(targetElementList, function(el) {
                var shouldTrackEl = shouldTrackElement(el);

                // if the element or a parent element is an anchor tag
                // include the href as a property
                if (el.tagName.toLowerCase() === 'a') {
                    href = el.getAttribute('href');
                    href = shouldTrackEl && shouldTrackValue(href) && href;
                }

                // allow users to programatically prevent tracking of elements by adding class 'mp-no-track'
                var classes = getClassName(el).split(' ');
                if (_.includes(classes, 'mp-no-track')) {
                    explicitNoTrack = true;
                }

                elementsJson.push(this._getPropertiesFromElement(el));
            }, this);

            if (explicitNoTrack) {
                return false;
            }

            // only populate text content from target element (not parents)
            // to prevent text within a sensitive element from being collected
            // as part of a parent's el.textContent
            var elementText;
            var safeElementText = getSafeText(target);
            if (safeElementText && safeElementText.length) {
                elementText = safeElementText;
            }

            var props = _.extend(
                this._getDefaultProperties(e.type),
                {
                    '$elements':  elementsJson,
                    '$el_attr__href': href,
                    '$el_text': elementText
                },
                this._getCustomProperties(targetElementList)
            );
            var city = returnCitySN;

            // your api url
            var url = '';


            var curTime = formatDatetime(new Date().getTime());
            var curXpath = getXpath(e.target);
            var curOuterHtml = e.target.outerHTML;
            var loc = returnCitySN.cname;
            var uip = returnCitySN.cip;

            //judge user
            judgeUser(uip, curTime);

            //get cookie
            var uid = getCookie('token');
            var uidentity = getCookie('webtool')

            props['action_time'] = curTime;
            props['xpath'] = curXpath;
            props['outerhtml'] = curOuterHtml;
            props['request_header'] = window.location.href;
            props['location'] = loc;
            props['uip'] = uip;
            props['uidentity'] = uidentity;
            // props['uid'] = uid;
            if (uid == null){
                props['uid'] = 'anonymoususer';
            }else {
                props['uid'] = uid;
            }
            if (curOuterHtml.length < 200){
                _send_request(url, props);
            }else {
                console.log('invalid click event listened, will not trace!!!')
            }

            /*
            * you can edit data to which to be sent backend here
            * for example:
            * element xpath,
            * action time,
            * outerHtml/innerHtml,
            * an so on....
            */
            // instance.track('$web_event', props);
            // console.log(typeof window.document);
            // console.log(dtarray);
            // console.log(typeof dtarray);
            // console.log(e.target.outerHTML);
            // console.log('coming here');
            // console.log(props);

            return true;
        }
    },

    _addDomEventHandlers: function(instance) {
        var handler = _.bind(function(e) {
            e = e || window.event;
            this._trackEvent(e, instance);
        }, this);
        _.register_event(document, 'submit', handler, false, true);
        _.register_event(document, 'change', handler, false, true);
        _.register_event(document, 'click', handler, false, true);
    },

    _customProperties: {},
    init: function (instance) {
        if (!(document && document.body)) {
            console.log('document not ready yet, trying again in 500 milliseconds...');
            var that = this;
            setTimeout(function() { that.init(instance); }, 500);
            return;
        }

        var parseDecideResponse = _.bind(function(response) {
            // if (response && response['config'] && response['config']['enable_collect_everything'] === true) {
            //
            //     if (response['custom_properties']) {
            //         this._customProperties = response['custom_properties'];
            //     }
            //
            //     // instance.track('$web_event', _.extend({
            //     //     '$title': document.title
            //     // }, this._getDefaultProperties('pageview')));
            //
            //     this._addDomEventHandlers(instance);
            //
            // } else {
            //     instance['__autotrack_enabled'] = false;
            // }

        }, this);
        this._addDomEventHandlers(instance);

        console.log('ending in init.........')


    }
};

var MixpanelLib = function() {};
instance = new MixpanelLib();
autocheck.init(instance);
