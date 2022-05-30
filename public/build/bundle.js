
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35732/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function custom_event(type, detail, { bubbles = false, cancelable = false }) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, cancelable, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            while (flushidx < dirty_components.length) {
                const component = dirty_components[flushidx];
                flushidx++;
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.48.0' }, detail), { bubbles: true }));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* src\App.svelte generated by Svelte v3.48.0 */

    const { console: console_1 } = globals;
    const file = "src\\App.svelte";

    function create_fragment(ctx) {
    	let main;
    	let h1;
    	let t0;
    	let t1;
    	let t2;
    	let t3;
    	let div0;
    	let span0;
    	let t5;
    	let input0;
    	let t6;
    	let div1;
    	let span1;
    	let t8;
    	let input1;

    	const block = {
    		c: function create() {
    			main = element("main");
    			h1 = element("h1");
    			t0 = text("Hello ");
    			t1 = text(/*name*/ ctx[0]);
    			t2 = text("!");
    			t3 = space();
    			div0 = element("div");
    			span0 = element("span");
    			span0.textContent = "Name";
    			t5 = space();
    			input0 = element("input");
    			t6 = space();
    			div1 = element("div");
    			span1 = element("span");
    			span1.textContent = "Surname";
    			t8 = space();
    			input1 = element("input");
    			attr_dev(h1, "class", "svelte-1bc65qc");
    			add_location(h1, file, 9, 1, 90);
    			attr_dev(main, "class", "svelte-1bc65qc");
    			add_location(main, file, 8, 0, 81);
    			attr_dev(span0, "class", "input-group-text");
    			attr_dev(span0, "id", "name");
    			add_location(span0, file, 14, 1, 161);
    			attr_dev(input0, "type", "text");
    			attr_dev(input0, "class", "form-control");
    			attr_dev(input0, "placeholder", "Username");
    			attr_dev(input0, "aria-label", "Username");
    			attr_dev(input0, "aria-describedby", "basic-addon1");
    			add_location(input0, file, 15, 1, 216);
    			attr_dev(div0, "class", "input-group mb-3");
    			add_location(div0, file, 13, 0, 128);
    			attr_dev(span1, "class", "input-group-text");
    			attr_dev(span1, "id", "surname");
    			add_location(span1, file, 18, 1, 378);
    			attr_dev(input1, "type", "text");
    			attr_dev(input1, "class", "form-control");
    			attr_dev(input1, "placeholder", "Username");
    			attr_dev(input1, "aria-label", "Username");
    			attr_dev(input1, "aria-describedby", "basic-addon1");
    			add_location(input1, file, 19, 1, 439);
    			attr_dev(div1, "class", "input-group mb-3");
    			add_location(div1, file, 17, 0, 345);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, h1);
    			append_dev(h1, t0);
    			append_dev(h1, t1);
    			append_dev(h1, t2);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, div0, anchor);
    			append_dev(div0, span0);
    			append_dev(div0, t5);
    			append_dev(div0, input0);
    			insert_dev(target, t6, anchor);
    			insert_dev(target, div1, anchor);
    			append_dev(div1, span1);
    			append_dev(div1, t8);
    			append_dev(div1, input1);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*name*/ 1) set_data_dev(t1, /*name*/ ctx[0]);
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(div0);
    			if (detaching) detach_dev(t6);
    			if (detaching) detach_dev(div1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	let { name } = $$props;
    	console.log("Hallo Nolene");
    	const writable_props = ['name'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('name' in $$props) $$invalidate(0, name = $$props.name);
    	};

    	$$self.$capture_state = () => ({ name });

    	$$self.$inject_state = $$props => {
    		if ('name' in $$props) $$invalidate(0, name = $$props.name);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [name];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, { name: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*name*/ ctx[0] === undefined && !('name' in props)) {
    			console_1.warn("<App> was created without expected prop 'name'");
    		}
    	}

    	get name() {
    		throw new Error("<App>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set name(value) {
    		throw new Error("<App>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /**
     * @license
     * Copyright 2017 Google LLC
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
     * @license
     * Copyright 2017 Google LLC
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
    const stringToByteArray$1 = function (str) {
        // TODO(user): Use native implementations if/when available
        const out = [];
        let p = 0;
        for (let i = 0; i < str.length; i++) {
            let c = str.charCodeAt(i);
            if (c < 128) {
                out[p++] = c;
            }
            else if (c < 2048) {
                out[p++] = (c >> 6) | 192;
                out[p++] = (c & 63) | 128;
            }
            else if ((c & 0xfc00) === 0xd800 &&
                i + 1 < str.length &&
                (str.charCodeAt(i + 1) & 0xfc00) === 0xdc00) {
                // Surrogate Pair
                c = 0x10000 + ((c & 0x03ff) << 10) + (str.charCodeAt(++i) & 0x03ff);
                out[p++] = (c >> 18) | 240;
                out[p++] = ((c >> 12) & 63) | 128;
                out[p++] = ((c >> 6) & 63) | 128;
                out[p++] = (c & 63) | 128;
            }
            else {
                out[p++] = (c >> 12) | 224;
                out[p++] = ((c >> 6) & 63) | 128;
                out[p++] = (c & 63) | 128;
            }
        }
        return out;
    };
    /**
     * Turns an array of numbers into the string given by the concatenation of the
     * characters to which the numbers correspond.
     * @param bytes Array of numbers representing characters.
     * @return Stringification of the array.
     */
    const byteArrayToString = function (bytes) {
        // TODO(user): Use native implementations if/when available
        const out = [];
        let pos = 0, c = 0;
        while (pos < bytes.length) {
            const c1 = bytes[pos++];
            if (c1 < 128) {
                out[c++] = String.fromCharCode(c1);
            }
            else if (c1 > 191 && c1 < 224) {
                const c2 = bytes[pos++];
                out[c++] = String.fromCharCode(((c1 & 31) << 6) | (c2 & 63));
            }
            else if (c1 > 239 && c1 < 365) {
                // Surrogate Pair
                const c2 = bytes[pos++];
                const c3 = bytes[pos++];
                const c4 = bytes[pos++];
                const u = (((c1 & 7) << 18) | ((c2 & 63) << 12) | ((c3 & 63) << 6) | (c4 & 63)) -
                    0x10000;
                out[c++] = String.fromCharCode(0xd800 + (u >> 10));
                out[c++] = String.fromCharCode(0xdc00 + (u & 1023));
            }
            else {
                const c2 = bytes[pos++];
                const c3 = bytes[pos++];
                out[c++] = String.fromCharCode(((c1 & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
            }
        }
        return out.join('');
    };
    // We define it as an object literal instead of a class because a class compiled down to es5 can't
    // be treeshaked. https://github.com/rollup/rollup/issues/1691
    // Static lookup maps, lazily populated by init_()
    const base64 = {
        /**
         * Maps bytes to characters.
         */
        byteToCharMap_: null,
        /**
         * Maps characters to bytes.
         */
        charToByteMap_: null,
        /**
         * Maps bytes to websafe characters.
         * @private
         */
        byteToCharMapWebSafe_: null,
        /**
         * Maps websafe characters to bytes.
         * @private
         */
        charToByteMapWebSafe_: null,
        /**
         * Our default alphabet, shared between
         * ENCODED_VALS and ENCODED_VALS_WEBSAFE
         */
        ENCODED_VALS_BASE: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' + 'abcdefghijklmnopqrstuvwxyz' + '0123456789',
        /**
         * Our default alphabet. Value 64 (=) is special; it means "nothing."
         */
        get ENCODED_VALS() {
            return this.ENCODED_VALS_BASE + '+/=';
        },
        /**
         * Our websafe alphabet.
         */
        get ENCODED_VALS_WEBSAFE() {
            return this.ENCODED_VALS_BASE + '-_.';
        },
        /**
         * Whether this browser supports the atob and btoa functions. This extension
         * started at Mozilla but is now implemented by many browsers. We use the
         * ASSUME_* variables to avoid pulling in the full useragent detection library
         * but still allowing the standard per-browser compilations.
         *
         */
        HAS_NATIVE_SUPPORT: typeof atob === 'function',
        /**
         * Base64-encode an array of bytes.
         *
         * @param input An array of bytes (numbers with
         *     value in [0, 255]) to encode.
         * @param webSafe Boolean indicating we should use the
         *     alternative alphabet.
         * @return The base64 encoded string.
         */
        encodeByteArray(input, webSafe) {
            if (!Array.isArray(input)) {
                throw Error('encodeByteArray takes an array as a parameter');
            }
            this.init_();
            const byteToCharMap = webSafe
                ? this.byteToCharMapWebSafe_
                : this.byteToCharMap_;
            const output = [];
            for (let i = 0; i < input.length; i += 3) {
                const byte1 = input[i];
                const haveByte2 = i + 1 < input.length;
                const byte2 = haveByte2 ? input[i + 1] : 0;
                const haveByte3 = i + 2 < input.length;
                const byte3 = haveByte3 ? input[i + 2] : 0;
                const outByte1 = byte1 >> 2;
                const outByte2 = ((byte1 & 0x03) << 4) | (byte2 >> 4);
                let outByte3 = ((byte2 & 0x0f) << 2) | (byte3 >> 6);
                let outByte4 = byte3 & 0x3f;
                if (!haveByte3) {
                    outByte4 = 64;
                    if (!haveByte2) {
                        outByte3 = 64;
                    }
                }
                output.push(byteToCharMap[outByte1], byteToCharMap[outByte2], byteToCharMap[outByte3], byteToCharMap[outByte4]);
            }
            return output.join('');
        },
        /**
         * Base64-encode a string.
         *
         * @param input A string to encode.
         * @param webSafe If true, we should use the
         *     alternative alphabet.
         * @return The base64 encoded string.
         */
        encodeString(input, webSafe) {
            // Shortcut for Mozilla browsers that implement
            // a native base64 encoder in the form of "btoa/atob"
            if (this.HAS_NATIVE_SUPPORT && !webSafe) {
                return btoa(input);
            }
            return this.encodeByteArray(stringToByteArray$1(input), webSafe);
        },
        /**
         * Base64-decode a string.
         *
         * @param input to decode.
         * @param webSafe True if we should use the
         *     alternative alphabet.
         * @return string representing the decoded value.
         */
        decodeString(input, webSafe) {
            // Shortcut for Mozilla browsers that implement
            // a native base64 encoder in the form of "btoa/atob"
            if (this.HAS_NATIVE_SUPPORT && !webSafe) {
                return atob(input);
            }
            return byteArrayToString(this.decodeStringToByteArray(input, webSafe));
        },
        /**
         * Base64-decode a string.
         *
         * In base-64 decoding, groups of four characters are converted into three
         * bytes.  If the encoder did not apply padding, the input length may not
         * be a multiple of 4.
         *
         * In this case, the last group will have fewer than 4 characters, and
         * padding will be inferred.  If the group has one or two characters, it decodes
         * to one byte.  If the group has three characters, it decodes to two bytes.
         *
         * @param input Input to decode.
         * @param webSafe True if we should use the web-safe alphabet.
         * @return bytes representing the decoded value.
         */
        decodeStringToByteArray(input, webSafe) {
            this.init_();
            const charToByteMap = webSafe
                ? this.charToByteMapWebSafe_
                : this.charToByteMap_;
            const output = [];
            for (let i = 0; i < input.length;) {
                const byte1 = charToByteMap[input.charAt(i++)];
                const haveByte2 = i < input.length;
                const byte2 = haveByte2 ? charToByteMap[input.charAt(i)] : 0;
                ++i;
                const haveByte3 = i < input.length;
                const byte3 = haveByte3 ? charToByteMap[input.charAt(i)] : 64;
                ++i;
                const haveByte4 = i < input.length;
                const byte4 = haveByte4 ? charToByteMap[input.charAt(i)] : 64;
                ++i;
                if (byte1 == null || byte2 == null || byte3 == null || byte4 == null) {
                    throw Error();
                }
                const outByte1 = (byte1 << 2) | (byte2 >> 4);
                output.push(outByte1);
                if (byte3 !== 64) {
                    const outByte2 = ((byte2 << 4) & 0xf0) | (byte3 >> 2);
                    output.push(outByte2);
                    if (byte4 !== 64) {
                        const outByte3 = ((byte3 << 6) & 0xc0) | byte4;
                        output.push(outByte3);
                    }
                }
            }
            return output;
        },
        /**
         * Lazy static initialization function. Called before
         * accessing any of the static map variables.
         * @private
         */
        init_() {
            if (!this.byteToCharMap_) {
                this.byteToCharMap_ = {};
                this.charToByteMap_ = {};
                this.byteToCharMapWebSafe_ = {};
                this.charToByteMapWebSafe_ = {};
                // We want quick mappings back and forth, so we precompute two maps.
                for (let i = 0; i < this.ENCODED_VALS.length; i++) {
                    this.byteToCharMap_[i] = this.ENCODED_VALS.charAt(i);
                    this.charToByteMap_[this.byteToCharMap_[i]] = i;
                    this.byteToCharMapWebSafe_[i] = this.ENCODED_VALS_WEBSAFE.charAt(i);
                    this.charToByteMapWebSafe_[this.byteToCharMapWebSafe_[i]] = i;
                    // Be forgiving when decoding and correctly decode both encodings.
                    if (i >= this.ENCODED_VALS_BASE.length) {
                        this.charToByteMap_[this.ENCODED_VALS_WEBSAFE.charAt(i)] = i;
                        this.charToByteMapWebSafe_[this.ENCODED_VALS.charAt(i)] = i;
                    }
                }
            }
        }
    };
    /**
     * URL-safe base64 encoding
     */
    const base64Encode = function (str) {
        const utf8Bytes = stringToByteArray$1(str);
        return base64.encodeByteArray(utf8Bytes, true);
    };
    /**
     * URL-safe base64 encoding (without "." padding in the end).
     * e.g. Used in JSON Web Token (JWT) parts.
     */
    const base64urlEncodeWithoutPadding = function (str) {
        // Use base64url encoding and remove padding in the end (dot characters).
        return base64Encode(str).replace(/\./g, '');
    };

    /**
     * @license
     * Copyright 2017 Google LLC
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
    class Deferred {
        constructor() {
            this.reject = () => { };
            this.resolve = () => { };
            this.promise = new Promise((resolve, reject) => {
                this.resolve = resolve;
                this.reject = reject;
            });
        }
        /**
         * Our API internals are not promiseified and cannot because our callback APIs have subtle expectations around
         * invoking promises inline, which Promises are forbidden to do. This method accepts an optional node-style callback
         * and returns a node-style callback which will resolve or reject the Deferred's promise.
         */
        wrapCallback(callback) {
            return (error, value) => {
                if (error) {
                    this.reject(error);
                }
                else {
                    this.resolve(value);
                }
                if (typeof callback === 'function') {
                    // Attaching noop handler just in case developer wasn't expecting
                    // promises
                    this.promise.catch(() => { });
                    // Some of our callbacks don't expect a value and our own tests
                    // assert that the parameter length is 1
                    if (callback.length === 1) {
                        callback(error);
                    }
                    else {
                        callback(error, value);
                    }
                }
            };
        }
    }
    /**
     * This method checks if indexedDB is supported by current browser/service worker context
     * @return true if indexedDB is supported by current browser/service worker context
     */
    function isIndexedDBAvailable() {
        return typeof indexedDB === 'object';
    }
    /**
     * This method validates browser/sw context for indexedDB by opening a dummy indexedDB database and reject
     * if errors occur during the database open operation.
     *
     * @throws exception if current browser/sw context can't run idb.open (ex: Safari iframe, Firefox
     * private browsing)
     */
    function validateIndexedDBOpenable() {
        return new Promise((resolve, reject) => {
            try {
                let preExist = true;
                const DB_CHECK_NAME = 'validate-browser-context-for-indexeddb-analytics-module';
                const request = self.indexedDB.open(DB_CHECK_NAME);
                request.onsuccess = () => {
                    request.result.close();
                    // delete database only when it doesn't pre-exist
                    if (!preExist) {
                        self.indexedDB.deleteDatabase(DB_CHECK_NAME);
                    }
                    resolve(true);
                };
                request.onupgradeneeded = () => {
                    preExist = false;
                };
                request.onerror = () => {
                    var _a;
                    reject(((_a = request.error) === null || _a === void 0 ? void 0 : _a.message) || '');
                };
            }
            catch (error) {
                reject(error);
            }
        });
    }

    /**
     * @license
     * Copyright 2017 Google LLC
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
     * @fileoverview Standardized Firebase Error.
     *
     * Usage:
     *
     *   // Typescript string literals for type-safe codes
     *   type Err =
     *     'unknown' |
     *     'object-not-found'
     *     ;
     *
     *   // Closure enum for type-safe error codes
     *   // at-enum {string}
     *   var Err = {
     *     UNKNOWN: 'unknown',
     *     OBJECT_NOT_FOUND: 'object-not-found',
     *   }
     *
     *   let errors: Map<Err, string> = {
     *     'generic-error': "Unknown error",
     *     'file-not-found': "Could not find file: {$file}",
     *   };
     *
     *   // Type-safe function - must pass a valid error code as param.
     *   let error = new ErrorFactory<Err>('service', 'Service', errors);
     *
     *   ...
     *   throw error.create(Err.GENERIC);
     *   ...
     *   throw error.create(Err.FILE_NOT_FOUND, {'file': fileName});
     *   ...
     *   // Service: Could not file file: foo.txt (service/file-not-found).
     *
     *   catch (e) {
     *     assert(e.message === "Could not find file: foo.txt.");
     *     if (e.code === 'service/file-not-found') {
     *       console.log("Could not read file: " + e['file']);
     *     }
     *   }
     */
    const ERROR_NAME = 'FirebaseError';
    // Based on code from:
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error#Custom_Error_Types
    class FirebaseError extends Error {
        constructor(
        /** The error code for this error. */
        code, message, 
        /** Custom data for this error. */
        customData) {
            super(message);
            this.code = code;
            this.customData = customData;
            /** The custom name for all FirebaseErrors. */
            this.name = ERROR_NAME;
            // Fix For ES5
            // https://github.com/Microsoft/TypeScript-wiki/blob/master/Breaking-Changes.md#extending-built-ins-like-error-array-and-map-may-no-longer-work
            Object.setPrototypeOf(this, FirebaseError.prototype);
            // Maintains proper stack trace for where our error was thrown.
            // Only available on V8.
            if (Error.captureStackTrace) {
                Error.captureStackTrace(this, ErrorFactory.prototype.create);
            }
        }
    }
    class ErrorFactory {
        constructor(service, serviceName, errors) {
            this.service = service;
            this.serviceName = serviceName;
            this.errors = errors;
        }
        create(code, ...data) {
            const customData = data[0] || {};
            const fullCode = `${this.service}/${code}`;
            const template = this.errors[code];
            const message = template ? replaceTemplate(template, customData) : 'Error';
            // Service Name: Error message (service/code).
            const fullMessage = `${this.serviceName}: ${message} (${fullCode}).`;
            const error = new FirebaseError(fullCode, fullMessage, customData);
            return error;
        }
    }
    function replaceTemplate(template, data) {
        return template.replace(PATTERN, (_, key) => {
            const value = data[key];
            return value != null ? String(value) : `<${key}?>`;
        });
    }
    const PATTERN = /\{\$([^}]+)}/g;
    /**
     * Deep equal two objects. Support Arrays and Objects.
     */
    function deepEqual(a, b) {
        if (a === b) {
            return true;
        }
        const aKeys = Object.keys(a);
        const bKeys = Object.keys(b);
        for (const k of aKeys) {
            if (!bKeys.includes(k)) {
                return false;
            }
            const aProp = a[k];
            const bProp = b[k];
            if (isObject(aProp) && isObject(bProp)) {
                if (!deepEqual(aProp, bProp)) {
                    return false;
                }
            }
            else if (aProp !== bProp) {
                return false;
            }
        }
        for (const k of bKeys) {
            if (!aKeys.includes(k)) {
                return false;
            }
        }
        return true;
    }
    function isObject(thing) {
        return thing !== null && typeof thing === 'object';
    }

    /**
     * Component for service name T, e.g. `auth`, `auth-internal`
     */
    class Component {
        /**
         *
         * @param name The public service name, e.g. app, auth, firestore, database
         * @param instanceFactory Service factory responsible for creating the public interface
         * @param type whether the service provided by the component is public or private
         */
        constructor(name, instanceFactory, type) {
            this.name = name;
            this.instanceFactory = instanceFactory;
            this.type = type;
            this.multipleInstances = false;
            /**
             * Properties to be added to the service namespace
             */
            this.serviceProps = {};
            this.instantiationMode = "LAZY" /* LAZY */;
            this.onInstanceCreated = null;
        }
        setInstantiationMode(mode) {
            this.instantiationMode = mode;
            return this;
        }
        setMultipleInstances(multipleInstances) {
            this.multipleInstances = multipleInstances;
            return this;
        }
        setServiceProps(props) {
            this.serviceProps = props;
            return this;
        }
        setInstanceCreatedCallback(callback) {
            this.onInstanceCreated = callback;
            return this;
        }
    }

    /**
     * @license
     * Copyright 2019 Google LLC
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
    const DEFAULT_ENTRY_NAME$1 = '[DEFAULT]';

    /**
     * @license
     * Copyright 2019 Google LLC
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
     * Provider for instance for service name T, e.g. 'auth', 'auth-internal'
     * NameServiceMapping[T] is an alias for the type of the instance
     */
    class Provider {
        constructor(name, container) {
            this.name = name;
            this.container = container;
            this.component = null;
            this.instances = new Map();
            this.instancesDeferred = new Map();
            this.instancesOptions = new Map();
            this.onInitCallbacks = new Map();
        }
        /**
         * @param identifier A provider can provide mulitple instances of a service
         * if this.component.multipleInstances is true.
         */
        get(identifier) {
            // if multipleInstances is not supported, use the default name
            const normalizedIdentifier = this.normalizeInstanceIdentifier(identifier);
            if (!this.instancesDeferred.has(normalizedIdentifier)) {
                const deferred = new Deferred();
                this.instancesDeferred.set(normalizedIdentifier, deferred);
                if (this.isInitialized(normalizedIdentifier) ||
                    this.shouldAutoInitialize()) {
                    // initialize the service if it can be auto-initialized
                    try {
                        const instance = this.getOrInitializeService({
                            instanceIdentifier: normalizedIdentifier
                        });
                        if (instance) {
                            deferred.resolve(instance);
                        }
                    }
                    catch (e) {
                        // when the instance factory throws an exception during get(), it should not cause
                        // a fatal error. We just return the unresolved promise in this case.
                    }
                }
            }
            return this.instancesDeferred.get(normalizedIdentifier).promise;
        }
        getImmediate(options) {
            var _a;
            // if multipleInstances is not supported, use the default name
            const normalizedIdentifier = this.normalizeInstanceIdentifier(options === null || options === void 0 ? void 0 : options.identifier);
            const optional = (_a = options === null || options === void 0 ? void 0 : options.optional) !== null && _a !== void 0 ? _a : false;
            if (this.isInitialized(normalizedIdentifier) ||
                this.shouldAutoInitialize()) {
                try {
                    return this.getOrInitializeService({
                        instanceIdentifier: normalizedIdentifier
                    });
                }
                catch (e) {
                    if (optional) {
                        return null;
                    }
                    else {
                        throw e;
                    }
                }
            }
            else {
                // In case a component is not initialized and should/can not be auto-initialized at the moment, return null if the optional flag is set, or throw
                if (optional) {
                    return null;
                }
                else {
                    throw Error(`Service ${this.name} is not available`);
                }
            }
        }
        getComponent() {
            return this.component;
        }
        setComponent(component) {
            if (component.name !== this.name) {
                throw Error(`Mismatching Component ${component.name} for Provider ${this.name}.`);
            }
            if (this.component) {
                throw Error(`Component for ${this.name} has already been provided`);
            }
            this.component = component;
            // return early without attempting to initialize the component if the component requires explicit initialization (calling `Provider.initialize()`)
            if (!this.shouldAutoInitialize()) {
                return;
            }
            // if the service is eager, initialize the default instance
            if (isComponentEager(component)) {
                try {
                    this.getOrInitializeService({ instanceIdentifier: DEFAULT_ENTRY_NAME$1 });
                }
                catch (e) {
                    // when the instance factory for an eager Component throws an exception during the eager
                    // initialization, it should not cause a fatal error.
                    // TODO: Investigate if we need to make it configurable, because some component may want to cause
                    // a fatal error in this case?
                }
            }
            // Create service instances for the pending promises and resolve them
            // NOTE: if this.multipleInstances is false, only the default instance will be created
            // and all promises with resolve with it regardless of the identifier.
            for (const [instanceIdentifier, instanceDeferred] of this.instancesDeferred.entries()) {
                const normalizedIdentifier = this.normalizeInstanceIdentifier(instanceIdentifier);
                try {
                    // `getOrInitializeService()` should always return a valid instance since a component is guaranteed. use ! to make typescript happy.
                    const instance = this.getOrInitializeService({
                        instanceIdentifier: normalizedIdentifier
                    });
                    instanceDeferred.resolve(instance);
                }
                catch (e) {
                    // when the instance factory throws an exception, it should not cause
                    // a fatal error. We just leave the promise unresolved.
                }
            }
        }
        clearInstance(identifier = DEFAULT_ENTRY_NAME$1) {
            this.instancesDeferred.delete(identifier);
            this.instancesOptions.delete(identifier);
            this.instances.delete(identifier);
        }
        // app.delete() will call this method on every provider to delete the services
        // TODO: should we mark the provider as deleted?
        async delete() {
            const services = Array.from(this.instances.values());
            await Promise.all([
                ...services
                    .filter(service => 'INTERNAL' in service) // legacy services
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    .map(service => service.INTERNAL.delete()),
                ...services
                    .filter(service => '_delete' in service) // modularized services
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    .map(service => service._delete())
            ]);
        }
        isComponentSet() {
            return this.component != null;
        }
        isInitialized(identifier = DEFAULT_ENTRY_NAME$1) {
            return this.instances.has(identifier);
        }
        getOptions(identifier = DEFAULT_ENTRY_NAME$1) {
            return this.instancesOptions.get(identifier) || {};
        }
        initialize(opts = {}) {
            const { options = {} } = opts;
            const normalizedIdentifier = this.normalizeInstanceIdentifier(opts.instanceIdentifier);
            if (this.isInitialized(normalizedIdentifier)) {
                throw Error(`${this.name}(${normalizedIdentifier}) has already been initialized`);
            }
            if (!this.isComponentSet()) {
                throw Error(`Component ${this.name} has not been registered yet`);
            }
            const instance = this.getOrInitializeService({
                instanceIdentifier: normalizedIdentifier,
                options
            });
            // resolve any pending promise waiting for the service instance
            for (const [instanceIdentifier, instanceDeferred] of this.instancesDeferred.entries()) {
                const normalizedDeferredIdentifier = this.normalizeInstanceIdentifier(instanceIdentifier);
                if (normalizedIdentifier === normalizedDeferredIdentifier) {
                    instanceDeferred.resolve(instance);
                }
            }
            return instance;
        }
        /**
         *
         * @param callback - a function that will be invoked  after the provider has been initialized by calling provider.initialize().
         * The function is invoked SYNCHRONOUSLY, so it should not execute any longrunning tasks in order to not block the program.
         *
         * @param identifier An optional instance identifier
         * @returns a function to unregister the callback
         */
        onInit(callback, identifier) {
            var _a;
            const normalizedIdentifier = this.normalizeInstanceIdentifier(identifier);
            const existingCallbacks = (_a = this.onInitCallbacks.get(normalizedIdentifier)) !== null && _a !== void 0 ? _a : new Set();
            existingCallbacks.add(callback);
            this.onInitCallbacks.set(normalizedIdentifier, existingCallbacks);
            const existingInstance = this.instances.get(normalizedIdentifier);
            if (existingInstance) {
                callback(existingInstance, normalizedIdentifier);
            }
            return () => {
                existingCallbacks.delete(callback);
            };
        }
        /**
         * Invoke onInit callbacks synchronously
         * @param instance the service instance`
         */
        invokeOnInitCallbacks(instance, identifier) {
            const callbacks = this.onInitCallbacks.get(identifier);
            if (!callbacks) {
                return;
            }
            for (const callback of callbacks) {
                try {
                    callback(instance, identifier);
                }
                catch (_a) {
                    // ignore errors in the onInit callback
                }
            }
        }
        getOrInitializeService({ instanceIdentifier, options = {} }) {
            let instance = this.instances.get(instanceIdentifier);
            if (!instance && this.component) {
                instance = this.component.instanceFactory(this.container, {
                    instanceIdentifier: normalizeIdentifierForFactory(instanceIdentifier),
                    options
                });
                this.instances.set(instanceIdentifier, instance);
                this.instancesOptions.set(instanceIdentifier, options);
                /**
                 * Invoke onInit listeners.
                 * Note this.component.onInstanceCreated is different, which is used by the component creator,
                 * while onInit listeners are registered by consumers of the provider.
                 */
                this.invokeOnInitCallbacks(instance, instanceIdentifier);
                /**
                 * Order is important
                 * onInstanceCreated() should be called after this.instances.set(instanceIdentifier, instance); which
                 * makes `isInitialized()` return true.
                 */
                if (this.component.onInstanceCreated) {
                    try {
                        this.component.onInstanceCreated(this.container, instanceIdentifier, instance);
                    }
                    catch (_a) {
                        // ignore errors in the onInstanceCreatedCallback
                    }
                }
            }
            return instance || null;
        }
        normalizeInstanceIdentifier(identifier = DEFAULT_ENTRY_NAME$1) {
            if (this.component) {
                return this.component.multipleInstances ? identifier : DEFAULT_ENTRY_NAME$1;
            }
            else {
                return identifier; // assume multiple instances are supported before the component is provided.
            }
        }
        shouldAutoInitialize() {
            return (!!this.component &&
                this.component.instantiationMode !== "EXPLICIT" /* EXPLICIT */);
        }
    }
    // undefined should be passed to the service factory for the default instance
    function normalizeIdentifierForFactory(identifier) {
        return identifier === DEFAULT_ENTRY_NAME$1 ? undefined : identifier;
    }
    function isComponentEager(component) {
        return component.instantiationMode === "EAGER" /* EAGER */;
    }

    /**
     * @license
     * Copyright 2019 Google LLC
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
     * ComponentContainer that provides Providers for service name T, e.g. `auth`, `auth-internal`
     */
    class ComponentContainer {
        constructor(name) {
            this.name = name;
            this.providers = new Map();
        }
        /**
         *
         * @param component Component being added
         * @param overwrite When a component with the same name has already been registered,
         * if overwrite is true: overwrite the existing component with the new component and create a new
         * provider with the new component. It can be useful in tests where you want to use different mocks
         * for different tests.
         * if overwrite is false: throw an exception
         */
        addComponent(component) {
            const provider = this.getProvider(component.name);
            if (provider.isComponentSet()) {
                throw new Error(`Component ${component.name} has already been registered with ${this.name}`);
            }
            provider.setComponent(component);
        }
        addOrOverwriteComponent(component) {
            const provider = this.getProvider(component.name);
            if (provider.isComponentSet()) {
                // delete the existing provider from the container, so we can register the new component
                this.providers.delete(component.name);
            }
            this.addComponent(component);
        }
        /**
         * getProvider provides a type safe interface where it can only be called with a field name
         * present in NameServiceMapping interface.
         *
         * Firebase SDKs providing services should extend NameServiceMapping interface to register
         * themselves.
         */
        getProvider(name) {
            if (this.providers.has(name)) {
                return this.providers.get(name);
            }
            // create a Provider for a service that hasn't registered with Firebase
            const provider = new Provider(name, this);
            this.providers.set(name, provider);
            return provider;
        }
        getProviders() {
            return Array.from(this.providers.values());
        }
    }

    /**
     * @license
     * Copyright 2017 Google LLC
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
     * The JS SDK supports 5 log levels and also allows a user the ability to
     * silence the logs altogether.
     *
     * The order is a follows:
     * DEBUG < VERBOSE < INFO < WARN < ERROR
     *
     * All of the log types above the current log level will be captured (i.e. if
     * you set the log level to `INFO`, errors will still be logged, but `DEBUG` and
     * `VERBOSE` logs will not)
     */
    var LogLevel;
    (function (LogLevel) {
        LogLevel[LogLevel["DEBUG"] = 0] = "DEBUG";
        LogLevel[LogLevel["VERBOSE"] = 1] = "VERBOSE";
        LogLevel[LogLevel["INFO"] = 2] = "INFO";
        LogLevel[LogLevel["WARN"] = 3] = "WARN";
        LogLevel[LogLevel["ERROR"] = 4] = "ERROR";
        LogLevel[LogLevel["SILENT"] = 5] = "SILENT";
    })(LogLevel || (LogLevel = {}));
    const levelStringToEnum = {
        'debug': LogLevel.DEBUG,
        'verbose': LogLevel.VERBOSE,
        'info': LogLevel.INFO,
        'warn': LogLevel.WARN,
        'error': LogLevel.ERROR,
        'silent': LogLevel.SILENT
    };
    /**
     * The default log level
     */
    const defaultLogLevel = LogLevel.INFO;
    /**
     * By default, `console.debug` is not displayed in the developer console (in
     * chrome). To avoid forcing users to have to opt-in to these logs twice
     * (i.e. once for firebase, and once in the console), we are sending `DEBUG`
     * logs to the `console.log` function.
     */
    const ConsoleMethod = {
        [LogLevel.DEBUG]: 'log',
        [LogLevel.VERBOSE]: 'log',
        [LogLevel.INFO]: 'info',
        [LogLevel.WARN]: 'warn',
        [LogLevel.ERROR]: 'error'
    };
    /**
     * The default log handler will forward DEBUG, VERBOSE, INFO, WARN, and ERROR
     * messages on to their corresponding console counterparts (if the log method
     * is supported by the current log level)
     */
    const defaultLogHandler = (instance, logType, ...args) => {
        if (logType < instance.logLevel) {
            return;
        }
        const now = new Date().toISOString();
        const method = ConsoleMethod[logType];
        if (method) {
            console[method](`[${now}]  ${instance.name}:`, ...args);
        }
        else {
            throw new Error(`Attempted to log a message with an invalid logType (value: ${logType})`);
        }
    };
    class Logger {
        /**
         * Gives you an instance of a Logger to capture messages according to
         * Firebase's logging scheme.
         *
         * @param name The name that the logs will be associated with
         */
        constructor(name) {
            this.name = name;
            /**
             * The log level of the given Logger instance.
             */
            this._logLevel = defaultLogLevel;
            /**
             * The main (internal) log handler for the Logger instance.
             * Can be set to a new function in internal package code but not by user.
             */
            this._logHandler = defaultLogHandler;
            /**
             * The optional, additional, user-defined log handler for the Logger instance.
             */
            this._userLogHandler = null;
        }
        get logLevel() {
            return this._logLevel;
        }
        set logLevel(val) {
            if (!(val in LogLevel)) {
                throw new TypeError(`Invalid value "${val}" assigned to \`logLevel\``);
            }
            this._logLevel = val;
        }
        // Workaround for setter/getter having to be the same type.
        setLogLevel(val) {
            this._logLevel = typeof val === 'string' ? levelStringToEnum[val] : val;
        }
        get logHandler() {
            return this._logHandler;
        }
        set logHandler(val) {
            if (typeof val !== 'function') {
                throw new TypeError('Value assigned to `logHandler` must be a function');
            }
            this._logHandler = val;
        }
        get userLogHandler() {
            return this._userLogHandler;
        }
        set userLogHandler(val) {
            this._userLogHandler = val;
        }
        /**
         * The functions below are all based on the `console` interface
         */
        debug(...args) {
            this._userLogHandler && this._userLogHandler(this, LogLevel.DEBUG, ...args);
            this._logHandler(this, LogLevel.DEBUG, ...args);
        }
        log(...args) {
            this._userLogHandler &&
                this._userLogHandler(this, LogLevel.VERBOSE, ...args);
            this._logHandler(this, LogLevel.VERBOSE, ...args);
        }
        info(...args) {
            this._userLogHandler && this._userLogHandler(this, LogLevel.INFO, ...args);
            this._logHandler(this, LogLevel.INFO, ...args);
        }
        warn(...args) {
            this._userLogHandler && this._userLogHandler(this, LogLevel.WARN, ...args);
            this._logHandler(this, LogLevel.WARN, ...args);
        }
        error(...args) {
            this._userLogHandler && this._userLogHandler(this, LogLevel.ERROR, ...args);
            this._logHandler(this, LogLevel.ERROR, ...args);
        }
    }

    const instanceOfAny = (object, constructors) => constructors.some((c) => object instanceof c);

    let idbProxyableTypes;
    let cursorAdvanceMethods;
    // This is a function to prevent it throwing up in node environments.
    function getIdbProxyableTypes() {
        return (idbProxyableTypes ||
            (idbProxyableTypes = [
                IDBDatabase,
                IDBObjectStore,
                IDBIndex,
                IDBCursor,
                IDBTransaction,
            ]));
    }
    // This is a function to prevent it throwing up in node environments.
    function getCursorAdvanceMethods() {
        return (cursorAdvanceMethods ||
            (cursorAdvanceMethods = [
                IDBCursor.prototype.advance,
                IDBCursor.prototype.continue,
                IDBCursor.prototype.continuePrimaryKey,
            ]));
    }
    const cursorRequestMap = new WeakMap();
    const transactionDoneMap = new WeakMap();
    const transactionStoreNamesMap = new WeakMap();
    const transformCache = new WeakMap();
    const reverseTransformCache = new WeakMap();
    function promisifyRequest(request) {
        const promise = new Promise((resolve, reject) => {
            const unlisten = () => {
                request.removeEventListener('success', success);
                request.removeEventListener('error', error);
            };
            const success = () => {
                resolve(wrap(request.result));
                unlisten();
            };
            const error = () => {
                reject(request.error);
                unlisten();
            };
            request.addEventListener('success', success);
            request.addEventListener('error', error);
        });
        promise
            .then((value) => {
            // Since cursoring reuses the IDBRequest (*sigh*), we cache it for later retrieval
            // (see wrapFunction).
            if (value instanceof IDBCursor) {
                cursorRequestMap.set(value, request);
            }
            // Catching to avoid "Uncaught Promise exceptions"
        })
            .catch(() => { });
        // This mapping exists in reverseTransformCache but doesn't doesn't exist in transformCache. This
        // is because we create many promises from a single IDBRequest.
        reverseTransformCache.set(promise, request);
        return promise;
    }
    function cacheDonePromiseForTransaction(tx) {
        // Early bail if we've already created a done promise for this transaction.
        if (transactionDoneMap.has(tx))
            return;
        const done = new Promise((resolve, reject) => {
            const unlisten = () => {
                tx.removeEventListener('complete', complete);
                tx.removeEventListener('error', error);
                tx.removeEventListener('abort', error);
            };
            const complete = () => {
                resolve();
                unlisten();
            };
            const error = () => {
                reject(tx.error || new DOMException('AbortError', 'AbortError'));
                unlisten();
            };
            tx.addEventListener('complete', complete);
            tx.addEventListener('error', error);
            tx.addEventListener('abort', error);
        });
        // Cache it for later retrieval.
        transactionDoneMap.set(tx, done);
    }
    let idbProxyTraps = {
        get(target, prop, receiver) {
            if (target instanceof IDBTransaction) {
                // Special handling for transaction.done.
                if (prop === 'done')
                    return transactionDoneMap.get(target);
                // Polyfill for objectStoreNames because of Edge.
                if (prop === 'objectStoreNames') {
                    return target.objectStoreNames || transactionStoreNamesMap.get(target);
                }
                // Make tx.store return the only store in the transaction, or undefined if there are many.
                if (prop === 'store') {
                    return receiver.objectStoreNames[1]
                        ? undefined
                        : receiver.objectStore(receiver.objectStoreNames[0]);
                }
            }
            // Else transform whatever we get back.
            return wrap(target[prop]);
        },
        set(target, prop, value) {
            target[prop] = value;
            return true;
        },
        has(target, prop) {
            if (target instanceof IDBTransaction &&
                (prop === 'done' || prop === 'store')) {
                return true;
            }
            return prop in target;
        },
    };
    function replaceTraps(callback) {
        idbProxyTraps = callback(idbProxyTraps);
    }
    function wrapFunction(func) {
        // Due to expected object equality (which is enforced by the caching in `wrap`), we
        // only create one new func per func.
        // Edge doesn't support objectStoreNames (booo), so we polyfill it here.
        if (func === IDBDatabase.prototype.transaction &&
            !('objectStoreNames' in IDBTransaction.prototype)) {
            return function (storeNames, ...args) {
                const tx = func.call(unwrap(this), storeNames, ...args);
                transactionStoreNamesMap.set(tx, storeNames.sort ? storeNames.sort() : [storeNames]);
                return wrap(tx);
            };
        }
        // Cursor methods are special, as the behaviour is a little more different to standard IDB. In
        // IDB, you advance the cursor and wait for a new 'success' on the IDBRequest that gave you the
        // cursor. It's kinda like a promise that can resolve with many values. That doesn't make sense
        // with real promises, so each advance methods returns a new promise for the cursor object, or
        // undefined if the end of the cursor has been reached.
        if (getCursorAdvanceMethods().includes(func)) {
            return function (...args) {
                // Calling the original function with the proxy as 'this' causes ILLEGAL INVOCATION, so we use
                // the original object.
                func.apply(unwrap(this), args);
                return wrap(cursorRequestMap.get(this));
            };
        }
        return function (...args) {
            // Calling the original function with the proxy as 'this' causes ILLEGAL INVOCATION, so we use
            // the original object.
            return wrap(func.apply(unwrap(this), args));
        };
    }
    function transformCachableValue(value) {
        if (typeof value === 'function')
            return wrapFunction(value);
        // This doesn't return, it just creates a 'done' promise for the transaction,
        // which is later returned for transaction.done (see idbObjectHandler).
        if (value instanceof IDBTransaction)
            cacheDonePromiseForTransaction(value);
        if (instanceOfAny(value, getIdbProxyableTypes()))
            return new Proxy(value, idbProxyTraps);
        // Return the same value back if we're not going to transform it.
        return value;
    }
    function wrap(value) {
        // We sometimes generate multiple promises from a single IDBRequest (eg when cursoring), because
        // IDB is weird and a single IDBRequest can yield many responses, so these can't be cached.
        if (value instanceof IDBRequest)
            return promisifyRequest(value);
        // If we've already transformed this value before, reuse the transformed value.
        // This is faster, but it also provides object equality.
        if (transformCache.has(value))
            return transformCache.get(value);
        const newValue = transformCachableValue(value);
        // Not all types are transformed.
        // These may be primitive types, so they can't be WeakMap keys.
        if (newValue !== value) {
            transformCache.set(value, newValue);
            reverseTransformCache.set(newValue, value);
        }
        return newValue;
    }
    const unwrap = (value) => reverseTransformCache.get(value);

    /**
     * Open a database.
     *
     * @param name Name of the database.
     * @param version Schema version.
     * @param callbacks Additional callbacks.
     */
    function openDB(name, version, { blocked, upgrade, blocking, terminated }) {
        const request = indexedDB.open(name, version);
        const openPromise = wrap(request);
        if (upgrade) {
            request.addEventListener('upgradeneeded', (event) => {
                upgrade(wrap(request.result), event.oldVersion, event.newVersion, wrap(request.transaction));
            });
        }
        if (blocked)
            request.addEventListener('blocked', () => blocked());
        openPromise
            .then((db) => {
            if (terminated)
                db.addEventListener('close', () => terminated());
            if (blocking)
                db.addEventListener('versionchange', () => blocking());
        })
            .catch(() => { });
        return openPromise;
    }

    const readMethods = ['get', 'getKey', 'getAll', 'getAllKeys', 'count'];
    const writeMethods = ['put', 'add', 'delete', 'clear'];
    const cachedMethods = new Map();
    function getMethod(target, prop) {
        if (!(target instanceof IDBDatabase &&
            !(prop in target) &&
            typeof prop === 'string')) {
            return;
        }
        if (cachedMethods.get(prop))
            return cachedMethods.get(prop);
        const targetFuncName = prop.replace(/FromIndex$/, '');
        const useIndex = prop !== targetFuncName;
        const isWrite = writeMethods.includes(targetFuncName);
        if (
        // Bail if the target doesn't exist on the target. Eg, getAll isn't in Edge.
        !(targetFuncName in (useIndex ? IDBIndex : IDBObjectStore).prototype) ||
            !(isWrite || readMethods.includes(targetFuncName))) {
            return;
        }
        const method = async function (storeName, ...args) {
            // isWrite ? 'readwrite' : undefined gzipps better, but fails in Edge :(
            const tx = this.transaction(storeName, isWrite ? 'readwrite' : 'readonly');
            let target = tx.store;
            if (useIndex)
                target = target.index(args.shift());
            // Must reject if op rejects.
            // If it's a write operation, must reject if tx.done rejects.
            // Must reject with op rejection first.
            // Must resolve with op value.
            // Must handle both promises (no unhandled rejections)
            return (await Promise.all([
                target[targetFuncName](...args),
                isWrite && tx.done,
            ]))[0];
        };
        cachedMethods.set(prop, method);
        return method;
    }
    replaceTraps((oldTraps) => ({
        ...oldTraps,
        get: (target, prop, receiver) => getMethod(target, prop) || oldTraps.get(target, prop, receiver),
        has: (target, prop) => !!getMethod(target, prop) || oldTraps.has(target, prop),
    }));

    /**
     * @license
     * Copyright 2019 Google LLC
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
    class PlatformLoggerServiceImpl {
        constructor(container) {
            this.container = container;
        }
        // In initial implementation, this will be called by installations on
        // auth token refresh, and installations will send this string.
        getPlatformInfoString() {
            const providers = this.container.getProviders();
            // Loop through providers and get library/version pairs from any that are
            // version components.
            return providers
                .map(provider => {
                if (isVersionServiceProvider(provider)) {
                    const service = provider.getImmediate();
                    return `${service.library}/${service.version}`;
                }
                else {
                    return null;
                }
            })
                .filter(logString => logString)
                .join(' ');
        }
    }
    /**
     *
     * @param provider check if this provider provides a VersionService
     *
     * NOTE: Using Provider<'app-version'> is a hack to indicate that the provider
     * provides VersionService. The provider is not necessarily a 'app-version'
     * provider.
     */
    function isVersionServiceProvider(provider) {
        const component = provider.getComponent();
        return (component === null || component === void 0 ? void 0 : component.type) === "VERSION" /* VERSION */;
    }

    const name$o = "@firebase/app";
    const version$1 = "0.7.25";

    /**
     * @license
     * Copyright 2019 Google LLC
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
    const logger = new Logger('@firebase/app');

    const name$n = "@firebase/app-compat";

    const name$m = "@firebase/analytics-compat";

    const name$l = "@firebase/analytics";

    const name$k = "@firebase/app-check-compat";

    const name$j = "@firebase/app-check";

    const name$i = "@firebase/auth";

    const name$h = "@firebase/auth-compat";

    const name$g = "@firebase/database";

    const name$f = "@firebase/database-compat";

    const name$e = "@firebase/functions";

    const name$d = "@firebase/functions-compat";

    const name$c = "@firebase/installations";

    const name$b = "@firebase/installations-compat";

    const name$a = "@firebase/messaging";

    const name$9 = "@firebase/messaging-compat";

    const name$8 = "@firebase/performance";

    const name$7 = "@firebase/performance-compat";

    const name$6 = "@firebase/remote-config";

    const name$5 = "@firebase/remote-config-compat";

    const name$4 = "@firebase/storage";

    const name$3 = "@firebase/storage-compat";

    const name$2 = "@firebase/firestore";

    const name$1 = "@firebase/firestore-compat";

    const name$p = "firebase";
    const version$2 = "9.8.2";

    /**
     * @license
     * Copyright 2019 Google LLC
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
     * The default app name
     *
     * @internal
     */
    const DEFAULT_ENTRY_NAME = '[DEFAULT]';
    const PLATFORM_LOG_STRING = {
        [name$o]: 'fire-core',
        [name$n]: 'fire-core-compat',
        [name$l]: 'fire-analytics',
        [name$m]: 'fire-analytics-compat',
        [name$j]: 'fire-app-check',
        [name$k]: 'fire-app-check-compat',
        [name$i]: 'fire-auth',
        [name$h]: 'fire-auth-compat',
        [name$g]: 'fire-rtdb',
        [name$f]: 'fire-rtdb-compat',
        [name$e]: 'fire-fn',
        [name$d]: 'fire-fn-compat',
        [name$c]: 'fire-iid',
        [name$b]: 'fire-iid-compat',
        [name$a]: 'fire-fcm',
        [name$9]: 'fire-fcm-compat',
        [name$8]: 'fire-perf',
        [name$7]: 'fire-perf-compat',
        [name$6]: 'fire-rc',
        [name$5]: 'fire-rc-compat',
        [name$4]: 'fire-gcs',
        [name$3]: 'fire-gcs-compat',
        [name$2]: 'fire-fst',
        [name$1]: 'fire-fst-compat',
        'fire-js': 'fire-js',
        [name$p]: 'fire-js-all'
    };

    /**
     * @license
     * Copyright 2019 Google LLC
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
     * @internal
     */
    const _apps = new Map();
    /**
     * Registered components.
     *
     * @internal
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const _components = new Map();
    /**
     * @param component - the component being added to this app's container
     *
     * @internal
     */
    function _addComponent(app, component) {
        try {
            app.container.addComponent(component);
        }
        catch (e) {
            logger.debug(`Component ${component.name} failed to register with FirebaseApp ${app.name}`, e);
        }
    }
    /**
     *
     * @param component - the component to register
     * @returns whether or not the component is registered successfully
     *
     * @internal
     */
    function _registerComponent(component) {
        const componentName = component.name;
        if (_components.has(componentName)) {
            logger.debug(`There were multiple attempts to register component ${componentName}.`);
            return false;
        }
        _components.set(componentName, component);
        // add the component to existing app instances
        for (const app of _apps.values()) {
            _addComponent(app, component);
        }
        return true;
    }
    /**
     *
     * @param app - FirebaseApp instance
     * @param name - service name
     *
     * @returns the provider for the service with the matching name
     *
     * @internal
     */
    function _getProvider(app, name) {
        const heartbeatController = app.container
            .getProvider('heartbeat')
            .getImmediate({ optional: true });
        if (heartbeatController) {
            void heartbeatController.triggerHeartbeat();
        }
        return app.container.getProvider(name);
    }

    /**
     * @license
     * Copyright 2019 Google LLC
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
    const ERRORS = {
        ["no-app" /* NO_APP */]: "No Firebase App '{$appName}' has been created - " +
            'call Firebase App.initializeApp()',
        ["bad-app-name" /* BAD_APP_NAME */]: "Illegal App name: '{$appName}",
        ["duplicate-app" /* DUPLICATE_APP */]: "Firebase App named '{$appName}' already exists with different options or config",
        ["app-deleted" /* APP_DELETED */]: "Firebase App named '{$appName}' already deleted",
        ["invalid-app-argument" /* INVALID_APP_ARGUMENT */]: 'firebase.{$appName}() takes either no argument or a ' +
            'Firebase App instance.',
        ["invalid-log-argument" /* INVALID_LOG_ARGUMENT */]: 'First argument to `onLog` must be null or a function.',
        ["storage-open" /* STORAGE_OPEN */]: 'Error thrown when opening storage. Original error: {$originalErrorMessage}.',
        ["storage-get" /* STORAGE_GET */]: 'Error thrown when reading from storage. Original error: {$originalErrorMessage}.',
        ["storage-set" /* STORAGE_WRITE */]: 'Error thrown when writing to storage. Original error: {$originalErrorMessage}.',
        ["storage-delete" /* STORAGE_DELETE */]: 'Error thrown when deleting from storage. Original error: {$originalErrorMessage}.'
    };
    const ERROR_FACTORY = new ErrorFactory('app', 'Firebase', ERRORS);

    /**
     * @license
     * Copyright 2019 Google LLC
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
    class FirebaseAppImpl {
        constructor(options, config, container) {
            this._isDeleted = false;
            this._options = Object.assign({}, options);
            this._config = Object.assign({}, config);
            this._name = config.name;
            this._automaticDataCollectionEnabled =
                config.automaticDataCollectionEnabled;
            this._container = container;
            this.container.addComponent(new Component('app', () => this, "PUBLIC" /* PUBLIC */));
        }
        get automaticDataCollectionEnabled() {
            this.checkDestroyed();
            return this._automaticDataCollectionEnabled;
        }
        set automaticDataCollectionEnabled(val) {
            this.checkDestroyed();
            this._automaticDataCollectionEnabled = val;
        }
        get name() {
            this.checkDestroyed();
            return this._name;
        }
        get options() {
            this.checkDestroyed();
            return this._options;
        }
        get config() {
            this.checkDestroyed();
            return this._config;
        }
        get container() {
            return this._container;
        }
        get isDeleted() {
            return this._isDeleted;
        }
        set isDeleted(val) {
            this._isDeleted = val;
        }
        /**
         * This function will throw an Error if the App has already been deleted -
         * use before performing API actions on the App.
         */
        checkDestroyed() {
            if (this.isDeleted) {
                throw ERROR_FACTORY.create("app-deleted" /* APP_DELETED */, { appName: this._name });
            }
        }
    }

    /**
     * @license
     * Copyright 2019 Google LLC
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
     * The current SDK version.
     *
     * @public
     */
    const SDK_VERSION = version$2;
    function initializeApp(options, rawConfig = {}) {
        if (typeof rawConfig !== 'object') {
            const name = rawConfig;
            rawConfig = { name };
        }
        const config = Object.assign({ name: DEFAULT_ENTRY_NAME, automaticDataCollectionEnabled: false }, rawConfig);
        const name = config.name;
        if (typeof name !== 'string' || !name) {
            throw ERROR_FACTORY.create("bad-app-name" /* BAD_APP_NAME */, {
                appName: String(name)
            });
        }
        const existingApp = _apps.get(name);
        if (existingApp) {
            // return the existing app if options and config deep equal the ones in the existing app.
            if (deepEqual(options, existingApp.options) &&
                deepEqual(config, existingApp.config)) {
                return existingApp;
            }
            else {
                throw ERROR_FACTORY.create("duplicate-app" /* DUPLICATE_APP */, { appName: name });
            }
        }
        const container = new ComponentContainer(name);
        for (const component of _components.values()) {
            container.addComponent(component);
        }
        const newApp = new FirebaseAppImpl(options, config, container);
        _apps.set(name, newApp);
        return newApp;
    }
    /**
     * Retrieves a {@link @firebase/app#FirebaseApp} instance.
     *
     * When called with no arguments, the default app is returned. When an app name
     * is provided, the app corresponding to that name is returned.
     *
     * An exception is thrown if the app being retrieved has not yet been
     * initialized.
     *
     * @example
     * ```javascript
     * // Return the default app
     * const app = getApp();
     * ```
     *
     * @example
     * ```javascript
     * // Return a named app
     * const otherApp = getApp("otherApp");
     * ```
     *
     * @param name - Optional name of the app to return. If no name is
     *   provided, the default is `"[DEFAULT]"`.
     *
     * @returns The app corresponding to the provided app name.
     *   If no app name is provided, the default app is returned.
     *
     * @public
     */
    function getApp(name = DEFAULT_ENTRY_NAME) {
        const app = _apps.get(name);
        if (!app) {
            throw ERROR_FACTORY.create("no-app" /* NO_APP */, { appName: name });
        }
        return app;
    }
    /**
     * Registers a library's name and version for platform logging purposes.
     * @param library - Name of 1p or 3p library (e.g. firestore, angularfire)
     * @param version - Current version of that library.
     * @param variant - Bundle variant, e.g., node, rn, etc.
     *
     * @public
     */
    function registerVersion(libraryKeyOrName, version, variant) {
        var _a;
        // TODO: We can use this check to whitelist strings when/if we set up
        // a good whitelist system.
        let library = (_a = PLATFORM_LOG_STRING[libraryKeyOrName]) !== null && _a !== void 0 ? _a : libraryKeyOrName;
        if (variant) {
            library += `-${variant}`;
        }
        const libraryMismatch = library.match(/\s|\//);
        const versionMismatch = version.match(/\s|\//);
        if (libraryMismatch || versionMismatch) {
            const warning = [
                `Unable to register library "${library}" with version "${version}":`
            ];
            if (libraryMismatch) {
                warning.push(`library name "${library}" contains illegal characters (whitespace or "/")`);
            }
            if (libraryMismatch && versionMismatch) {
                warning.push('and');
            }
            if (versionMismatch) {
                warning.push(`version name "${version}" contains illegal characters (whitespace or "/")`);
            }
            logger.warn(warning.join(' '));
            return;
        }
        _registerComponent(new Component(`${library}-version`, () => ({ library, version }), "VERSION" /* VERSION */));
    }

    /**
     * @license
     * Copyright 2021 Google LLC
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
    const DB_NAME = 'firebase-heartbeat-database';
    const DB_VERSION = 1;
    const STORE_NAME = 'firebase-heartbeat-store';
    let dbPromise = null;
    function getDbPromise() {
        if (!dbPromise) {
            dbPromise = openDB(DB_NAME, DB_VERSION, {
                upgrade: (db, oldVersion) => {
                    // We don't use 'break' in this switch statement, the fall-through
                    // behavior is what we want, because if there are multiple versions between
                    // the old version and the current version, we want ALL the migrations
                    // that correspond to those versions to run, not only the last one.
                    // eslint-disable-next-line default-case
                    switch (oldVersion) {
                        case 0:
                            db.createObjectStore(STORE_NAME);
                    }
                }
            }).catch(e => {
                throw ERROR_FACTORY.create("storage-open" /* STORAGE_OPEN */, {
                    originalErrorMessage: e.message
                });
            });
        }
        return dbPromise;
    }
    async function readHeartbeatsFromIndexedDB(app) {
        try {
            const db = await getDbPromise();
            return db
                .transaction(STORE_NAME)
                .objectStore(STORE_NAME)
                .get(computeKey(app));
        }
        catch (e) {
            throw ERROR_FACTORY.create("storage-get" /* STORAGE_GET */, {
                originalErrorMessage: e.message
            });
        }
    }
    async function writeHeartbeatsToIndexedDB(app, heartbeatObject) {
        try {
            const db = await getDbPromise();
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const objectStore = tx.objectStore(STORE_NAME);
            await objectStore.put(heartbeatObject, computeKey(app));
            return tx.done;
        }
        catch (e) {
            throw ERROR_FACTORY.create("storage-set" /* STORAGE_WRITE */, {
                originalErrorMessage: e.message
            });
        }
    }
    function computeKey(app) {
        return `${app.name}!${app.options.appId}`;
    }

    /**
     * @license
     * Copyright 2021 Google LLC
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
    const MAX_HEADER_BYTES = 1024;
    // 30 days
    const STORED_HEARTBEAT_RETENTION_MAX_MILLIS = 30 * 24 * 60 * 60 * 1000;
    class HeartbeatServiceImpl {
        constructor(container) {
            this.container = container;
            /**
             * In-memory cache for heartbeats, used by getHeartbeatsHeader() to generate
             * the header string.
             * Stores one record per date. This will be consolidated into the standard
             * format of one record per user agent string before being sent as a header.
             * Populated from indexedDB when the controller is instantiated and should
             * be kept in sync with indexedDB.
             * Leave public for easier testing.
             */
            this._heartbeatsCache = null;
            const app = this.container.getProvider('app').getImmediate();
            this._storage = new HeartbeatStorageImpl(app);
            this._heartbeatsCachePromise = this._storage.read().then(result => {
                this._heartbeatsCache = result;
                return result;
            });
        }
        /**
         * Called to report a heartbeat. The function will generate
         * a HeartbeatsByUserAgent object, update heartbeatsCache, and persist it
         * to IndexedDB.
         * Note that we only store one heartbeat per day. So if a heartbeat for today is
         * already logged, subsequent calls to this function in the same day will be ignored.
         */
        async triggerHeartbeat() {
            const platformLogger = this.container
                .getProvider('platform-logger')
                .getImmediate();
            // This is the "Firebase user agent" string from the platform logger
            // service, not the browser user agent.
            const agent = platformLogger.getPlatformInfoString();
            const date = getUTCDateString();
            if (this._heartbeatsCache === null) {
                this._heartbeatsCache = await this._heartbeatsCachePromise;
            }
            // Do not store a heartbeat if one is already stored for this day
            // or if a header has already been sent today.
            if (this._heartbeatsCache.lastSentHeartbeatDate === date ||
                this._heartbeatsCache.heartbeats.some(singleDateHeartbeat => singleDateHeartbeat.date === date)) {
                return;
            }
            else {
                // There is no entry for this date. Create one.
                this._heartbeatsCache.heartbeats.push({ date, agent });
            }
            // Remove entries older than 30 days.
            this._heartbeatsCache.heartbeats = this._heartbeatsCache.heartbeats.filter(singleDateHeartbeat => {
                const hbTimestamp = new Date(singleDateHeartbeat.date).valueOf();
                const now = Date.now();
                return now - hbTimestamp <= STORED_HEARTBEAT_RETENTION_MAX_MILLIS;
            });
            return this._storage.overwrite(this._heartbeatsCache);
        }
        /**
         * Returns a base64 encoded string which can be attached to the heartbeat-specific header directly.
         * It also clears all heartbeats from memory as well as in IndexedDB.
         *
         * NOTE: Consuming product SDKs should not send the header if this method
         * returns an empty string.
         */
        async getHeartbeatsHeader() {
            if (this._heartbeatsCache === null) {
                await this._heartbeatsCachePromise;
            }
            // If it's still null or the array is empty, there is no data to send.
            if (this._heartbeatsCache === null ||
                this._heartbeatsCache.heartbeats.length === 0) {
                return '';
            }
            const date = getUTCDateString();
            // Extract as many heartbeats from the cache as will fit under the size limit.
            const { heartbeatsToSend, unsentEntries } = extractHeartbeatsForHeader(this._heartbeatsCache.heartbeats);
            const headerString = base64urlEncodeWithoutPadding(JSON.stringify({ version: 2, heartbeats: heartbeatsToSend }));
            // Store last sent date to prevent another being logged/sent for the same day.
            this._heartbeatsCache.lastSentHeartbeatDate = date;
            if (unsentEntries.length > 0) {
                // Store any unsent entries if they exist.
                this._heartbeatsCache.heartbeats = unsentEntries;
                // This seems more likely than emptying the array (below) to lead to some odd state
                // since the cache isn't empty and this will be called again on the next request,
                // and is probably safest if we await it.
                await this._storage.overwrite(this._heartbeatsCache);
            }
            else {
                this._heartbeatsCache.heartbeats = [];
                // Do not wait for this, to reduce latency.
                void this._storage.overwrite(this._heartbeatsCache);
            }
            return headerString;
        }
    }
    function getUTCDateString() {
        const today = new Date();
        // Returns date format 'YYYY-MM-DD'
        return today.toISOString().substring(0, 10);
    }
    function extractHeartbeatsForHeader(heartbeatsCache, maxSize = MAX_HEADER_BYTES) {
        // Heartbeats grouped by user agent in the standard format to be sent in
        // the header.
        const heartbeatsToSend = [];
        // Single date format heartbeats that are not sent.
        let unsentEntries = heartbeatsCache.slice();
        for (const singleDateHeartbeat of heartbeatsCache) {
            // Look for an existing entry with the same user agent.
            const heartbeatEntry = heartbeatsToSend.find(hb => hb.agent === singleDateHeartbeat.agent);
            if (!heartbeatEntry) {
                // If no entry for this user agent exists, create one.
                heartbeatsToSend.push({
                    agent: singleDateHeartbeat.agent,
                    dates: [singleDateHeartbeat.date]
                });
                if (countBytes(heartbeatsToSend) > maxSize) {
                    // If the header would exceed max size, remove the added heartbeat
                    // entry and stop adding to the header.
                    heartbeatsToSend.pop();
                    break;
                }
            }
            else {
                heartbeatEntry.dates.push(singleDateHeartbeat.date);
                // If the header would exceed max size, remove the added date
                // and stop adding to the header.
                if (countBytes(heartbeatsToSend) > maxSize) {
                    heartbeatEntry.dates.pop();
                    break;
                }
            }
            // Pop unsent entry from queue. (Skipped if adding the entry exceeded
            // quota and the loop breaks early.)
            unsentEntries = unsentEntries.slice(1);
        }
        return {
            heartbeatsToSend,
            unsentEntries
        };
    }
    class HeartbeatStorageImpl {
        constructor(app) {
            this.app = app;
            this._canUseIndexedDBPromise = this.runIndexedDBEnvironmentCheck();
        }
        async runIndexedDBEnvironmentCheck() {
            if (!isIndexedDBAvailable()) {
                return false;
            }
            else {
                return validateIndexedDBOpenable()
                    .then(() => true)
                    .catch(() => false);
            }
        }
        /**
         * Read all heartbeats.
         */
        async read() {
            const canUseIndexedDB = await this._canUseIndexedDBPromise;
            if (!canUseIndexedDB) {
                return { heartbeats: [] };
            }
            else {
                const idbHeartbeatObject = await readHeartbeatsFromIndexedDB(this.app);
                return idbHeartbeatObject || { heartbeats: [] };
            }
        }
        // overwrite the storage with the provided heartbeats
        async overwrite(heartbeatsObject) {
            var _a;
            const canUseIndexedDB = await this._canUseIndexedDBPromise;
            if (!canUseIndexedDB) {
                return;
            }
            else {
                const existingHeartbeatsObject = await this.read();
                return writeHeartbeatsToIndexedDB(this.app, {
                    lastSentHeartbeatDate: (_a = heartbeatsObject.lastSentHeartbeatDate) !== null && _a !== void 0 ? _a : existingHeartbeatsObject.lastSentHeartbeatDate,
                    heartbeats: heartbeatsObject.heartbeats
                });
            }
        }
        // add heartbeats
        async add(heartbeatsObject) {
            var _a;
            const canUseIndexedDB = await this._canUseIndexedDBPromise;
            if (!canUseIndexedDB) {
                return;
            }
            else {
                const existingHeartbeatsObject = await this.read();
                return writeHeartbeatsToIndexedDB(this.app, {
                    lastSentHeartbeatDate: (_a = heartbeatsObject.lastSentHeartbeatDate) !== null && _a !== void 0 ? _a : existingHeartbeatsObject.lastSentHeartbeatDate,
                    heartbeats: [
                        ...existingHeartbeatsObject.heartbeats,
                        ...heartbeatsObject.heartbeats
                    ]
                });
            }
        }
    }
    /**
     * Calculate bytes of a HeartbeatsByUserAgent array after being wrapped
     * in a platform logging header JSON object, stringified, and converted
     * to base 64.
     */
    function countBytes(heartbeatsCache) {
        // base64 has a restricted set of characters, all of which should be 1 byte.
        return base64urlEncodeWithoutPadding(
        // heartbeatsCache wrapper properties
        JSON.stringify({ version: 2, heartbeats: heartbeatsCache })).length;
    }

    /**
     * @license
     * Copyright 2019 Google LLC
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
    function registerCoreComponents(variant) {
        _registerComponent(new Component('platform-logger', container => new PlatformLoggerServiceImpl(container), "PRIVATE" /* PRIVATE */));
        _registerComponent(new Component('heartbeat', container => new HeartbeatServiceImpl(container), "PRIVATE" /* PRIVATE */));
        // Register `app` package.
        registerVersion(name$o, version$1, variant);
        // BUILD_TARGET will be replaced by values like esm5, esm2017, cjs5, etc during the compilation
        registerVersion(name$o, version$1, 'esm2017');
        // Register platform SDK identifier (no version).
        registerVersion('fire-js', '');
    }

    /**
     * Firebase App
     *
     * @remarks This package coordinates the communication between the different Firebase components
     * @packageDocumentation
     */
    registerCoreComponents('');

    var name = "firebase";
    var version = "9.8.2";

    /**
     * @license
     * Copyright 2020 Google LLC
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
    registerVersion(name, version, 'app');

    var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

    /*

     Copyright The Closure Library Authors.
     SPDX-License-Identifier: Apache-2.0
    */
    var k,goog=goog||{},l=commonjsGlobal||self;function aa(){}function ba(a){var b=typeof a;b="object"!=b?b:a?Array.isArray(a)?"array":b:"null";return "array"==b||"object"==b&&"number"==typeof a.length}function p(a){var b=typeof a;return "object"==b&&null!=a||"function"==b}function da(a){return Object.prototype.hasOwnProperty.call(a,ea)&&a[ea]||(a[ea]=++fa)}var ea="closure_uid_"+(1E9*Math.random()>>>0),fa=0;function ha(a,b,c){return a.call.apply(a.bind,arguments)}
    function ia(a,b,c){if(!a)throw Error();if(2<arguments.length){var d=Array.prototype.slice.call(arguments,2);return function(){var e=Array.prototype.slice.call(arguments);Array.prototype.unshift.apply(e,d);return a.apply(b,e)}}return function(){return a.apply(b,arguments)}}function q(a,b,c){Function.prototype.bind&&-1!=Function.prototype.bind.toString().indexOf("native code")?q=ha:q=ia;return q.apply(null,arguments)}
    function ja(a,b){var c=Array.prototype.slice.call(arguments,1);return function(){var d=c.slice();d.push.apply(d,arguments);return a.apply(this,d)}}function t(a,b){function c(){}c.prototype=b.prototype;a.Z=b.prototype;a.prototype=new c;a.prototype.constructor=a;a.Vb=function(d,e,f){for(var h=Array(arguments.length-2),n=2;n<arguments.length;n++)h[n-2]=arguments[n];return b.prototype[e].apply(d,h)};}function v(){this.s=this.s;this.o=this.o;}var ka=0;v.prototype.s=!1;v.prototype.na=function(){if(!this.s&&(this.s=!0,this.M(),0!=ka)){da(this);}};v.prototype.M=function(){if(this.o)for(;this.o.length;)this.o.shift()();};const ma=Array.prototype.indexOf?function(a,b){return Array.prototype.indexOf.call(a,b,void 0)}:function(a,b){if("string"===typeof a)return "string"!==typeof b||1!=b.length?-1:a.indexOf(b,0);for(let c=0;c<a.length;c++)if(c in a&&a[c]===b)return c;return -1},na=Array.prototype.forEach?function(a,b,c){Array.prototype.forEach.call(a,b,c);}:function(a,b,c){const d=a.length,e="string"===typeof a?a.split(""):a;for(let f=0;f<d;f++)f in e&&b.call(c,e[f],f,a);};
    function oa(a){a:{var b=pa;const c=a.length,d="string"===typeof a?a.split(""):a;for(let e=0;e<c;e++)if(e in d&&b.call(void 0,d[e],e,a)){b=e;break a}b=-1;}return 0>b?null:"string"===typeof a?a.charAt(b):a[b]}function qa(a){return Array.prototype.concat.apply([],arguments)}function ra(a){const b=a.length;if(0<b){const c=Array(b);for(let d=0;d<b;d++)c[d]=a[d];return c}return []}function sa(a){return /^[\s\xa0]*$/.test(a)}var ta=String.prototype.trim?function(a){return a.trim()}:function(a){return /^[\s\xa0]*([\s\S]*?)[\s\xa0]*$/.exec(a)[1]};function w(a,b){return -1!=a.indexOf(b)}function ua(a,b){return a<b?-1:a>b?1:0}var x$1;a:{var va=l.navigator;if(va){var wa=va.userAgent;if(wa){x$1=wa;break a}}x$1="";}function xa(a,b,c){for(const d in a)b.call(c,a[d],d,a);}function ya(a){const b={};for(const c in a)b[c]=a[c];return b}var za="constructor hasOwnProperty isPrototypeOf propertyIsEnumerable toLocaleString toString valueOf".split(" ");function Aa(a,b){let c,d;for(let e=1;e<arguments.length;e++){d=arguments[e];for(c in d)a[c]=d[c];for(let f=0;f<za.length;f++)c=za[f],Object.prototype.hasOwnProperty.call(d,c)&&(a[c]=d[c]);}}function Ca(a){Ca[" "](a);return a}Ca[" "]=aa;function Fa(a){var b=Ga;return Object.prototype.hasOwnProperty.call(b,9)?b[9]:b[9]=a(9)}var Ha=w(x$1,"Opera"),y=w(x$1,"Trident")||w(x$1,"MSIE"),Ia=w(x$1,"Edge"),Ja=Ia||y,Ka=w(x$1,"Gecko")&&!(w(x$1.toLowerCase(),"webkit")&&!w(x$1,"Edge"))&&!(w(x$1,"Trident")||w(x$1,"MSIE"))&&!w(x$1,"Edge"),La=w(x$1.toLowerCase(),"webkit")&&!w(x$1,"Edge");function Ma(){var a=l.document;return a?a.documentMode:void 0}var Na;
    a:{var Oa="",Pa=function(){var a=x$1;if(Ka)return /rv:([^\);]+)(\)|;)/.exec(a);if(Ia)return /Edge\/([\d\.]+)/.exec(a);if(y)return /\b(?:MSIE|rv)[: ]([^\);]+)(\)|;)/.exec(a);if(La)return /WebKit\/(\S+)/.exec(a);if(Ha)return /(?:Version)[ \/]?(\S+)/.exec(a)}();Pa&&(Oa=Pa?Pa[1]:"");if(y){var Qa=Ma();if(null!=Qa&&Qa>parseFloat(Oa)){Na=String(Qa);break a}}Na=Oa;}var Ga={};
    function Ra(){return Fa(function(){let a=0;const b=ta(String(Na)).split("."),c=ta("9").split("."),d=Math.max(b.length,c.length);for(let h=0;0==a&&h<d;h++){var e=b[h]||"",f=c[h]||"";do{e=/(\d*)(\D*)(.*)/.exec(e)||["","","",""];f=/(\d*)(\D*)(.*)/.exec(f)||["","","",""];if(0==e[0].length&&0==f[0].length)break;a=ua(0==e[1].length?0:parseInt(e[1],10),0==f[1].length?0:parseInt(f[1],10))||ua(0==e[2].length,0==f[2].length)||ua(e[2],f[2]);e=e[3];f=f[3];}while(0==a)}return 0<=a})}if(l.document&&y){Ma();}var Va=function(){if(!l.addEventListener||!Object.defineProperty)return !1;var a=!1,b=Object.defineProperty({},"passive",{get:function(){a=!0;}});try{l.addEventListener("test",aa,b),l.removeEventListener("test",aa,b);}catch(c){}return a}();function z$1(a,b){this.type=a;this.g=this.target=b;this.defaultPrevented=!1;}z$1.prototype.h=function(){this.defaultPrevented=!0;};function A(a,b){z$1.call(this,a?a.type:"");this.relatedTarget=this.g=this.target=null;this.button=this.screenY=this.screenX=this.clientY=this.clientX=0;this.key="";this.metaKey=this.shiftKey=this.altKey=this.ctrlKey=!1;this.state=null;this.pointerId=0;this.pointerType="";this.i=null;if(a){var c=this.type=a.type,d=a.changedTouches&&a.changedTouches.length?a.changedTouches[0]:null;this.target=a.target||a.srcElement;this.g=b;if(b=a.relatedTarget){if(Ka){a:{try{Ca(b.nodeName);var e=!0;break a}catch(f){}e=
    !1;}e||(b=null);}}else "mouseover"==c?b=a.fromElement:"mouseout"==c&&(b=a.toElement);this.relatedTarget=b;d?(this.clientX=void 0!==d.clientX?d.clientX:d.pageX,this.clientY=void 0!==d.clientY?d.clientY:d.pageY,this.screenX=d.screenX||0,this.screenY=d.screenY||0):(this.clientX=void 0!==a.clientX?a.clientX:a.pageX,this.clientY=void 0!==a.clientY?a.clientY:a.pageY,this.screenX=a.screenX||0,this.screenY=a.screenY||0);this.button=a.button;this.key=a.key||"";this.ctrlKey=a.ctrlKey;this.altKey=a.altKey;this.shiftKey=
    a.shiftKey;this.metaKey=a.metaKey;this.pointerId=a.pointerId||0;this.pointerType="string"===typeof a.pointerType?a.pointerType:Wa[a.pointerType]||"";this.state=a.state;this.i=a;a.defaultPrevented&&A.Z.h.call(this);}}t(A,z$1);var Wa={2:"touch",3:"pen",4:"mouse"};A.prototype.h=function(){A.Z.h.call(this);var a=this.i;a.preventDefault?a.preventDefault():a.returnValue=!1;};var B$1="closure_listenable_"+(1E6*Math.random()|0);var Xa=0;function Ya(a,b,c,d,e){this.listener=a;this.proxy=null;this.src=b;this.type=c;this.capture=!!d;this.ia=e;this.key=++Xa;this.ca=this.fa=!1;}function Za(a){a.ca=!0;a.listener=null;a.proxy=null;a.src=null;a.ia=null;}function $a$1(a){this.src=a;this.g={};this.h=0;}$a$1.prototype.add=function(a,b,c,d,e){var f=a.toString();a=this.g[f];a||(a=this.g[f]=[],this.h++);var h=ab(a,b,d,e);-1<h?(b=a[h],c||(b.fa=!1)):(b=new Ya(b,this.src,f,!!d,e),b.fa=c,a.push(b));return b};function bb(a,b){var c=b.type;if(c in a.g){var d=a.g[c],e=ma(d,b),f;(f=0<=e)&&Array.prototype.splice.call(d,e,1);f&&(Za(b),0==a.g[c].length&&(delete a.g[c],a.h--));}}
    function ab(a,b,c,d){for(var e=0;e<a.length;++e){var f=a[e];if(!f.ca&&f.listener==b&&f.capture==!!c&&f.ia==d)return e}return -1}var cb="closure_lm_"+(1E6*Math.random()|0),db={};function fb(a,b,c,d,e){if(d&&d.once)return gb(a,b,c,d,e);if(Array.isArray(b)){for(var f=0;f<b.length;f++)fb(a,b[f],c,d,e);return null}c=hb(c);return a&&a[B$1]?a.N(b,c,p(d)?!!d.capture:!!d,e):ib(a,b,c,!1,d,e)}
    function ib(a,b,c,d,e,f){if(!b)throw Error("Invalid event type");var h=p(e)?!!e.capture:!!e,n=jb(a);n||(a[cb]=n=new $a$1(a));c=n.add(b,c,d,h,f);if(c.proxy)return c;d=kb();c.proxy=d;d.src=a;d.listener=c;if(a.addEventListener)Va||(e=h),void 0===e&&(e=!1),a.addEventListener(b.toString(),d,e);else if(a.attachEvent)a.attachEvent(lb(b.toString()),d);else if(a.addListener&&a.removeListener)a.addListener(d);else throw Error("addEventListener and attachEvent are unavailable.");return c}
    function kb(){function a(c){return b.call(a.src,a.listener,c)}var b=mb;return a}function gb(a,b,c,d,e){if(Array.isArray(b)){for(var f=0;f<b.length;f++)gb(a,b[f],c,d,e);return null}c=hb(c);return a&&a[B$1]?a.O(b,c,p(d)?!!d.capture:!!d,e):ib(a,b,c,!0,d,e)}
    function nb(a,b,c,d,e){if(Array.isArray(b))for(var f=0;f<b.length;f++)nb(a,b[f],c,d,e);else (d=p(d)?!!d.capture:!!d,c=hb(c),a&&a[B$1])?(a=a.i,b=String(b).toString(),b in a.g&&(f=a.g[b],c=ab(f,c,d,e),-1<c&&(Za(f[c]),Array.prototype.splice.call(f,c,1),0==f.length&&(delete a.g[b],a.h--)))):a&&(a=jb(a))&&(b=a.g[b.toString()],a=-1,b&&(a=ab(b,c,d,e)),(c=-1<a?b[a]:null)&&ob(c));}
    function ob(a){if("number"!==typeof a&&a&&!a.ca){var b=a.src;if(b&&b[B$1])bb(b.i,a);else {var c=a.type,d=a.proxy;b.removeEventListener?b.removeEventListener(c,d,a.capture):b.detachEvent?b.detachEvent(lb(c),d):b.addListener&&b.removeListener&&b.removeListener(d);(c=jb(b))?(bb(c,a),0==c.h&&(c.src=null,b[cb]=null)):Za(a);}}}function lb(a){return a in db?db[a]:db[a]="on"+a}function mb(a,b){if(a.ca)a=!0;else {b=new A(b,this);var c=a.listener,d=a.ia||a.src;a.fa&&ob(a);a=c.call(d,b);}return a}
    function jb(a){a=a[cb];return a instanceof $a$1?a:null}var pb="__closure_events_fn_"+(1E9*Math.random()>>>0);function hb(a){if("function"===typeof a)return a;a[pb]||(a[pb]=function(b){return a.handleEvent(b)});return a[pb]}function C$1(){v.call(this);this.i=new $a$1(this);this.P=this;this.I=null;}t(C$1,v);C$1.prototype[B$1]=!0;C$1.prototype.removeEventListener=function(a,b,c,d){nb(this,a,b,c,d);};
    function D$1(a,b){var c,d=a.I;if(d)for(c=[];d;d=d.I)c.push(d);a=a.P;d=b.type||b;if("string"===typeof b)b=new z$1(b,a);else if(b instanceof z$1)b.target=b.target||a;else {var e=b;b=new z$1(d,a);Aa(b,e);}e=!0;if(c)for(var f=c.length-1;0<=f;f--){var h=b.g=c[f];e=qb(h,d,!0,b)&&e;}h=b.g=a;e=qb(h,d,!0,b)&&e;e=qb(h,d,!1,b)&&e;if(c)for(f=0;f<c.length;f++)h=b.g=c[f],e=qb(h,d,!1,b)&&e;}
    C$1.prototype.M=function(){C$1.Z.M.call(this);if(this.i){var a=this.i,c;for(c in a.g){for(var d=a.g[c],e=0;e<d.length;e++)Za(d[e]);delete a.g[c];a.h--;}}this.I=null;};C$1.prototype.N=function(a,b,c,d){return this.i.add(String(a),b,!1,c,d)};C$1.prototype.O=function(a,b,c,d){return this.i.add(String(a),b,!0,c,d)};
    function qb(a,b,c,d){b=a.i.g[String(b)];if(!b)return !0;b=b.concat();for(var e=!0,f=0;f<b.length;++f){var h=b[f];if(h&&!h.ca&&h.capture==c){var n=h.listener,u=h.ia||h.src;h.fa&&bb(a.i,h);e=!1!==n.call(u,d)&&e;}}return e&&!d.defaultPrevented}var rb=l.JSON.stringify;function sb(){var a=tb;let b=null;a.g&&(b=a.g,a.g=a.g.next,a.g||(a.h=null),b.next=null);return b}class ub{constructor(){this.h=this.g=null;}add(a,b){const c=vb.get();c.set(a,b);this.h?this.h.next=c:this.g=c;this.h=c;}}var vb=new class{constructor(a,b){this.i=a;this.j=b;this.h=0;this.g=null;}get(){let a;0<this.h?(this.h--,a=this.g,this.g=a.next,a.next=null):a=this.i();return a}}(()=>new wb,a=>a.reset());
    class wb{constructor(){this.next=this.g=this.h=null;}set(a,b){this.h=a;this.g=b;this.next=null;}reset(){this.next=this.g=this.h=null;}}function yb(a){l.setTimeout(()=>{throw a;},0);}function zb(a,b){Ab||Bb();Cb||(Ab(),Cb=!0);tb.add(a,b);}var Ab;function Bb(){var a=l.Promise.resolve(void 0);Ab=function(){a.then(Db);};}var Cb=!1,tb=new ub;function Db(){for(var a;a=sb();){try{a.h.call(a.g);}catch(c){yb(c);}var b=vb;b.j(a);100>b.h&&(b.h++,a.next=b.g,b.g=a);}Cb=!1;}function Eb(a,b){C$1.call(this);this.h=a||1;this.g=b||l;this.j=q(this.kb,this);this.l=Date.now();}t(Eb,C$1);k=Eb.prototype;k.da=!1;k.S=null;k.kb=function(){if(this.da){var a=Date.now()-this.l;0<a&&a<.8*this.h?this.S=this.g.setTimeout(this.j,this.h-a):(this.S&&(this.g.clearTimeout(this.S),this.S=null),D$1(this,"tick"),this.da&&(Fb(this),this.start()));}};k.start=function(){this.da=!0;this.S||(this.S=this.g.setTimeout(this.j,this.h),this.l=Date.now());};
    function Fb(a){a.da=!1;a.S&&(a.g.clearTimeout(a.S),a.S=null);}k.M=function(){Eb.Z.M.call(this);Fb(this);delete this.g;};function Gb(a,b,c){if("function"===typeof a)c&&(a=q(a,c));else if(a&&"function"==typeof a.handleEvent)a=q(a.handleEvent,a);else throw Error("Invalid listener argument");return 2147483647<Number(b)?-1:l.setTimeout(a,b||0)}function Hb(a){a.g=Gb(()=>{a.g=null;a.i&&(a.i=!1,Hb(a));},a.j);const b=a.h;a.h=null;a.m.apply(null,b);}class Ib extends v{constructor(a,b){super();this.m=a;this.j=b;this.h=null;this.i=!1;this.g=null;}l(a){this.h=arguments;this.g?this.i=!0:Hb(this);}M(){super.M();this.g&&(l.clearTimeout(this.g),this.g=null,this.i=!1,this.h=null);}}function E(a){v.call(this);this.h=a;this.g={};}t(E,v);var Jb=[];function Kb(a,b,c,d){Array.isArray(c)||(c&&(Jb[0]=c.toString()),c=Jb);for(var e=0;e<c.length;e++){var f=fb(b,c[e],d||a.handleEvent,!1,a.h||a);if(!f)break;a.g[f.key]=f;}}function Lb(a){xa(a.g,function(b,c){this.g.hasOwnProperty(c)&&ob(b);},a);a.g={};}E.prototype.M=function(){E.Z.M.call(this);Lb(this);};E.prototype.handleEvent=function(){throw Error("EventHandler.handleEvent not implemented");};function Mb(){this.g=!0;}Mb.prototype.Aa=function(){this.g=!1;};function Nb(a,b,c,d,e,f){a.info(function(){if(a.g)if(f){var h="";for(var n=f.split("&"),u=0;u<n.length;u++){var m=n[u].split("=");if(1<m.length){var r=m[0];m=m[1];var G=r.split("_");h=2<=G.length&&"type"==G[1]?h+(r+"="+m+"&"):h+(r+"=redacted&");}}}else h=null;else h=f;return "XMLHTTP REQ ("+d+") [attempt "+e+"]: "+b+"\n"+c+"\n"+h});}
    function Ob(a,b,c,d,e,f,h){a.info(function(){return "XMLHTTP RESP ("+d+") [ attempt "+e+"]: "+b+"\n"+c+"\n"+f+" "+h});}function F$1(a,b,c,d){a.info(function(){return "XMLHTTP TEXT ("+b+"): "+Pb(a,c)+(d?" "+d:"")});}function Qb(a,b){a.info(function(){return "TIMEOUT: "+b});}Mb.prototype.info=function(){};
    function Pb(a,b){if(!a.g)return b;if(!b)return null;try{var c=JSON.parse(b);if(c)for(a=0;a<c.length;a++)if(Array.isArray(c[a])){var d=c[a];if(!(2>d.length)){var e=d[1];if(Array.isArray(e)&&!(1>e.length)){var f=e[0];if("noop"!=f&&"stop"!=f&&"close"!=f)for(var h=1;h<e.length;h++)e[h]="";}}}return rb(c)}catch(n){return b}}var H={},Rb=null;function Sb(){return Rb=Rb||new C$1}H.Ma="serverreachability";function Tb(a){z$1.call(this,H.Ma,a);}t(Tb,z$1);function I(a){const b=Sb();D$1(b,new Tb(b,a));}H.STAT_EVENT="statevent";function Ub(a,b){z$1.call(this,H.STAT_EVENT,a);this.stat=b;}t(Ub,z$1);function J$1(a){const b=Sb();D$1(b,new Ub(b,a));}H.Na="timingevent";function Vb(a,b){z$1.call(this,H.Na,a);this.size=b;}t(Vb,z$1);
    function K(a,b){if("function"!==typeof a)throw Error("Fn must not be null and must be a function");return l.setTimeout(function(){a();},b)}var Wb={NO_ERROR:0,lb:1,yb:2,xb:3,sb:4,wb:5,zb:6,Ja:7,TIMEOUT:8,Cb:9};var Xb={qb:"complete",Mb:"success",Ka:"error",Ja:"abort",Eb:"ready",Fb:"readystatechange",TIMEOUT:"timeout",Ab:"incrementaldata",Db:"progress",tb:"downloadprogress",Ub:"uploadprogress"};function Yb(){}Yb.prototype.h=null;function Zb(a){return a.h||(a.h=a.i())}function $b(){}var L$1={OPEN:"a",pb:"b",Ka:"c",Bb:"d"};function ac(){z$1.call(this,"d");}t(ac,z$1);function bc(){z$1.call(this,"c");}t(bc,z$1);var cc;function dc$1(){}t(dc$1,Yb);dc$1.prototype.g=function(){return new XMLHttpRequest};dc$1.prototype.i=function(){return {}};cc=new dc$1;function M(a,b,c,d){this.l=a;this.j=b;this.m=c;this.X=d||1;this.V=new E(this);this.P=ec;a=Ja?125:void 0;this.W=new Eb(a);this.H=null;this.i=!1;this.s=this.A=this.v=this.K=this.F=this.Y=this.B=null;this.D=[];this.g=null;this.C=0;this.o=this.u=null;this.N=-1;this.I=!1;this.O=0;this.L=null;this.aa=this.J=this.$=this.U=!1;this.h=new fc$1;}function fc$1(){this.i=null;this.g="";this.h=!1;}var ec=45E3,gc={},hc={};k=M.prototype;k.setTimeout=function(a){this.P=a;};
    function ic$1(a,b,c){a.K=1;a.v=jc(N$1(b));a.s=c;a.U=!0;kc(a,null);}function kc(a,b){a.F=Date.now();lc(a);a.A=N$1(a.v);var c=a.A,d=a.X;Array.isArray(d)||(d=[String(d)]);mc(c.h,"t",d);a.C=0;c=a.l.H;a.h=new fc$1;a.g=nc(a.l,c?b:null,!a.s);0<a.O&&(a.L=new Ib(q(a.Ia,a,a.g),a.O));Kb(a.V,a.g,"readystatechange",a.gb);b=a.H?ya(a.H):{};a.s?(a.u||(a.u="POST"),b["Content-Type"]="application/x-www-form-urlencoded",a.g.ea(a.A,a.u,a.s,b)):(a.u="GET",a.g.ea(a.A,a.u,null,b));I();Nb(a.j,a.u,a.A,a.m,a.X,a.s);}
    k.gb=function(a){a=a.target;const b=this.L;b&&3==O$1(a)?b.l():this.Ia(a);};
    k.Ia=function(a){try{if(a==this.g)a:{const r=O$1(this.g);var b=this.g.Da();const G=this.g.ba();if(!(3>r)&&(3!=r||Ja||this.g&&(this.h.h||this.g.ga()||oc$1(this.g)))){this.I||4!=r||7==b||(8==b||0>=G?I(3):I(2));pc(this);var c=this.g.ba();this.N=c;b:if(qc(this)){var d=oc$1(this.g);a="";var e=d.length,f=4==O$1(this.g);if(!this.h.i){if("undefined"===typeof TextDecoder){P(this);rc(this);var h="";break b}this.h.i=new l.TextDecoder;}for(b=0;b<e;b++)this.h.h=!0,a+=this.h.i.decode(d[b],{stream:f&&b==e-1});d.splice(0,
    e);this.h.g+=a;this.C=0;h=this.h.g;}else h=this.g.ga();this.i=200==c;Ob(this.j,this.u,this.A,this.m,this.X,r,c);if(this.i){if(this.$&&!this.J){b:{if(this.g){var n,u=this.g;if((n=u.g?u.g.getResponseHeader("X-HTTP-Initial-Response"):null)&&!sa(n)){var m=n;break b}}m=null;}if(c=m)F$1(this.j,this.m,c,"Initial handshake response via X-HTTP-Initial-Response"),this.J=!0,sc(this,c);else {this.i=!1;this.o=3;J$1(12);P(this);rc(this);break a}}this.U?(tc(this,r,h),Ja&&this.i&&3==r&&(Kb(this.V,this.W,"tick",this.fb),
    this.W.start())):(F$1(this.j,this.m,h,null),sc(this,h));4==r&&P(this);this.i&&!this.I&&(4==r?uc(this.l,this):(this.i=!1,lc(this)));}else 400==c&&0<h.indexOf("Unknown SID")?(this.o=3,J$1(12)):(this.o=0,J$1(13)),P(this),rc(this);}}}catch(r){}finally{}};function qc(a){return a.g?"GET"==a.u&&2!=a.K&&a.l.Ba:!1}
    function tc(a,b,c){let d=!0,e;for(;!a.I&&a.C<c.length;)if(e=vc(a,c),e==hc){4==b&&(a.o=4,J$1(14),d=!1);F$1(a.j,a.m,null,"[Incomplete Response]");break}else if(e==gc){a.o=4;J$1(15);F$1(a.j,a.m,c,"[Invalid Chunk]");d=!1;break}else F$1(a.j,a.m,e,null),sc(a,e);qc(a)&&e!=hc&&e!=gc&&(a.h.g="",a.C=0);4!=b||0!=c.length||a.h.h||(a.o=1,J$1(16),d=!1);a.i=a.i&&d;d?0<c.length&&!a.aa&&(a.aa=!0,b=a.l,b.g==a&&b.$&&!b.L&&(b.h.info("Great, no buffering proxy detected. Bytes received: "+c.length),wc(b),b.L=!0,J$1(11))):(F$1(a.j,a.m,
    c,"[Invalid Chunked Response]"),P(a),rc(a));}k.fb=function(){if(this.g){var a=O$1(this.g),b=this.g.ga();this.C<b.length&&(pc(this),tc(this,a,b),this.i&&4!=a&&lc(this));}};function vc(a,b){var c=a.C,d=b.indexOf("\n",c);if(-1==d)return hc;c=Number(b.substring(c,d));if(isNaN(c))return gc;d+=1;if(d+c>b.length)return hc;b=b.substr(d,c);a.C=d+c;return b}k.cancel=function(){this.I=!0;P(this);};function lc(a){a.Y=Date.now()+a.P;xc(a,a.P);}
    function xc(a,b){if(null!=a.B)throw Error("WatchDog timer not null");a.B=K(q(a.eb,a),b);}function pc(a){a.B&&(l.clearTimeout(a.B),a.B=null);}k.eb=function(){this.B=null;const a=Date.now();0<=a-this.Y?(Qb(this.j,this.A),2!=this.K&&(I(),J$1(17)),P(this),this.o=2,rc(this)):xc(this,this.Y-a);};function rc(a){0==a.l.G||a.I||uc(a.l,a);}function P(a){pc(a);var b=a.L;b&&"function"==typeof b.na&&b.na();a.L=null;Fb(a.W);Lb(a.V);a.g&&(b=a.g,a.g=null,b.abort(),b.na());}
    function sc(a,b){try{var c=a.l;if(0!=c.G&&(c.g==a||yc(c.i,a)))if(c.I=a.N,!a.J&&yc(c.i,a)&&3==c.G){try{var d=c.Ca.g.parse(b);}catch(m){d=null;}if(Array.isArray(d)&&3==d.length){var e=d;if(0==e[0])a:{if(!c.u){if(c.g)if(c.g.F+3E3<a.F)zc(c),Ac$1(c);else break a;Bc(c);J$1(18);}}else c.ta=e[1],0<c.ta-c.U&&37500>e[2]&&c.N&&0==c.A&&!c.v&&(c.v=K(q(c.ab,c),6E3));if(1>=Cc$1(c.i)&&c.ka){try{c.ka();}catch(m){}c.ka=void 0;}}else Q$1(c,11);}else if((a.J||c.g==a)&&zc(c),!sa(b))for(e=c.Ca.g.parse(b),b=0;b<e.length;b++){let m=e[b];
    c.U=m[0];m=m[1];if(2==c.G)if("c"==m[0]){c.J=m[1];c.la=m[2];const r=m[3];null!=r&&(c.ma=r,c.h.info("VER="+c.ma));const G=m[4];null!=G&&(c.za=G,c.h.info("SVER="+c.za));const Da=m[5];null!=Da&&"number"===typeof Da&&0<Da&&(d=1.5*Da,c.K=d,c.h.info("backChannelRequestTimeoutMs_="+d));d=c;const ca=a.g;if(ca){const Ea=ca.g?ca.g.getResponseHeader("X-Client-Wire-Protocol"):null;if(Ea){var f=d.i;!f.g&&(w(Ea,"spdy")||w(Ea,"quic")||w(Ea,"h2"))&&(f.j=f.l,f.g=new Set,f.h&&(Dc(f,f.h),f.h=null));}if(d.D){const xb=
    ca.g?ca.g.getResponseHeader("X-HTTP-Session-Id"):null;xb&&(d.sa=xb,R(d.F,d.D,xb));}}c.G=3;c.j&&c.j.xa();c.$&&(c.O=Date.now()-a.F,c.h.info("Handshake RTT: "+c.O+"ms"));d=c;var h=a;d.oa=Ec(d,d.H?d.la:null,d.W);if(h.J){Fc(d.i,h);var n=h,u=d.K;u&&n.setTimeout(u);n.B&&(pc(n),lc(n));d.g=h;}else Gc(d);0<c.l.length&&Hc(c);}else "stop"!=m[0]&&"close"!=m[0]||Q$1(c,7);else 3==c.G&&("stop"==m[0]||"close"==m[0]?"stop"==m[0]?Q$1(c,7):Ic(c):"noop"!=m[0]&&c.j&&c.j.wa(m),c.A=0);}I(4);}catch(m){}}function Jc(a){if(a.R&&"function"==typeof a.R)return a.R();if("string"===typeof a)return a.split("");if(ba(a)){for(var b=[],c=a.length,d=0;d<c;d++)b.push(a[d]);return b}b=[];c=0;for(d in a)b[c++]=a[d];return b}
    function Kc(a,b){if(a.forEach&&"function"==typeof a.forEach)a.forEach(b,void 0);else if(ba(a)||"string"===typeof a)na(a,b,void 0);else {if(a.T&&"function"==typeof a.T)var c=a.T();else if(a.R&&"function"==typeof a.R)c=void 0;else if(ba(a)||"string"===typeof a){c=[];for(var d=a.length,e=0;e<d;e++)c.push(e);}else for(e in c=[],d=0,a)c[d++]=e;d=Jc(a);e=d.length;for(var f=0;f<e;f++)b.call(void 0,d[f],c&&c[f],a);}}function S(a,b){this.h={};this.g=[];this.i=0;var c=arguments.length;if(1<c){if(c%2)throw Error("Uneven number of arguments");for(var d=0;d<c;d+=2)this.set(arguments[d],arguments[d+1]);}else if(a)if(a instanceof S)for(c=a.T(),d=0;d<c.length;d++)this.set(c[d],a.get(c[d]));else for(d in a)this.set(d,a[d]);}k=S.prototype;k.R=function(){Lc(this);for(var a=[],b=0;b<this.g.length;b++)a.push(this.h[this.g[b]]);return a};k.T=function(){Lc(this);return this.g.concat()};
    function Lc(a){if(a.i!=a.g.length){for(var b=0,c=0;b<a.g.length;){var d=a.g[b];T(a.h,d)&&(a.g[c++]=d);b++;}a.g.length=c;}if(a.i!=a.g.length){var e={};for(c=b=0;b<a.g.length;)d=a.g[b],T(e,d)||(a.g[c++]=d,e[d]=1),b++;a.g.length=c;}}k.get=function(a,b){return T(this.h,a)?this.h[a]:b};k.set=function(a,b){T(this.h,a)||(this.i++,this.g.push(a));this.h[a]=b;};k.forEach=function(a,b){for(var c=this.T(),d=0;d<c.length;d++){var e=c[d],f=this.get(e);a.call(b,f,e,this);}};
    function T(a,b){return Object.prototype.hasOwnProperty.call(a,b)}var Mc=/^(?:([^:/?#.]+):)?(?:\/\/(?:([^\\/?#]*)@)?([^\\/?#]*?)(?::([0-9]+))?(?=[\\/?#]|$))?([^?#]+)?(?:\?([^#]*))?(?:#([\s\S]*))?$/;function Nc(a,b){if(a){a=a.split("&");for(var c=0;c<a.length;c++){var d=a[c].indexOf("="),e=null;if(0<=d){var f=a[c].substring(0,d);e=a[c].substring(d+1);}else f=a[c];b(f,e?decodeURIComponent(e.replace(/\+/g," ")):"");}}}function U$1(a,b){this.i=this.s=this.j="";this.m=null;this.o=this.l="";this.g=!1;if(a instanceof U$1){this.g=void 0!==b?b:a.g;Oc(this,a.j);this.s=a.s;Pc(this,a.i);Qc(this,a.m);this.l=a.l;b=a.h;var c=new Rc;c.i=b.i;b.g&&(c.g=new S(b.g),c.h=b.h);Sc$1(this,c);this.o=a.o;}else a&&(c=String(a).match(Mc))?(this.g=!!b,Oc(this,c[1]||"",!0),this.s=Tc(c[2]||""),Pc(this,c[3]||"",!0),Qc(this,c[4]),this.l=Tc(c[5]||"",!0),Sc$1(this,c[6]||"",!0),this.o=Tc(c[7]||"")):(this.g=!!b,this.h=new Rc(null,this.g));}
    U$1.prototype.toString=function(){var a=[],b=this.j;b&&a.push(Uc(b,Vc$1,!0),":");var c=this.i;if(c||"file"==b)a.push("//"),(b=this.s)&&a.push(Uc(b,Vc$1,!0),"@"),a.push(encodeURIComponent(String(c)).replace(/%25([0-9a-fA-F]{2})/g,"%$1")),c=this.m,null!=c&&a.push(":",String(c));if(c=this.l)this.i&&"/"!=c.charAt(0)&&a.push("/"),a.push(Uc(c,"/"==c.charAt(0)?Wc:Xc,!0));(c=this.h.toString())&&a.push("?",c);(c=this.o)&&a.push("#",Uc(c,Yc));return a.join("")};function N$1(a){return new U$1(a)}
    function Oc(a,b,c){a.j=c?Tc(b,!0):b;a.j&&(a.j=a.j.replace(/:$/,""));}function Pc(a,b,c){a.i=c?Tc(b,!0):b;}function Qc(a,b){if(b){b=Number(b);if(isNaN(b)||0>b)throw Error("Bad port number "+b);a.m=b;}else a.m=null;}function Sc$1(a,b,c){b instanceof Rc?(a.h=b,Zc(a.h,a.g)):(c||(b=Uc(b,$c)),a.h=new Rc(b,a.g));}function R(a,b,c){a.h.set(b,c);}function jc(a){R(a,"zx",Math.floor(2147483648*Math.random()).toString(36)+Math.abs(Math.floor(2147483648*Math.random())^Date.now()).toString(36));return a}
    function ad(a){return a instanceof U$1?N$1(a):new U$1(a,void 0)}function bd(a,b,c,d){var e=new U$1(null,void 0);a&&Oc(e,a);b&&Pc(e,b);c&&Qc(e,c);d&&(e.l=d);return e}function Tc(a,b){return a?b?decodeURI(a.replace(/%25/g,"%2525")):decodeURIComponent(a):""}function Uc(a,b,c){return "string"===typeof a?(a=encodeURI(a).replace(b,cd),c&&(a=a.replace(/%25([0-9a-fA-F]{2})/g,"%$1")),a):null}function cd(a){a=a.charCodeAt(0);return "%"+(a>>4&15).toString(16)+(a&15).toString(16)}
    var Vc$1=/[#\/\?@]/g,Xc=/[#\?:]/g,Wc=/[#\?]/g,$c=/[#\?@]/g,Yc=/#/g;function Rc(a,b){this.h=this.g=null;this.i=a||null;this.j=!!b;}function V(a){a.g||(a.g=new S,a.h=0,a.i&&Nc(a.i,function(b,c){a.add(decodeURIComponent(b.replace(/\+/g," ")),c);}));}k=Rc.prototype;k.add=function(a,b){V(this);this.i=null;a=W$1(this,a);var c=this.g.get(a);c||this.g.set(a,c=[]);c.push(b);this.h+=1;return this};
    function dd(a,b){V(a);b=W$1(a,b);T(a.g.h,b)&&(a.i=null,a.h-=a.g.get(b).length,a=a.g,T(a.h,b)&&(delete a.h[b],a.i--,a.g.length>2*a.i&&Lc(a)));}function ed(a,b){V(a);b=W$1(a,b);return T(a.g.h,b)}k.forEach=function(a,b){V(this);this.g.forEach(function(c,d){na(c,function(e){a.call(b,e,d,this);},this);},this);};k.T=function(){V(this);for(var a=this.g.R(),b=this.g.T(),c=[],d=0;d<b.length;d++)for(var e=a[d],f=0;f<e.length;f++)c.push(b[d]);return c};
    k.R=function(a){V(this);var b=[];if("string"===typeof a)ed(this,a)&&(b=qa(b,this.g.get(W$1(this,a))));else {a=this.g.R();for(var c=0;c<a.length;c++)b=qa(b,a[c]);}return b};k.set=function(a,b){V(this);this.i=null;a=W$1(this,a);ed(this,a)&&(this.h-=this.g.get(a).length);this.g.set(a,[b]);this.h+=1;return this};k.get=function(a,b){if(!a)return b;a=this.R(a);return 0<a.length?String(a[0]):b};function mc(a,b,c){dd(a,b);0<c.length&&(a.i=null,a.g.set(W$1(a,b),ra(c)),a.h+=c.length);}
    k.toString=function(){if(this.i)return this.i;if(!this.g)return "";for(var a=[],b=this.g.T(),c=0;c<b.length;c++){var d=b[c],e=encodeURIComponent(String(d));d=this.R(d);for(var f=0;f<d.length;f++){var h=e;""!==d[f]&&(h+="="+encodeURIComponent(String(d[f])));a.push(h);}}return this.i=a.join("&")};function W$1(a,b){b=String(b);a.j&&(b=b.toLowerCase());return b}function Zc(a,b){b&&!a.j&&(V(a),a.i=null,a.g.forEach(function(c,d){var e=d.toLowerCase();d!=e&&(dd(this,d),mc(this,e,c));},a));a.j=b;}var fd=class{constructor(a,b){this.h=a;this.g=b;}};function gd(a){this.l=a||hd;l.PerformanceNavigationTiming?(a=l.performance.getEntriesByType("navigation"),a=0<a.length&&("hq"==a[0].nextHopProtocol||"h2"==a[0].nextHopProtocol)):a=!!(l.g&&l.g.Ea&&l.g.Ea()&&l.g.Ea().Zb);this.j=a?this.l:1;this.g=null;1<this.j&&(this.g=new Set);this.h=null;this.i=[];}var hd=10;function id(a){return a.h?!0:a.g?a.g.size>=a.j:!1}function Cc$1(a){return a.h?1:a.g?a.g.size:0}function yc(a,b){return a.h?a.h==b:a.g?a.g.has(b):!1}function Dc(a,b){a.g?a.g.add(b):a.h=b;}
    function Fc(a,b){a.h&&a.h==b?a.h=null:a.g&&a.g.has(b)&&a.g.delete(b);}gd.prototype.cancel=function(){this.i=jd(this);if(this.h)this.h.cancel(),this.h=null;else if(this.g&&0!==this.g.size){for(const a of this.g.values())a.cancel();this.g.clear();}};function jd(a){if(null!=a.h)return a.i.concat(a.h.D);if(null!=a.g&&0!==a.g.size){let b=a.i;for(const c of a.g.values())b=b.concat(c.D);return b}return ra(a.i)}function kd(){}kd.prototype.stringify=function(a){return l.JSON.stringify(a,void 0)};kd.prototype.parse=function(a){return l.JSON.parse(a,void 0)};function ld(){this.g=new kd;}function md(a,b,c){const d=c||"";try{Kc(a,function(e,f){let h=e;p(e)&&(h=rb(e));b.push(d+f+"="+encodeURIComponent(h));});}catch(e){throw b.push(d+"type="+encodeURIComponent("_badmap")),e;}}function nd(a,b){const c=new Mb;if(l.Image){const d=new Image;d.onload=ja(od,c,d,"TestLoadImage: loaded",!0,b);d.onerror=ja(od,c,d,"TestLoadImage: error",!1,b);d.onabort=ja(od,c,d,"TestLoadImage: abort",!1,b);d.ontimeout=ja(od,c,d,"TestLoadImage: timeout",!1,b);l.setTimeout(function(){if(d.ontimeout)d.ontimeout();},1E4);d.src=a;}else b(!1);}function od(a,b,c,d,e){try{b.onload=null,b.onerror=null,b.onabort=null,b.ontimeout=null,e(d);}catch(f){}}function pd(a){this.l=a.$b||null;this.j=a.ib||!1;}t(pd,Yb);pd.prototype.g=function(){return new qd(this.l,this.j)};pd.prototype.i=function(a){return function(){return a}}({});function qd(a,b){C$1.call(this);this.D=a;this.u=b;this.m=void 0;this.readyState=rd;this.status=0;this.responseType=this.responseText=this.response=this.statusText="";this.onreadystatechange=null;this.v=new Headers;this.h=null;this.C="GET";this.B="";this.g=!1;this.A=this.j=this.l=null;}t(qd,C$1);var rd=0;k=qd.prototype;
    k.open=function(a,b){if(this.readyState!=rd)throw this.abort(),Error("Error reopening a connection");this.C=a;this.B=b;this.readyState=1;sd(this);};k.send=function(a){if(1!=this.readyState)throw this.abort(),Error("need to call open() first. ");this.g=!0;const b={headers:this.v,method:this.C,credentials:this.m,cache:void 0};a&&(b.body=a);(this.D||l).fetch(new Request(this.B,b)).then(this.Va.bind(this),this.ha.bind(this));};
    k.abort=function(){this.response=this.responseText="";this.v=new Headers;this.status=0;this.j&&this.j.cancel("Request was aborted.");1<=this.readyState&&this.g&&4!=this.readyState&&(this.g=!1,td(this));this.readyState=rd;};
    k.Va=function(a){if(this.g&&(this.l=a,this.h||(this.status=this.l.status,this.statusText=this.l.statusText,this.h=a.headers,this.readyState=2,sd(this)),this.g&&(this.readyState=3,sd(this),this.g)))if("arraybuffer"===this.responseType)a.arrayBuffer().then(this.Ta.bind(this),this.ha.bind(this));else if("undefined"!==typeof l.ReadableStream&&"body"in a){this.j=a.body.getReader();if(this.u){if(this.responseType)throw Error('responseType must be empty for "streamBinaryChunks" mode responses.');this.response=
    [];}else this.response=this.responseText="",this.A=new TextDecoder;ud(this);}else a.text().then(this.Ua.bind(this),this.ha.bind(this));};function ud(a){a.j.read().then(a.Sa.bind(a)).catch(a.ha.bind(a));}k.Sa=function(a){if(this.g){if(this.u&&a.value)this.response.push(a.value);else if(!this.u){var b=a.value?a.value:new Uint8Array(0);if(b=this.A.decode(b,{stream:!a.done}))this.response=this.responseText+=b;}a.done?td(this):sd(this);3==this.readyState&&ud(this);}};
    k.Ua=function(a){this.g&&(this.response=this.responseText=a,td(this));};k.Ta=function(a){this.g&&(this.response=a,td(this));};k.ha=function(){this.g&&td(this);};function td(a){a.readyState=4;a.l=null;a.j=null;a.A=null;sd(a);}k.setRequestHeader=function(a,b){this.v.append(a,b);};k.getResponseHeader=function(a){return this.h?this.h.get(a.toLowerCase())||"":""};
    k.getAllResponseHeaders=function(){if(!this.h)return "";const a=[],b=this.h.entries();for(var c=b.next();!c.done;)c=c.value,a.push(c[0]+": "+c[1]),c=b.next();return a.join("\r\n")};function sd(a){a.onreadystatechange&&a.onreadystatechange.call(a);}Object.defineProperty(qd.prototype,"withCredentials",{get:function(){return "include"===this.m},set:function(a){this.m=a?"include":"same-origin";}});var vd=l.JSON.parse;function X$1(a){C$1.call(this);this.headers=new S;this.u=a||null;this.h=!1;this.C=this.g=null;this.H="";this.m=0;this.j="";this.l=this.F=this.v=this.D=!1;this.B=0;this.A=null;this.J=wd;this.K=this.L=!1;}t(X$1,C$1);var wd="",xd=/^https?$/i,yd=["POST","PUT"];k=X$1.prototype;
    k.ea=function(a,b,c,d){if(this.g)throw Error("[goog.net.XhrIo] Object is active with another request="+this.H+"; newUri="+a);b=b?b.toUpperCase():"GET";this.H=a;this.j="";this.m=0;this.D=!1;this.h=!0;this.g=this.u?this.u.g():cc.g();this.C=this.u?Zb(this.u):Zb(cc);this.g.onreadystatechange=q(this.Fa,this);try{this.F=!0,this.g.open(b,String(a),!0),this.F=!1;}catch(f){zd(this,f);return}a=c||"";const e=new S(this.headers);d&&Kc(d,function(f,h){e.set(h,f);});d=oa(e.T());c=l.FormData&&a instanceof l.FormData;
    !(0<=ma(yd,b))||d||c||e.set("Content-Type","application/x-www-form-urlencoded;charset=utf-8");e.forEach(function(f,h){this.g.setRequestHeader(h,f);},this);this.J&&(this.g.responseType=this.J);"withCredentials"in this.g&&this.g.withCredentials!==this.L&&(this.g.withCredentials=this.L);try{Ad(this),0<this.B&&((this.K=Bd(this.g))?(this.g.timeout=this.B,this.g.ontimeout=q(this.pa,this)):this.A=Gb(this.pa,this.B,this)),this.v=!0,this.g.send(a),this.v=!1;}catch(f){zd(this,f);}};
    function Bd(a){return y&&Ra()&&"number"===typeof a.timeout&&void 0!==a.ontimeout}function pa(a){return "content-type"==a.toLowerCase()}k.pa=function(){"undefined"!=typeof goog&&this.g&&(this.j="Timed out after "+this.B+"ms, aborting",this.m=8,D$1(this,"timeout"),this.abort(8));};function zd(a,b){a.h=!1;a.g&&(a.l=!0,a.g.abort(),a.l=!1);a.j=b;a.m=5;Cd(a);Dd(a);}function Cd(a){a.D||(a.D=!0,D$1(a,"complete"),D$1(a,"error"));}
    k.abort=function(a){this.g&&this.h&&(this.h=!1,this.l=!0,this.g.abort(),this.l=!1,this.m=a||7,D$1(this,"complete"),D$1(this,"abort"),Dd(this));};k.M=function(){this.g&&(this.h&&(this.h=!1,this.l=!0,this.g.abort(),this.l=!1),Dd(this,!0));X$1.Z.M.call(this);};k.Fa=function(){this.s||(this.F||this.v||this.l?Ed(this):this.cb());};k.cb=function(){Ed(this);};
    function Ed(a){if(a.h&&"undefined"!=typeof goog&&(!a.C[1]||4!=O$1(a)||2!=a.ba()))if(a.v&&4==O$1(a))Gb(a.Fa,0,a);else if(D$1(a,"readystatechange"),4==O$1(a)){a.h=!1;try{const n=a.ba();a:switch(n){case 200:case 201:case 202:case 204:case 206:case 304:case 1223:var b=!0;break a;default:b=!1;}var c;if(!(c=b)){var d;if(d=0===n){var e=String(a.H).match(Mc)[1]||null;if(!e&&l.self&&l.self.location){var f=l.self.location.protocol;e=f.substr(0,f.length-1);}d=!xd.test(e?e.toLowerCase():"");}c=d;}if(c)D$1(a,"complete"),D$1(a,
    "success");else {a.m=6;try{var h=2<O$1(a)?a.g.statusText:"";}catch(u){h="";}a.j=h+" ["+a.ba()+"]";Cd(a);}}finally{Dd(a);}}}function Dd(a,b){if(a.g){Ad(a);const c=a.g,d=a.C[0]?aa:null;a.g=null;a.C=null;b||D$1(a,"ready");try{c.onreadystatechange=d;}catch(e){}}}function Ad(a){a.g&&a.K&&(a.g.ontimeout=null);a.A&&(l.clearTimeout(a.A),a.A=null);}function O$1(a){return a.g?a.g.readyState:0}k.ba=function(){try{return 2<O$1(this)?this.g.status:-1}catch(a){return -1}};
    k.ga=function(){try{return this.g?this.g.responseText:""}catch(a){return ""}};k.Qa=function(a){if(this.g){var b=this.g.responseText;a&&0==b.indexOf(a)&&(b=b.substring(a.length));return vd(b)}};function oc$1(a){try{if(!a.g)return null;if("response"in a.g)return a.g.response;switch(a.J){case wd:case "text":return a.g.responseText;case "arraybuffer":if("mozResponseArrayBuffer"in a.g)return a.g.mozResponseArrayBuffer}return null}catch(b){return null}}k.Da=function(){return this.m};
    k.La=function(){return "string"===typeof this.j?this.j:String(this.j)};function Fd(a){let b="";xa(a,function(c,d){b+=d;b+=":";b+=c;b+="\r\n";});return b}function Gd(a,b,c){a:{for(d in c){var d=!1;break a}d=!0;}d||(c=Fd(c),"string"===typeof a?(null!=c&&encodeURIComponent(String(c))):R(a,b,c));}function Hd(a,b,c){return c&&c.internalChannelParams?c.internalChannelParams[a]||b:b}
    function Id(a){this.za=0;this.l=[];this.h=new Mb;this.la=this.oa=this.F=this.W=this.g=this.sa=this.D=this.aa=this.o=this.P=this.s=null;this.Za=this.V=0;this.Xa=Hd("failFast",!1,a);this.N=this.v=this.u=this.m=this.j=null;this.X=!0;this.I=this.ta=this.U=-1;this.Y=this.A=this.C=0;this.Pa=Hd("baseRetryDelayMs",5E3,a);this.$a=Hd("retryDelaySeedMs",1E4,a);this.Ya=Hd("forwardChannelMaxRetries",2,a);this.ra=Hd("forwardChannelRequestTimeoutMs",2E4,a);this.qa=a&&a.xmlHttpFactory||void 0;this.Ba=a&&a.Yb||!1;
    this.K=void 0;this.H=a&&a.supportsCrossDomainXhr||!1;this.J="";this.i=new gd(a&&a.concurrentRequestLimit);this.Ca=new ld;this.ja=a&&a.fastHandshake||!1;this.Ra=a&&a.Wb||!1;a&&a.Aa&&this.h.Aa();a&&a.forceLongPolling&&(this.X=!1);this.$=!this.ja&&this.X&&a&&a.detectBufferingProxy||!1;this.ka=void 0;this.O=0;this.L=!1;this.B=null;this.Wa=!a||!1!==a.Xb;}k=Id.prototype;k.ma=8;k.G=1;
    function Ic(a){Jd(a);if(3==a.G){var b=a.V++,c=N$1(a.F);R(c,"SID",a.J);R(c,"RID",b);R(c,"TYPE","terminate");Kd(a,c);b=new M(a,a.h,b,void 0);b.K=2;b.v=jc(N$1(c));c=!1;l.navigator&&l.navigator.sendBeacon&&(c=l.navigator.sendBeacon(b.v.toString(),""));!c&&l.Image&&((new Image).src=b.v,c=!0);c||(b.g=nc(b.l,null),b.g.ea(b.v));b.F=Date.now();lc(b);}Ld(a);}k.hb=function(a){try{this.h.info("Origin Trials invoked: "+a);}catch(b){}};function Ac$1(a){a.g&&(wc(a),a.g.cancel(),a.g=null);}
    function Jd(a){Ac$1(a);a.u&&(l.clearTimeout(a.u),a.u=null);zc(a);a.i.cancel();a.m&&("number"===typeof a.m&&l.clearTimeout(a.m),a.m=null);}function Md(a,b){a.l.push(new fd(a.Za++,b));3==a.G&&Hc(a);}function Hc(a){id(a.i)||a.m||(a.m=!0,zb(a.Ha,a),a.C=0);}function Nd(a,b){if(Cc$1(a.i)>=a.i.j-(a.m?1:0))return !1;if(a.m)return a.l=b.D.concat(a.l),!0;if(1==a.G||2==a.G||a.C>=(a.Xa?0:a.Ya))return !1;a.m=K(q(a.Ha,a,b),Od(a,a.C));a.C++;return !0}
    k.Ha=function(a){if(this.m)if(this.m=null,1==this.G){if(!a){this.V=Math.floor(1E5*Math.random());a=this.V++;const e=new M(this,this.h,a,void 0);let f=this.s;this.P&&(f?(f=ya(f),Aa(f,this.P)):f=this.P);null===this.o&&(e.H=f);if(this.ja)a:{var b=0;for(var c=0;c<this.l.length;c++){b:{var d=this.l[c];if("__data__"in d.g&&(d=d.g.__data__,"string"===typeof d)){d=d.length;break b}d=void 0;}if(void 0===d)break;b+=d;if(4096<b){b=c;break a}if(4096===b||c===this.l.length-1){b=c+1;break a}}b=1E3;}else b=1E3;b=
    Pd(this,e,b);c=N$1(this.F);R(c,"RID",a);R(c,"CVER",22);this.D&&R(c,"X-HTTP-Session-Id",this.D);Kd(this,c);this.o&&f&&Gd(c,this.o,f);Dc(this.i,e);this.Ra&&R(c,"TYPE","init");this.ja?(R(c,"$req",b),R(c,"SID","null"),e.$=!0,ic$1(e,c,null)):ic$1(e,c,b);this.G=2;}}else 3==this.G&&(a?Qd(this,a):0==this.l.length||id(this.i)||Qd(this));};
    function Qd(a,b){var c;b?c=b.m:c=a.V++;const d=N$1(a.F);R(d,"SID",a.J);R(d,"RID",c);R(d,"AID",a.U);Kd(a,d);a.o&&a.s&&Gd(d,a.o,a.s);c=new M(a,a.h,c,a.C+1);null===a.o&&(c.H=a.s);b&&(a.l=b.D.concat(a.l));b=Pd(a,c,1E3);c.setTimeout(Math.round(.5*a.ra)+Math.round(.5*a.ra*Math.random()));Dc(a.i,c);ic$1(c,d,b);}function Kd(a,b){a.j&&Kc({},function(c,d){R(b,d,c);});}
    function Pd(a,b,c){c=Math.min(a.l.length,c);var d=a.j?q(a.j.Oa,a.j,a):null;a:{var e=a.l;let f=-1;for(;;){const h=["count="+c];-1==f?0<c?(f=e[0].h,h.push("ofs="+f)):f=0:h.push("ofs="+f);let n=!0;for(let u=0;u<c;u++){let m=e[u].h;const r=e[u].g;m-=f;if(0>m)f=Math.max(0,e[u].h-100),n=!1;else try{md(r,h,"req"+m+"_");}catch(G){d&&d(r);}}if(n){d=h.join("&");break a}}}a=a.l.splice(0,c);b.D=a;return d}function Gc(a){a.g||a.u||(a.Y=1,zb(a.Ga,a),a.A=0);}
    function Bc(a){if(a.g||a.u||3<=a.A)return !1;a.Y++;a.u=K(q(a.Ga,a),Od(a,a.A));a.A++;return !0}k.Ga=function(){this.u=null;Rd(this);if(this.$&&!(this.L||null==this.g||0>=this.O)){var a=2*this.O;this.h.info("BP detection timer enabled: "+a);this.B=K(q(this.bb,this),a);}};k.bb=function(){this.B&&(this.B=null,this.h.info("BP detection timeout reached."),this.h.info("Buffering proxy detected and switch to long-polling!"),this.N=!1,this.L=!0,J$1(10),Ac$1(this),Rd(this));};
    function wc(a){null!=a.B&&(l.clearTimeout(a.B),a.B=null);}function Rd(a){a.g=new M(a,a.h,"rpc",a.Y);null===a.o&&(a.g.H=a.s);a.g.O=0;var b=N$1(a.oa);R(b,"RID","rpc");R(b,"SID",a.J);R(b,"CI",a.N?"0":"1");R(b,"AID",a.U);Kd(a,b);R(b,"TYPE","xmlhttp");a.o&&a.s&&Gd(b,a.o,a.s);a.K&&a.g.setTimeout(a.K);var c=a.g;a=a.la;c.K=1;c.v=jc(N$1(b));c.s=null;c.U=!0;kc(c,a);}k.ab=function(){null!=this.v&&(this.v=null,Ac$1(this),Bc(this),J$1(19));};function zc(a){null!=a.v&&(l.clearTimeout(a.v),a.v=null);}
    function uc(a,b){var c=null;if(a.g==b){zc(a);wc(a);a.g=null;var d=2;}else if(yc(a.i,b))c=b.D,Fc(a.i,b),d=1;else return;a.I=b.N;if(0!=a.G)if(b.i)if(1==d){c=b.s?b.s.length:0;b=Date.now()-b.F;var e=a.C;d=Sb();D$1(d,new Vb(d,c,b,e));Hc(a);}else Gc(a);else if(e=b.o,3==e||0==e&&0<a.I||!(1==d&&Nd(a,b)||2==d&&Bc(a)))switch(c&&0<c.length&&(b=a.i,b.i=b.i.concat(c)),e){case 1:Q$1(a,5);break;case 4:Q$1(a,10);break;case 3:Q$1(a,6);break;default:Q$1(a,2);}}
    function Od(a,b){let c=a.Pa+Math.floor(Math.random()*a.$a);a.j||(c*=2);return c*b}function Q$1(a,b){a.h.info("Error code "+b);if(2==b){var c=null;a.j&&(c=null);var d=q(a.jb,a);c||(c=new U$1("//www.google.com/images/cleardot.gif"),l.location&&"http"==l.location.protocol||Oc(c,"https"),jc(c));nd(c.toString(),d);}else J$1(2);a.G=0;a.j&&a.j.va(b);Ld(a);Jd(a);}k.jb=function(a){a?(this.h.info("Successfully pinged google.com"),J$1(2)):(this.h.info("Failed to ping google.com"),J$1(1));};
    function Ld(a){a.G=0;a.I=-1;if(a.j){if(0!=jd(a.i).length||0!=a.l.length)a.i.i.length=0,ra(a.l),a.l.length=0;a.j.ua();}}function Ec(a,b,c){let d=ad(c);if(""!=d.i)b&&Pc(d,b+"."+d.i),Qc(d,d.m);else {const e=l.location;d=bd(e.protocol,b?b+"."+e.hostname:e.hostname,+e.port,c);}a.aa&&xa(a.aa,function(e,f){R(d,f,e);});b=a.D;c=a.sa;b&&c&&R(d,b,c);R(d,"VER",a.ma);Kd(a,d);return d}
    function nc(a,b,c){if(b&&!a.H)throw Error("Can't create secondary domain capable XhrIo object.");b=c&&a.Ba&&!a.qa?new X$1(new pd({ib:!0})):new X$1(a.qa);b.L=a.H;return b}function Sd(){}k=Sd.prototype;k.xa=function(){};k.wa=function(){};k.va=function(){};k.ua=function(){};k.Oa=function(){};function Y$1(a,b){C$1.call(this);this.g=new Id(b);this.l=a;this.h=b&&b.messageUrlParams||null;a=b&&b.messageHeaders||null;b&&b.clientProtocolHeaderRequired&&(a?a["X-Client-Protocol"]="webchannel":a={"X-Client-Protocol":"webchannel"});this.g.s=a;a=b&&b.initMessageHeaders||null;b&&b.messageContentType&&(a?a["X-WebChannel-Content-Type"]=b.messageContentType:a={"X-WebChannel-Content-Type":b.messageContentType});b&&b.ya&&(a?a["X-WebChannel-Client-Profile"]=b.ya:a={"X-WebChannel-Client-Profile":b.ya});this.g.P=
    a;(a=b&&b.httpHeadersOverwriteParam)&&!sa(a)&&(this.g.o=a);this.A=b&&b.supportsCrossDomainXhr||!1;this.v=b&&b.sendRawJson||!1;(b=b&&b.httpSessionIdParam)&&!sa(b)&&(this.g.D=b,a=this.h,null!==a&&b in a&&(a=this.h,b in a&&delete a[b]));this.j=new Z$1(this);}t(Y$1,C$1);Y$1.prototype.m=function(){this.g.j=this.j;this.A&&(this.g.H=!0);var a=this.g,b=this.l,c=this.h||void 0;a.Wa&&(a.h.info("Origin Trials enabled."),zb(q(a.hb,a,b)));J$1(0);a.W=b;a.aa=c||{};a.N=a.X;a.F=Ec(a,null,a.W);Hc(a);};Y$1.prototype.close=function(){Ic(this.g);};
    Y$1.prototype.u=function(a){if("string"===typeof a){var b={};b.__data__=a;Md(this.g,b);}else this.v?(b={},b.__data__=rb(a),Md(this.g,b)):Md(this.g,a);};Y$1.prototype.M=function(){this.g.j=null;delete this.j;Ic(this.g);delete this.g;Y$1.Z.M.call(this);};function Ud(a){ac.call(this);var b=a.__sm__;if(b){a:{for(const c in b){a=c;break a}a=void 0;}if(this.i=a)a=this.i,b=null!==b&&a in b?b[a]:void 0;this.data=b;}else this.data=a;}t(Ud,ac);function Vd(){bc.call(this);this.status=1;}t(Vd,bc);function Z$1(a){this.g=a;}
    t(Z$1,Sd);Z$1.prototype.xa=function(){D$1(this.g,"a");};Z$1.prototype.wa=function(a){D$1(this.g,new Ud(a));};Z$1.prototype.va=function(a){D$1(this.g,new Vd(a));};Z$1.prototype.ua=function(){D$1(this.g,"b");};/*

     Copyright 2017 Google LLC

     Licensed under the Apache License, Version 2.0 (the "License");
     you may not use this file except in compliance with the License.
     You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

     Unless required by applicable law or agreed to in writing, software
     distributed under the License is distributed on an "AS IS" BASIS,
     WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     See the License for the specific language governing permissions and
     limitations under the License.
    */
    Y$1.prototype.send=Y$1.prototype.u;Y$1.prototype.open=Y$1.prototype.m;Y$1.prototype.close=Y$1.prototype.close;Wb.NO_ERROR=0;Wb.TIMEOUT=8;Wb.HTTP_ERROR=6;Xb.COMPLETE="complete";$b.EventType=L$1;L$1.OPEN="a";L$1.CLOSE="b";L$1.ERROR="c";L$1.MESSAGE="d";C$1.prototype.listen=C$1.prototype.N;X$1.prototype.listenOnce=X$1.prototype.O;X$1.prototype.getLastError=X$1.prototype.La;X$1.prototype.getLastErrorCode=X$1.prototype.Da;X$1.prototype.getStatus=X$1.prototype.ba;X$1.prototype.getResponseJson=X$1.prototype.Qa;
    X$1.prototype.getResponseText=X$1.prototype.ga;X$1.prototype.send=X$1.prototype.ea;

    const D = "@firebase/firestore";

    /**
     * @license
     * Copyright 2017 Google LLC
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
     * Simple wrapper around a nullable UID. Mostly exists to make code more
     * readable.
     */
    class C {
        constructor(t) {
            this.uid = t;
        }
        isAuthenticated() {
            return null != this.uid;
        }
        /**
         * Returns a key representing this user, suitable for inclusion in a
         * dictionary.
         */    toKey() {
            return this.isAuthenticated() ? "uid:" + this.uid : "anonymous-user";
        }
        isEqual(t) {
            return t.uid === this.uid;
        }
    }

    /** A user with a null UID. */ C.UNAUTHENTICATED = new C(null), 
    // TODO(mikelehen): Look into getting a proper uid-equivalent for
    // non-FirebaseAuth providers.
    C.GOOGLE_CREDENTIALS = new C("google-credentials-uid"), C.FIRST_PARTY = new C("first-party-uid"), 
    C.MOCK_USER = new C("mock-user");

    /**
     * @license
     * Copyright 2017 Google LLC
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
    let x = "9.8.0";

    /**
     * @license
     * Copyright 2017 Google LLC
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
    const N = new Logger("@firebase/firestore");

    function O(t, ...e) {
        if (N.logLevel <= LogLevel.DEBUG) {
            const n = e.map(B);
            N.debug(`Firestore (${x}): ${t}`, ...n);
        }
    }

    function F(t, ...e) {
        if (N.logLevel <= LogLevel.ERROR) {
            const n = e.map(B);
            N.error(`Firestore (${x}): ${t}`, ...n);
        }
    }

    /**
     * Converts an additional log parameter to a string representation.
     */ function B(t) {
        if ("string" == typeof t) return t;
        try {
            return e = t, JSON.stringify(e);
        } catch (e) {
            // Converting to JSON failed, just log the object directly
            return t;
        }
        /**
     * @license
     * Copyright 2020 Google LLC
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
        /** Formats an object as a JSON string, suitable for logging. */
        var e;
    }

    /**
     * @license
     * Copyright 2017 Google LLC
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
     * Unconditionally fails, throwing an Error with the given message.
     * Messages are stripped in production builds.
     *
     * Returns `never` and can be used in expressions:
     * @example
     * let futureVar = fail('not implemented yet');
     */ function L(t = "Unexpected state") {
        // Log the failure in addition to throw an exception, just in case the
        // exception is swallowed.
        const e = `FIRESTORE (${x}) INTERNAL ASSERTION FAILED: ` + t;
        // NOTE: We don't use FirestoreError here because these are internal failures
        // that cannot be handled by the user. (Also it would create a circular
        // dependency between the error and assert modules which doesn't work.)
        throw F(e), new Error(e);
    }

    /**
     * Fails if the given assertion condition is false, throwing an Error with the
     * given message if it did.
     *
     * Messages are stripped in production builds.
     */ function U(t, e) {
        t || L();
    }

    /**
     * @license
     * Copyright 2017 Google LLC
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
     */ const G = {
        // Causes are copied from:
        // https://github.com/grpc/grpc/blob/bceec94ea4fc5f0085d81235d8e1c06798dc341a/include/grpc%2B%2B/impl/codegen/status_code_enum.h
        /** Not an error; returned on success. */
        OK: "ok",
        /** The operation was cancelled (typically by the caller). */
        CANCELLED: "cancelled",
        /** Unknown error or an error from a different error domain. */
        UNKNOWN: "unknown",
        /**
         * Client specified an invalid argument. Note that this differs from
         * FAILED_PRECONDITION. INVALID_ARGUMENT indicates arguments that are
         * problematic regardless of the state of the system (e.g., a malformed file
         * name).
         */
        INVALID_ARGUMENT: "invalid-argument",
        /**
         * Deadline expired before operation could complete. For operations that
         * change the state of the system, this error may be returned even if the
         * operation has completed successfully. For example, a successful response
         * from a server could have been delayed long enough for the deadline to
         * expire.
         */
        DEADLINE_EXCEEDED: "deadline-exceeded",
        /** Some requested entity (e.g., file or directory) was not found. */
        NOT_FOUND: "not-found",
        /**
         * Some entity that we attempted to create (e.g., file or directory) already
         * exists.
         */
        ALREADY_EXISTS: "already-exists",
        /**
         * The caller does not have permission to execute the specified operation.
         * PERMISSION_DENIED must not be used for rejections caused by exhausting
         * some resource (use RESOURCE_EXHAUSTED instead for those errors).
         * PERMISSION_DENIED must not be used if the caller can not be identified
         * (use UNAUTHENTICATED instead for those errors).
         */
        PERMISSION_DENIED: "permission-denied",
        /**
         * The request does not have valid authentication credentials for the
         * operation.
         */
        UNAUTHENTICATED: "unauthenticated",
        /**
         * Some resource has been exhausted, perhaps a per-user quota, or perhaps the
         * entire file system is out of space.
         */
        RESOURCE_EXHAUSTED: "resource-exhausted",
        /**
         * Operation was rejected because the system is not in a state required for
         * the operation's execution. For example, directory to be deleted may be
         * non-empty, an rmdir operation is applied to a non-directory, etc.
         *
         * A litmus test that may help a service implementor in deciding
         * between FAILED_PRECONDITION, ABORTED, and UNAVAILABLE:
         *  (a) Use UNAVAILABLE if the client can retry just the failing call.
         *  (b) Use ABORTED if the client should retry at a higher-level
         *      (e.g., restarting a read-modify-write sequence).
         *  (c) Use FAILED_PRECONDITION if the client should not retry until
         *      the system state has been explicitly fixed. E.g., if an "rmdir"
         *      fails because the directory is non-empty, FAILED_PRECONDITION
         *      should be returned since the client should not retry unless
         *      they have first fixed up the directory by deleting files from it.
         *  (d) Use FAILED_PRECONDITION if the client performs conditional
         *      REST Get/Update/Delete on a resource and the resource on the
         *      server does not match the condition. E.g., conflicting
         *      read-modify-write on the same resource.
         */
        FAILED_PRECONDITION: "failed-precondition",
        /**
         * The operation was aborted, typically due to a concurrency issue like
         * sequencer check failures, transaction aborts, etc.
         *
         * See litmus test above for deciding between FAILED_PRECONDITION, ABORTED,
         * and UNAVAILABLE.
         */
        ABORTED: "aborted",
        /**
         * Operation was attempted past the valid range. E.g., seeking or reading
         * past end of file.
         *
         * Unlike INVALID_ARGUMENT, this error indicates a problem that may be fixed
         * if the system state changes. For example, a 32-bit file system will
         * generate INVALID_ARGUMENT if asked to read at an offset that is not in the
         * range [0,2^32-1], but it will generate OUT_OF_RANGE if asked to read from
         * an offset past the current file size.
         *
         * There is a fair bit of overlap between FAILED_PRECONDITION and
         * OUT_OF_RANGE. We recommend using OUT_OF_RANGE (the more specific error)
         * when it applies so that callers who are iterating through a space can
         * easily look for an OUT_OF_RANGE error to detect when they are done.
         */
        OUT_OF_RANGE: "out-of-range",
        /** Operation is not implemented or not supported/enabled in this service. */
        UNIMPLEMENTED: "unimplemented",
        /**
         * Internal errors. Means some invariants expected by underlying System has
         * been broken. If you see one of these errors, Something is very broken.
         */
        INTERNAL: "internal",
        /**
         * The service is currently unavailable. This is a most likely a transient
         * condition and may be corrected by retrying with a backoff.
         *
         * See litmus test above for deciding between FAILED_PRECONDITION, ABORTED,
         * and UNAVAILABLE.
         */
        UNAVAILABLE: "unavailable",
        /** Unrecoverable data loss or corruption. */
        DATA_LOSS: "data-loss"
    };

    /** An error returned by a Firestore operation. */ class Q extends FirebaseError {
        /** @hideconstructor */
        constructor(
        /**
         * The backend error code associated with this error.
         */
        t, 
        /**
         * A custom error description.
         */
        e) {
            super(t, e), this.code = t, this.message = e, 
            // HACK: We write a toString property directly because Error is not a real
            // class and so inheritance does not work correctly. We could alternatively
            // do the same "back-door inheritance" trick that FirebaseError does.
            this.toString = () => `${this.name}: [code=${this.code}]: ${this.message}`;
        }
    }

    /**
     * @license
     * Copyright 2017 Google LLC
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
     */ class j {
        constructor() {
            this.promise = new Promise(((t, e) => {
                this.resolve = t, this.reject = e;
            }));
        }
    }

    /**
     * @license
     * Copyright 2017 Google LLC
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
     */ class W {
        constructor(t, e) {
            this.user = e, this.type = "OAuth", this.headers = new Map, this.headers.set("Authorization", `Bearer ${t}`);
        }
    }

    /**
     * A CredentialsProvider that always yields an empty token.
     * @internal
     */ class z {
        getToken() {
            return Promise.resolve(null);
        }
        invalidateToken() {}
        start(t, e) {
            // Fire with initial user.
            t.enqueueRetryable((() => e(C.UNAUTHENTICATED)));
        }
        shutdown() {}
    }

    class J {
        constructor(t) {
            this.t = t, 
            /** Tracks the current User. */
            this.currentUser = C.UNAUTHENTICATED, 
            /**
             * Counter used to detect if the token changed while a getToken request was
             * outstanding.
             */
            this.i = 0, this.forceRefresh = !1, this.auth = null;
        }
        start(t, e) {
            let n = this.i;
            // A change listener that prevents double-firing for the same token change.
                    const s = t => this.i !== n ? (n = this.i, e(t)) : Promise.resolve();
            // A promise that can be waited on to block on the next token change.
            // This promise is re-created after each change.
                    let i = new j;
            this.o = () => {
                this.i++, this.currentUser = this.u(), i.resolve(), i = new j, t.enqueueRetryable((() => s(this.currentUser)));
            };
            const r = () => {
                const e = i;
                t.enqueueRetryable((async () => {
                    await e.promise, await s(this.currentUser);
                }));
            }, o = t => {
                O("FirebaseAuthCredentialsProvider", "Auth detected"), this.auth = t, this.auth.addAuthTokenListener(this.o), 
                r();
            };
            this.t.onInit((t => o(t))), 
            // Our users can initialize Auth right after Firestore, so we give it
            // a chance to register itself with the component framework before we
            // determine whether to start up in unauthenticated mode.
            setTimeout((() => {
                if (!this.auth) {
                    const t = this.t.getImmediate({
                        optional: !0
                    });
                    t ? o(t) : (
                    // If auth is still not available, proceed with `null` user
                    O("FirebaseAuthCredentialsProvider", "Auth not yet detected"), i.resolve(), i = new j);
                }
            }), 0), r();
        }
        getToken() {
            // Take note of the current value of the tokenCounter so that this method
            // can fail (with an ABORTED error) if there is a token change while the
            // request is outstanding.
            const t = this.i, e = this.forceRefresh;
            return this.forceRefresh = !1, this.auth ? this.auth.getToken(e).then((e => 
            // Cancel the request since the token changed while the request was
            // outstanding so the response is potentially for a previous user (which
            // user, we can't be sure).
            this.i !== t ? (O("FirebaseAuthCredentialsProvider", "getToken aborted due to token change."), 
            this.getToken()) : e ? (U("string" == typeof e.accessToken), new W(e.accessToken, this.currentUser)) : null)) : Promise.resolve(null);
        }
        invalidateToken() {
            this.forceRefresh = !0;
        }
        shutdown() {
            this.auth && this.auth.removeAuthTokenListener(this.o);
        }
        // Auth.getUid() can return null even with a user logged in. It is because
        // getUid() is synchronous, but the auth code populating Uid is asynchronous.
        // This method should only be called in the AuthTokenListener callback
        // to guarantee to get the actual user.
        u() {
            const t = this.auth && this.auth.getUid();
            return U(null === t || "string" == typeof t), new C(t);
        }
    }

    /*
     * FirstPartyToken provides a fresh token each time its value
     * is requested, because if the token is too old, requests will be rejected.
     * Technically this may no longer be necessary since the SDK should gracefully
     * recover from unauthenticated errors (see b/33147818 for context), but it's
     * safer to keep the implementation as-is.
     */ class Y {
        constructor(t, e, n) {
            this.type = "FirstParty", this.user = C.FIRST_PARTY, this.headers = new Map, this.headers.set("X-Goog-AuthUser", e);
            const s = t.auth.getAuthHeaderValueForFirstParty([]);
            s && this.headers.set("Authorization", s), n && this.headers.set("X-Goog-Iam-Authorization-Token", n);
        }
    }

    /*
     * Provides user credentials required for the Firestore JavaScript SDK
     * to authenticate the user, using technique that is only available
     * to applications hosted by Google.
     */ class X {
        constructor(t, e, n) {
            this.h = t, this.l = e, this.m = n;
        }
        getToken() {
            return Promise.resolve(new Y(this.h, this.l, this.m));
        }
        start(t, e) {
            // Fire with initial uid.
            t.enqueueRetryable((() => e(C.FIRST_PARTY)));
        }
        shutdown() {}
        invalidateToken() {}
    }

    class Z {
        constructor(t) {
            this.value = t, this.type = "AppCheck", this.headers = new Map, t && t.length > 0 && this.headers.set("x-firebase-appcheck", this.value);
        }
    }

    class tt {
        constructor(t) {
            this.g = t, this.forceRefresh = !1, this.appCheck = null, this.p = null;
        }
        start(t, e) {
            const n = t => {
                null != t.error && O("FirebaseAppCheckTokenProvider", `Error getting App Check token; using placeholder token instead. Error: ${t.error.message}`);
                const n = t.token !== this.p;
                return this.p = t.token, O("FirebaseAppCheckTokenProvider", `Received ${n ? "new" : "existing"} token.`), 
                n ? e(t.token) : Promise.resolve();
            };
            this.o = e => {
                t.enqueueRetryable((() => n(e)));
            };
            const s = t => {
                O("FirebaseAppCheckTokenProvider", "AppCheck detected"), this.appCheck = t, this.appCheck.addTokenListener(this.o);
            };
            this.g.onInit((t => s(t))), 
            // Our users can initialize AppCheck after Firestore, so we give it
            // a chance to register itself with the component framework.
            setTimeout((() => {
                if (!this.appCheck) {
                    const t = this.g.getImmediate({
                        optional: !0
                    });
                    t ? s(t) : 
                    // If AppCheck is still not available, proceed without it.
                    O("FirebaseAppCheckTokenProvider", "AppCheck not yet detected");
                }
            }), 0);
        }
        getToken() {
            const t = this.forceRefresh;
            return this.forceRefresh = !1, this.appCheck ? this.appCheck.getToken(t).then((t => t ? (U("string" == typeof t.token), 
            this.p = t.token, new Z(t.token)) : null)) : Promise.resolve(null);
        }
        invalidateToken() {
            this.forceRefresh = !0;
        }
        shutdown() {
            this.appCheck && this.appCheck.removeTokenListener(this.o);
        }
    }

    /**
     * @license
     * Copyright 2020 Google LLC
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
     * Generates `nBytes` of random bytes.
     *
     * If `nBytes < 0` , an error will be thrown.
     */
    function st(t) {
        // Polyfills for IE and WebWorker by using `self` and `msCrypto` when `crypto` is not available.
        const e = 
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        "undefined" != typeof self && (self.crypto || self.msCrypto), n = new Uint8Array(t);
        if (e && "function" == typeof e.getRandomValues) e.getRandomValues(n); else 
        // Falls back to Math.random
        for (let e = 0; e < t; e++) n[e] = Math.floor(256 * Math.random());
        return n;
    }

    class it {
        static R() {
            // Alphanumeric characters
            const t = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789", e = Math.floor(256 / t.length) * t.length;
            // The largest byte value that is a multiple of `char.length`.
                    let n = "";
            for (;n.length < 20; ) {
                const s = st(40);
                for (let i = 0; i < s.length; ++i) 
                // Only accept values that are [0, maxMultiple), this ensures they can
                // be evenly mapped to indices of `chars` via a modulo operation.
                n.length < 20 && s[i] < e && (n += t.charAt(s[i] % t.length));
            }
            return n;
        }
    }

    /**
     * @license
     * Copyright 2017 Google LLC
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
     */ class Vt {
        /**
         * Constructs a DatabaseInfo using the provided host, databaseId and
         * persistenceKey.
         *
         * @param databaseId - The database to use.
         * @param appId - The Firebase App Id.
         * @param persistenceKey - A unique identifier for this Firestore's local
         * storage (used in conjunction with the databaseId).
         * @param host - The Firestore backend host to connect to.
         * @param ssl - Whether to use SSL when connecting.
         * @param forceLongPolling - Whether to use the forceLongPolling option
         * when using WebChannel as the network transport.
         * @param autoDetectLongPolling - Whether to use the detectBufferingProxy
         * option when using WebChannel as the network transport.
         * @param useFetchStreams Whether to use the Fetch API instead of
         * XMLHTTPRequest
         */
        constructor(t, e, n, s, i, r, o, u) {
            this.databaseId = t, this.appId = e, this.persistenceKey = n, this.host = s, this.ssl = i, 
            this.forceLongPolling = r, this.autoDetectLongPolling = o, this.useFetchStreams = u;
        }
    }

    /** The default database name for a project. */
    /**
     * Represents the database ID a Firestore client is associated with.
     * @internal
     */
    class vt {
        constructor(t, e) {
            this.projectId = t, this.database = e || "(default)";
        }
        static empty() {
            return new vt("", "");
        }
        get isDefaultDatabase() {
            return "(default)" === this.database;
        }
        isEqual(t) {
            return t instanceof vt && t.projectId === this.projectId && t.database === this.database;
        }
    }

    /**
     * @license
     * Copyright 2017 Google LLC
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
     * Error Codes describing the different ways GRPC can fail. These are copied
     * directly from GRPC's sources here:
     *
     * https://github.com/grpc/grpc/blob/bceec94ea4fc5f0085d81235d8e1c06798dc341a/include/grpc%2B%2B/impl/codegen/status_code_enum.h
     *
     * Important! The names of these identifiers matter because the string forms
     * are used for reverse lookups from the webchannel stream. Do NOT change the
     * names of these identifiers or change this into a const enum.
     */ var Bn, Ln;

    /**
     * Converts an HTTP response's error status to the equivalent error code.
     *
     * @param status - An HTTP error response status ("FAILED_PRECONDITION",
     * "UNKNOWN", etc.)
     * @returns The equivalent Code. Non-matching responses are mapped to
     *     Code.UNKNOWN.
     */ (Ln = Bn || (Bn = {}))[Ln.OK = 0] = "OK", Ln[Ln.CANCELLED = 1] = "CANCELLED", 
    Ln[Ln.UNKNOWN = 2] = "UNKNOWN", Ln[Ln.INVALID_ARGUMENT = 3] = "INVALID_ARGUMENT", 
    Ln[Ln.DEADLINE_EXCEEDED = 4] = "DEADLINE_EXCEEDED", Ln[Ln.NOT_FOUND = 5] = "NOT_FOUND", 
    Ln[Ln.ALREADY_EXISTS = 6] = "ALREADY_EXISTS", Ln[Ln.PERMISSION_DENIED = 7] = "PERMISSION_DENIED", 
    Ln[Ln.UNAUTHENTICATED = 16] = "UNAUTHENTICATED", Ln[Ln.RESOURCE_EXHAUSTED = 8] = "RESOURCE_EXHAUSTED", 
    Ln[Ln.FAILED_PRECONDITION = 9] = "FAILED_PRECONDITION", Ln[Ln.ABORTED = 10] = "ABORTED", 
    Ln[Ln.OUT_OF_RANGE = 11] = "OUT_OF_RANGE", Ln[Ln.UNIMPLEMENTED = 12] = "UNIMPLEMENTED", 
    Ln[Ln.INTERNAL = 13] = "INTERNAL", Ln[Ln.UNAVAILABLE = 14] = "UNAVAILABLE", Ln[Ln.DATA_LOSS = 15] = "DATA_LOSS";

    /** Verifies whether `e` is an IndexedDbTransactionError. */ function Ai(t) {
        // Use name equality, as instanceof checks on errors don't work with errors
        // that wrap other errors.
        return "IndexedDbTransactionError" === t.name;
    }

    /** The Platform's 'document' implementation or null if not available. */ function Qo() {
        // `document` is not always available, e.g. in ReactNative and WebWorkers.
        // eslint-disable-next-line no-restricted-globals
        return "undefined" != typeof document ? document : null;
    }

    /**
     * An instance of the Platform's 'TextEncoder' implementation.
     */
    /**
     * A helper for running delayed tasks following an exponential backoff curve
     * between attempts.
     *
     * Each delay is made up of a "base" delay which follows the exponential
     * backoff curve, and a +/- 50% "jitter" that is calculated and added to the
     * base delay. This prevents clients from accidentally synchronizing their
     * delays causing spikes of load to the backend.
     */
    class Wo {
        constructor(
        /**
         * The AsyncQueue to run backoff operations on.
         */
        t, 
        /**
         * The ID to use when scheduling backoff operations on the AsyncQueue.
         */
        e, 
        /**
         * The initial delay (used as the base delay on the first retry attempt).
         * Note that jitter will still be applied, so the actual delay could be as
         * little as 0.5*initialDelayMs.
         */
        n = 1e3
        /**
         * The multiplier to use to determine the extended base delay after each
         * attempt.
         */ , s = 1.5
        /**
         * The maximum base delay after which no further backoff is performed.
         * Note that jitter will still be applied, so the actual delay could be as
         * much as 1.5*maxDelayMs.
         */ , i = 6e4) {
            this.Yn = t, this.timerId = e, this.mo = n, this.yo = s, this.po = i, this.Io = 0, 
            this.To = null, 
            /** The last backoff attempt, as epoch milliseconds. */
            this.Eo = Date.now(), this.reset();
        }
        /**
         * Resets the backoff delay.
         *
         * The very next backoffAndWait() will have no delay. If it is called again
         * (i.e. due to an error), initialDelayMs (plus jitter) will be used, and
         * subsequent ones will increase according to the backoffFactor.
         */    reset() {
            this.Io = 0;
        }
        /**
         * Resets the backoff delay to the maximum delay (e.g. for use after a
         * RESOURCE_EXHAUSTED error).
         */    Ao() {
            this.Io = this.po;
        }
        /**
         * Returns a promise that resolves after currentDelayMs, and increases the
         * delay for any subsequent attempts. If there was a pending backoff operation
         * already, it will be canceled.
         */    Ro(t) {
            // Cancel any pending backoff operation.
            this.cancel();
            // First schedule using the current base (which may be 0 and should be
            // honored as such).
            const e = Math.floor(this.Io + this.bo()), n = Math.max(0, Date.now() - this.Eo), s = Math.max(0, e - n);
            // Guard against lastAttemptTime being in the future due to a clock change.
                    s > 0 && O("ExponentialBackoff", `Backing off for ${s} ms (base delay: ${this.Io} ms, delay with jitter: ${e} ms, last attempt: ${n} ms ago)`), 
            this.To = this.Yn.enqueueAfterDelay(this.timerId, s, (() => (this.Eo = Date.now(), 
            t()))), 
            // Apply backoff factor to determine next delay and ensure it is within
            // bounds.
            this.Io *= this.yo, this.Io < this.mo && (this.Io = this.mo), this.Io > this.po && (this.Io = this.po);
        }
        Po() {
            null !== this.To && (this.To.skipDelay(), this.To = null);
        }
        cancel() {
            null !== this.To && (this.To.cancel(), this.To = null);
        }
        /** Returns a random value in the range [-currentBaseMs/2, currentBaseMs/2] */    bo() {
            return (Math.random() - .5) * this.Io;
        }
    }

    /**
     * @license
     * Copyright 2017 Google LLC
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
     * Represents an operation scheduled to be run in the future on an AsyncQueue.
     *
     * It is created via DelayedOperation.createAndSchedule().
     *
     * Supports cancellation (via cancel()) and early execution (via skipDelay()).
     *
     * Note: We implement `PromiseLike` instead of `Promise`, as the `Promise` type
     * in newer versions of TypeScript defines `finally`, which is not available in
     * IE.
     */
    class vu {
        constructor(t, e, n, s, i) {
            this.asyncQueue = t, this.timerId = e, this.targetTimeMs = n, this.op = s, this.removalCallback = i, 
            this.deferred = new j, this.then = this.deferred.promise.then.bind(this.deferred.promise), 
            // It's normal for the deferred promise to be canceled (due to cancellation)
            // and so we attach a dummy catch callback to avoid
            // 'UnhandledPromiseRejectionWarning' log spam.
            this.deferred.promise.catch((t => {}));
        }
        /**
         * Creates and returns a DelayedOperation that has been scheduled to be
         * executed on the provided asyncQueue after the provided delayMs.
         *
         * @param asyncQueue - The queue to schedule the operation on.
         * @param id - A Timer ID identifying the type of operation this is.
         * @param delayMs - The delay (ms) before the operation should be scheduled.
         * @param op - The operation to run.
         * @param removalCallback - A callback to be called synchronously once the
         *   operation is executed or canceled, notifying the AsyncQueue to remove it
         *   from its delayedOperations list.
         *   PORTING NOTE: This exists to prevent making removeDelayedOperation() and
         *   the DelayedOperation class public.
         */    static createAndSchedule(t, e, n, s, i) {
            const r = Date.now() + n, o = new vu(t, e, r, s, i);
            return o.start(n), o;
        }
        /**
         * Starts the timer. This is called immediately after construction by
         * createAndSchedule().
         */    start(t) {
            this.timerHandle = setTimeout((() => this.handleDelayElapsed()), t);
        }
        /**
         * Queues the operation to run immediately (if it hasn't already been run or
         * canceled).
         */    skipDelay() {
            return this.handleDelayElapsed();
        }
        /**
         * Cancels the operation if it hasn't already been executed or canceled. The
         * promise will be rejected.
         *
         * As long as the operation has not yet been run, calling cancel() provides a
         * guarantee that the operation will not be run.
         */    cancel(t) {
            null !== this.timerHandle && (this.clearTimeout(), this.deferred.reject(new Q(G.CANCELLED, "Operation cancelled" + (t ? ": " + t : ""))));
        }
        handleDelayElapsed() {
            this.asyncQueue.enqueueAndForget((() => null !== this.timerHandle ? (this.clearTimeout(), 
            this.op().then((t => this.deferred.resolve(t)))) : Promise.resolve()));
        }
        clearTimeout() {
            null !== this.timerHandle && (this.removalCallback(this), clearTimeout(this.timerHandle), 
            this.timerHandle = null);
        }
    }

    /**
     * Returns a FirestoreError that can be surfaced to the user if the provided
     * error is an IndexedDbTransactionError. Re-throws the error otherwise.
     */ function Su(t, e) {
        if (F("AsyncQueue", `${e}: ${t}`), Ai(t)) return new Q(G.UNAVAILABLE, `${e}: ${t}`);
        throw t;
    }

    /**
     * @license
     * Copyright 2017 Google LLC
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
     * FirestoreClient is a top-level class that constructs and owns all of the
     * pieces of the client SDK architecture. It is responsible for creating the
     * async queue that is shared by all of the other components in the system.
     */
    class $a {
        constructor(t, e, 
        /**
         * Asynchronous queue responsible for all of our internal processing. When
         * we get incoming work from the user (via public API) or the network
         * (incoming GRPC messages), we should always schedule onto this queue.
         * This ensures all of our work is properly serialized (e.g. we don't
         * start processing a new operation while the previous one is waiting for
         * an async I/O to complete).
         */
        n, s) {
            this.authCredentials = t, this.appCheckCredentials = e, this.asyncQueue = n, this.databaseInfo = s, 
            this.user = C.UNAUTHENTICATED, this.clientId = it.R(), this.authCredentialListener = () => Promise.resolve(), 
            this.appCheckCredentialListener = () => Promise.resolve(), this.authCredentials.start(n, (async t => {
                O("FirestoreClient", "Received user=", t.uid), await this.authCredentialListener(t), 
                this.user = t;
            })), this.appCheckCredentials.start(n, (t => (O("FirestoreClient", "Received new app check token=", t), 
            this.appCheckCredentialListener(t, this.user))));
        }
        async getConfiguration() {
            return {
                asyncQueue: this.asyncQueue,
                databaseInfo: this.databaseInfo,
                clientId: this.clientId,
                authCredentials: this.authCredentials,
                appCheckCredentials: this.appCheckCredentials,
                initialUser: this.user,
                maxConcurrentLimboResolutions: 100
            };
        }
        setCredentialChangeListener(t) {
            this.authCredentialListener = t;
        }
        setAppCheckTokenChangeListener(t) {
            this.appCheckCredentialListener = t;
        }
        /**
         * Checks that the client has not been terminated. Ensures that other methods on
         * this class cannot be called after the client is terminated.
         */    verifyNotTerminated() {
            if (this.asyncQueue.isShuttingDown) throw new Q(G.FAILED_PRECONDITION, "The client has already been terminated.");
        }
        terminate() {
            this.asyncQueue.enterRestrictedMode();
            const t = new j;
            return this.asyncQueue.enqueueAndForgetEvenWhileRestricted((async () => {
                try {
                    this.onlineComponents && await this.onlineComponents.terminate(), this.offlineComponents && await this.offlineComponents.terminate(), 
                    // The credentials provider must be terminated after shutting down the
                    // RemoteStore as it will prevent the RemoteStore from retrieving auth
                    // tokens.
                    this.authCredentials.shutdown(), this.appCheckCredentials.shutdown(), t.resolve();
                } catch (e) {
                    const n = Su(e, "Failed to shutdown persistence");
                    t.reject(n);
                }
            })), t.promise;
        }
    }

    const ic = new Map;

    /**
     * Validates that two boolean options are not set at the same time.
     * @internal
     */ function oc(t, e, n, s) {
        if (!0 === e && !0 === s) throw new Q(G.INVALID_ARGUMENT, `${t} and ${n} cannot be used together.`);
    }

    /**
     * @license
     * Copyright 2020 Google LLC
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
    // settings() defaults:
    /**
     * A concrete type describing all the values that can be applied via a
     * user-supplied `FirestoreSettings` object. This is a separate type so that
     * defaults can be supplied and the value can be checked for equality.
     */
    class fc {
        constructor(t) {
            var e;
            if (void 0 === t.host) {
                if (void 0 !== t.ssl) throw new Q(G.INVALID_ARGUMENT, "Can't provide ssl option if host option is not set");
                this.host = "firestore.googleapis.com", this.ssl = true;
            } else this.host = t.host, this.ssl = null === (e = t.ssl) || void 0 === e || e;
            if (this.credentials = t.credentials, this.ignoreUndefinedProperties = !!t.ignoreUndefinedProperties, 
            void 0 === t.cacheSizeBytes) this.cacheSizeBytes = 41943040; else {
                if (-1 !== t.cacheSizeBytes && t.cacheSizeBytes < 1048576) throw new Q(G.INVALID_ARGUMENT, "cacheSizeBytes must be at least 1048576");
                this.cacheSizeBytes = t.cacheSizeBytes;
            }
            this.experimentalForceLongPolling = !!t.experimentalForceLongPolling, this.experimentalAutoDetectLongPolling = !!t.experimentalAutoDetectLongPolling, 
            this.useFetchStreams = !!t.useFetchStreams, oc("experimentalForceLongPolling", t.experimentalForceLongPolling, "experimentalAutoDetectLongPolling", t.experimentalAutoDetectLongPolling);
        }
        isEqual(t) {
            return this.host === t.host && this.ssl === t.ssl && this.credentials === t.credentials && this.cacheSizeBytes === t.cacheSizeBytes && this.experimentalForceLongPolling === t.experimentalForceLongPolling && this.experimentalAutoDetectLongPolling === t.experimentalAutoDetectLongPolling && this.ignoreUndefinedProperties === t.ignoreUndefinedProperties && this.useFetchStreams === t.useFetchStreams;
        }
    }

    /**
     * @license
     * Copyright 2020 Google LLC
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
     * The Cloud Firestore service interface.
     *
     * Do not call this constructor directly. Instead, use {@link getFirestore}.
     */ class dc {
        /** @hideconstructor */
        constructor(t, e, n) {
            this._authCredentials = e, this._appCheckCredentials = n, 
            /**
             * Whether it's a Firestore or Firestore Lite instance.
             */
            this.type = "firestore-lite", this._persistenceKey = "(lite)", this._settings = new fc({}), 
            this._settingsFrozen = !1, t instanceof vt ? this._databaseId = t : (this._app = t, 
            this._databaseId = function(t) {
                if (!Object.prototype.hasOwnProperty.apply(t.options, [ "projectId" ])) throw new Q(G.INVALID_ARGUMENT, '"projectId" not provided in firebase.initializeApp.');
                return new vt(t.options.projectId);
            }
            /**
     * Modify this instance to communicate with the Cloud Firestore emulator.
     *
     * Note: This must be called before this instance has been used to do any
     * operations.
     *
     * @param firestore - The `Firestore` instance to configure to connect to the
     * emulator.
     * @param host - the emulator host (ex: localhost).
     * @param port - the emulator port (ex: 9000).
     * @param options.mockUserToken - the mock auth token to use for unit testing
     * Security Rules.
     */ (t));
        }
        /**
         * The {@link @firebase/app#FirebaseApp} associated with this `Firestore` service
         * instance.
         */    get app() {
            if (!this._app) throw new Q(G.FAILED_PRECONDITION, "Firestore was not initialized using the Firebase SDK. 'app' is not available");
            return this._app;
        }
        get _initialized() {
            return this._settingsFrozen;
        }
        get _terminated() {
            return void 0 !== this._terminateTask;
        }
        _setSettings(t) {
            if (this._settingsFrozen) throw new Q(G.FAILED_PRECONDITION, "Firestore has already been started and its settings can no longer be changed. You can only modify settings before calling any other methods on a Firestore object.");
            this._settings = new fc(t), void 0 !== t.credentials && (this._authCredentials = function(t) {
                if (!t) return new z;
                switch (t.type) {
                  case "gapi":
                    const e = t.client;
                    // Make sure this really is a Gapi client.
                                    return U(!("object" != typeof e || null === e || !e.auth || !e.auth.getAuthHeaderValueForFirstParty)), 
                    new X(e, t.sessionIndex || "0", t.iamToken || null);

                  case "provider":
                    return t.client;

                  default:
                    throw new Q(G.INVALID_ARGUMENT, "makeAuthCredentialsProvider failed due to invalid credential type");
                }
            }(t.credentials));
        }
        _getSettings() {
            return this._settings;
        }
        _freezeSettings() {
            return this._settingsFrozen = !0, this._settings;
        }
        _delete() {
            return this._terminateTask || (this._terminateTask = this._terminate()), this._terminateTask;
        }
        /** Returns a JSON-serializable representation of this `Firestore` instance. */    toJSON() {
            return {
                app: this._app,
                databaseId: this._databaseId,
                settings: this._settings
            };
        }
        /**
         * Terminates all components used by this client. Subclasses can override
         * this method to clean up their own dependencies, but must also call this
         * method.
         *
         * Only ever called once.
         */    _terminate() {
            /**
     * Removes all components associated with the provided instance. Must be called
     * when the `Firestore` instance is terminated.
     */
            return function(t) {
                const e = ic.get(t);
                e && (O("ComponentProvider", "Removing Datastore"), ic.delete(t), e.terminate());
            }(this), Promise.resolve();
        }
    }

    /**
     * @license
     * Copyright 2020 Google LLC
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
     */ class Ac {
        constructor() {
            // The last promise in the queue.
            this.Fa = Promise.resolve(), 
            // A list of retryable operations. Retryable operations are run in order and
            // retried with backoff.
            this.$a = [], 
            // Is this AsyncQueue being shut down? Once it is set to true, it will not
            // be changed again.
            this.Ba = !1, 
            // Operations scheduled to be queued in the future. Operations are
            // automatically removed after they are run or canceled.
            this.La = [], 
            // visible for testing
            this.Ua = null, 
            // Flag set while there's an outstanding AsyncQueue operation, used for
            // assertion sanity-checks.
            this.qa = !1, 
            // Enabled during shutdown on Safari to prevent future access to IndexedDB.
            this.Ka = !1, 
            // List of TimerIds to fast-forward delays for.
            this.Ga = [], 
            // Backoff timer used to schedule retries for retryable operations
            this.No = new Wo(this, "async_queue_retry" /* AsyncQueueRetry */), 
            // Visibility handler that triggers an immediate retry of all retryable
            // operations. Meant to speed up recovery when we regain file system access
            // after page comes into foreground.
            this.Qa = () => {
                const t = Qo();
                t && O("AsyncQueue", "Visibility state changed to " + t.visibilityState), this.No.Po();
            };
            const t = Qo();
            t && "function" == typeof t.addEventListener && t.addEventListener("visibilitychange", this.Qa);
        }
        get isShuttingDown() {
            return this.Ba;
        }
        /**
         * Adds a new operation to the queue without waiting for it to complete (i.e.
         * we ignore the Promise result).
         */    enqueueAndForget(t) {
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            this.enqueue(t);
        }
        enqueueAndForgetEvenWhileRestricted(t) {
            this.ja(), 
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            this.Wa(t);
        }
        enterRestrictedMode(t) {
            if (!this.Ba) {
                this.Ba = !0, this.Ka = t || !1;
                const e = Qo();
                e && "function" == typeof e.removeEventListener && e.removeEventListener("visibilitychange", this.Qa);
            }
        }
        enqueue(t) {
            if (this.ja(), this.Ba) 
            // Return a Promise which never resolves.
            return new Promise((() => {}));
            // Create a deferred Promise that we can return to the callee. This
            // allows us to return a "hanging Promise" only to the callee and still
            // advance the queue even when the operation is not run.
                    const e = new j;
            return this.Wa((() => this.Ba && this.Ka ? Promise.resolve() : (t().then(e.resolve, e.reject), 
            e.promise))).then((() => e.promise));
        }
        enqueueRetryable(t) {
            this.enqueueAndForget((() => (this.$a.push(t), this.za())));
        }
        /**
         * Runs the next operation from the retryable queue. If the operation fails,
         * reschedules with backoff.
         */    async za() {
            if (0 !== this.$a.length) {
                try {
                    await this.$a[0](), this.$a.shift(), this.No.reset();
                } catch (t) {
                    if (!Ai(t)) throw t;
     // Failure will be handled by AsyncQueue
                                    O("AsyncQueue", "Operation failed with retryable error: " + t);
                }
                this.$a.length > 0 && 
                // If there are additional operations, we re-schedule `retryNextOp()`.
                // This is necessary to run retryable operations that failed during
                // their initial attempt since we don't know whether they are already
                // enqueued. If, for example, `op1`, `op2`, `op3` are enqueued and `op1`
                // needs to  be re-run, we will run `op1`, `op1`, `op2` using the
                // already enqueued calls to `retryNextOp()`. `op3()` will then run in the
                // call scheduled here.
                // Since `backoffAndRun()` cancels an existing backoff and schedules a
                // new backoff on every call, there is only ever a single additional
                // operation in the queue.
                this.No.Ro((() => this.za()));
            }
        }
        Wa(t) {
            const e = this.Fa.then((() => (this.qa = !0, t().catch((t => {
                this.Ua = t, this.qa = !1;
                const e = 
                /**
     * Chrome includes Error.message in Error.stack. Other browsers do not.
     * This returns expected output of message + stack when available.
     * @param error - Error or FirestoreError
     */
                function(t) {
                    let e = t.message || "";
                    t.stack && (e = t.stack.includes(t.message) ? t.stack : t.message + "\n" + t.stack);
                    return e;
                }
                /**
     * @license
     * Copyright 2017 Google LLC
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
     */ (t);
                // Re-throw the error so that this.tail becomes a rejected Promise and
                // all further attempts to chain (via .then) will just short-circuit
                // and return the rejected Promise.
                throw F("INTERNAL UNHANDLED ERROR: ", e), t;
            })).then((t => (this.qa = !1, t))))));
            return this.Fa = e, e;
        }
        enqueueAfterDelay(t, e, n) {
            this.ja(), 
            // Fast-forward delays for timerIds that have been overriden.
            this.Ga.indexOf(t) > -1 && (e = 0);
            const s = vu.createAndSchedule(this, t, e, n, (t => this.Ha(t)));
            return this.La.push(s), s;
        }
        ja() {
            this.Ua && L();
        }
        verifyOperationInProgress() {}
        /**
         * Waits until all currently queued tasks are finished executing. Delayed
         * operations are not run.
         */    async Ja() {
            // Operations in the queue prior to draining may have enqueued additional
            // operations. Keep draining the queue until the tail is no longer advanced,
            // which indicates that no more new operations were enqueued and that all
            // operations were executed.
            let t;
            do {
                t = this.Fa, await t;
            } while (t !== this.Fa);
        }
        /**
         * For Tests: Determine if a delayed operation with a particular TimerId
         * exists.
         */    Ya(t) {
            for (const e of this.La) if (e.timerId === t) return !0;
            return !1;
        }
        /**
         * For Tests: Runs some or all delayed operations early.
         *
         * @param lastTimerId - Delayed operations up to and including this TimerId
         * will be drained. Pass TimerId.All to run all delayed operations.
         * @returns a Promise that resolves once all operations have been run.
         */    Xa(t) {
            // Note that draining may generate more delayed ops, so we do that first.
            return this.Ja().then((() => {
                // Run ops in the same order they'd run if they ran naturally.
                this.La.sort(((t, e) => t.targetTimeMs - e.targetTimeMs));
                for (const e of this.La) if (e.skipDelay(), "all" /* All */ !== t && e.timerId === t) break;
                return this.Ja();
            }));
        }
        /**
         * For Tests: Skip all subsequent delays for a timer id.
         */    Za(t) {
            this.Ga.push(t);
        }
        /** Called once a DelayedOperation is run or canceled. */    Ha(t) {
            // NOTE: indexOf / slice are O(n), but delayedOperations is expected to be small.
            const e = this.La.indexOf(t);
            this.La.splice(e, 1);
        }
    }

    /**
     * The Cloud Firestore service interface.
     *
     * Do not call this constructor directly. Instead, use {@link getFirestore}.
     */
    class Vc extends dc {
        /** @hideconstructor */
        constructor(t, e, n) {
            super(t, e, n), 
            /**
             * Whether it's a {@link Firestore} or Firestore Lite instance.
             */
            this.type = "firestore", this._queue = new Ac, this._persistenceKey = "name" in t ? t.name : "[DEFAULT]";
        }
        _terminate() {
            return this._firestoreClient || 
            // The client must be initialized to ensure that all subsequent API
            // usage throws an exception.
            Cc(this), this._firestoreClient.terminate();
        }
    }

    /**
     * Returns the existing {@link Firestore} instance that is associated with the
     * provided {@link @firebase/app#FirebaseApp}. If no instance exists, initializes a new
     * instance with default settings.
     *
     * @param app - The {@link @firebase/app#FirebaseApp} instance that the returned {@link Firestore}
     * instance is associated with.
     * @returns The {@link Firestore} instance of the provided app.
     */ function Sc(e = getApp()) {
        return _getProvider(e, "firestore").getImmediate();
    }

    function Cc(t) {
        var e;
        const n = t._freezeSettings(), s = function(t, e, n, s) {
            return new Vt(t, e, n, s.host, s.ssl, s.experimentalForceLongPolling, s.experimentalAutoDetectLongPolling, s.useFetchStreams);
        }(t._databaseId, (null === (e = t._app) || void 0 === e ? void 0 : e.options.appId) || "", t._persistenceKey, n);
        t._firestoreClient = new $a(t._authCredentials, t._appCheckCredentials, t._queue, s);
    }

    /**
     * Cloud Firestore
     *
     * @packageDocumentation
     */ !function(t, e = !0) {
        !function(t) {
            x = t;
        }(SDK_VERSION), _registerComponent(new Component("firestore", ((t, {options: n}) => {
            const s = t.getProvider("app").getImmediate(), i = new Vc(s, new J(t.getProvider("auth-internal")), new tt(t.getProvider("app-check-internal")));
            return n = Object.assign({
                useFetchStreams: e
            }, n), i._setSettings(n), i;
        }), "PUBLIC")), registerVersion(D, "3.4.9", t), 
        // BUILD_TARGET will be replaced by values like esm5, esm2017, cjs5, etc during the compilation
        registerVersion(D, "3.4.9", "esm2017");
    }();

    // Import the functions you need from the SDKs you need

    // TODO: Add SDKs for Firebase products that you want to use
    // https://firebase.google.com/docs/web/setup#available-libraries

    // Your web app's Firebase configuration
    // For Firebase JS SDK v7.20.0 and later, measurementId is optional
    const firebaseConfig = {
      apiKey: "AIzaSyDnPuf9OohEi3HSmOEhDi2Oy8xUDr8yvdI",
      authDomain: "testing-bc33d.firebaseapp.com",
      projectId: "testing-bc33d",
      storageBucket: "testing-bc33d.appspot.com",
      messagingSenderId: "152954341533",
      appId: "1:152954341533:web:b87e7cfcac83eb327cac74",
      measurementId: "G-ZNC3DMQDR5"
    };

    // Initialize Firebase
    const app$1 = initializeApp(firebaseConfig);
    Sc(app$1);

    const app = new App({
    	target: document.body,
    	props: {
    		name: 'Nolene'
    	}
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map
