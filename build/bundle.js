
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(window.document);
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
    function svg_element(name) {
        return document.createElementNS('http://www.w3.org/2000/svg', name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
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
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
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
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
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
        flushing = false;
        seen_callbacks.clear();
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
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
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
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const prop_values = options.props || {};
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
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
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
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
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
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.29.0' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev("SvelteDOMInsert", { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev("SvelteDOMInsert", { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev("SvelteDOMRemove", { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ["capture"] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev("SvelteDOMAddEventListener", { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev("SvelteDOMRemoveEventListener", { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev("SvelteDOMRemoveAttribute", { node, attribute });
        else
            dispatch_dev("SvelteDOMSetAttribute", { node, attribute, value });
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error(`'target' is a required option`);
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn(`Component was already destroyed`); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* src\App.svelte generated by Svelte v3.29.0 */

    const { console: console_1 } = globals;
    const file = "src\\App.svelte";

    function create_fragment(ctx) {
    	let main;
    	let svg1;
    	let rect0;
    	let rect1;
    	let svg0;
    	let rect2;
    	let rect3;
    	let rect4;
    	let rect5;
    	let rect6;
    	let rect7;
    	let rect8;
    	let rect9;
    	let rect10;
    	let rect11;
    	let rect12;
    	let rect13;
    	let rect14;
    	let rect15;
    	let rect16;
    	let rect17;
    	let rect18;
    	let rect19;
    	let rect20;
    	let rect21;
    	let rect22;
    	let g0;
    	let t0;
    	let rect23;
    	let text0;
    	let t1;
    	let g1;
    	let rect24;
    	let text1;
    	let t2;
    	let g2;
    	let rect25;
    	let text2;
    	let t3;
    	let path;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			main = element("main");
    			svg1 = svg_element("svg");
    			rect0 = svg_element("rect");
    			rect1 = svg_element("rect");
    			svg0 = svg_element("svg");
    			rect2 = svg_element("rect");
    			rect3 = svg_element("rect");
    			rect4 = svg_element("rect");
    			rect5 = svg_element("rect");
    			rect6 = svg_element("rect");
    			rect7 = svg_element("rect");
    			rect8 = svg_element("rect");
    			rect9 = svg_element("rect");
    			rect10 = svg_element("rect");
    			rect11 = svg_element("rect");
    			rect12 = svg_element("rect");
    			rect13 = svg_element("rect");
    			rect14 = svg_element("rect");
    			rect15 = svg_element("rect");
    			rect16 = svg_element("rect");
    			rect17 = svg_element("rect");
    			rect18 = svg_element("rect");
    			rect19 = svg_element("rect");
    			rect20 = svg_element("rect");
    			rect21 = svg_element("rect");
    			rect22 = svg_element("rect");
    			g0 = svg_element("g");
    			t0 = text(">\n      ");
    			rect23 = svg_element("rect");
    			text0 = svg_element("text");
    			t1 = text("Links");
    			g1 = svg_element("g");
    			rect24 = svg_element("rect");
    			text1 = svg_element("text");
    			t2 = text("Actie");
    			g2 = svg_element("g");
    			rect25 = svg_element("rect");
    			text2 = svg_element("text");
    			t3 = text("Rechts");
    			path = svg_element("path");
    			attr_dev(rect0, "x", "0px");
    			attr_dev(rect0, "y", "0px");
    			attr_dev(rect0, "width", "600px");
    			attr_dev(rect0, "height", "350px");
    			attr_dev(rect0, "fill", "lightblue");
    			add_location(rect0, file, 106, 4, 1995);
    			attr_dev(rect1, "x", "0px");
    			attr_dev(rect1, "y", "250px");
    			attr_dev(rect1, "width", "600px");
    			attr_dev(rect1, "height", "100px");
    			attr_dev(rect1, "fill", "darkgreen");
    			add_location(rect1, file, 107, 4, 2070);
    			attr_dev(rect2, "x", "110px");
    			attr_dev(rect2, "y", "145px");
    			attr_dev(rect2, "width", "20px");
    			attr_dev(rect2, "height", "5px");
    			attr_dev(rect2, "fill", "#ecb");
    			add_location(rect2, file, 110, 6, 2231);
    			attr_dev(rect3, "x", "100px");
    			attr_dev(rect3, "y", "100px");
    			attr_dev(rect3, "width", "40px");
    			attr_dev(rect3, "height", "45px");
    			attr_dev(rect3, "fill", "#ecb");
    			add_location(rect3, file, 117, 6, 2361);
    			attr_dev(rect4, "x", "94px");
    			attr_dev(rect4, "y", "115px");
    			attr_dev(rect4, "width", "6px");
    			attr_dev(rect4, "height", "7px");
    			attr_dev(rect4, "fill", "#ecb");
    			add_location(rect4, file, 124, 6, 2492);
    			attr_dev(rect5, "x", "124");
    			attr_dev(rect5, "y", "105");
    			attr_dev(rect5, "width", "20");
    			attr_dev(rect5, "height", "27px");
    			attr_dev(rect5, "fill", "#5A3825");
    			add_location(rect5, file, 125, 6, 2572);
    			attr_dev(rect6, "x", "105");
    			attr_dev(rect6, "y", "110");
    			attr_dev(rect6, "width", "5");
    			attr_dev(rect6, "height", "5");
    			attr_dev(rect6, "fill", "black");
    			add_location(rect6, file, 126, 6, 2652);
    			attr_dev(rect7, "x", "123");
    			attr_dev(rect7, "y", "110");
    			attr_dev(rect7, "width", "10");
    			attr_dev(rect7, "height", "15");
    			add_location(rect7, file, 127, 6, 2726);
    			attr_dev(rect8, "x", "123");
    			attr_dev(rect8, "y", "113");
    			attr_dev(rect8, "width", "7");
    			attr_dev(rect8, "height", "9");
    			attr_dev(rect8, "fill", "#ecb");
    			add_location(rect8, file, 128, 6, 2789);
    			attr_dev(rect9, "x", "124");
    			attr_dev(rect9, "y", "115");
    			attr_dev(rect9, "width", "3");
    			attr_dev(rect9, "height", "4");
    			attr_dev(rect9, "fill", "black");
    			add_location(rect9, file, 129, 6, 2862);
    			attr_dev(rect10, "x", "105");
    			attr_dev(rect10, "y", "130");
    			attr_dev(rect10, "width", "12");
    			attr_dev(rect10, "height", "3");
    			add_location(rect10, file, 131, 6, 2937);
    			attr_dev(rect11, "x", "92px");
    			attr_dev(rect11, "y", "98px");
    			attr_dev(rect11, "width", "55");
    			attr_dev(rect11, "height", "7");
    			attr_dev(rect11, "color", "black");
    			add_location(rect11, file, 132, 6, 2999);
    			attr_dev(rect12, "x", "100");
    			attr_dev(rect12, "y", "70");
    			attr_dev(rect12, "width", "40");
    			attr_dev(rect12, "height", "30");
    			attr_dev(rect12, "fill", "black");
    			add_location(rect12, file, 133, 6, 3077);
    			attr_dev(rect13, "x", "100px");
    			attr_dev(rect13, "y", "148px");
    			attr_dev(rect13, "width", "40px");
    			attr_dev(rect13, "height", "60px");
    			add_location(rect13, file, 135, 6, 3153);
    			attr_dev(rect14, "x", "100px");
    			attr_dev(rect14, "y", "148px");
    			attr_dev(rect14, "width", "10");
    			attr_dev(rect14, "height", "40px");
    			attr_dev(rect14, "fill", "white");
    			add_location(rect14, file, 136, 6, 3224);
    			attr_dev(rect15, "x", "100");
    			attr_dev(rect15, "y", "148");
    			attr_dev(rect15, "width", "7");
    			attr_dev(rect15, "height", "6");
    			attr_dev(rect15, "fill", "darkblue");
    			add_location(rect15, file, 143, 6, 3354);
    			attr_dev(rect16, "x", "100");
    			attr_dev(rect16, "y", "155");
    			attr_dev(rect16, "width", "6");
    			attr_dev(rect16, "height", "25");
    			attr_dev(rect16, "fill", "darkblue");
    			add_location(rect16, file, 144, 6, 3431);
    			attr_dev(rect17, "x", "102px");
    			attr_dev(rect17, "y", "258px");
    			attr_dev(rect17, "width", "11");
    			attr_dev(rect17, "height", "5");
    			attr_dev(rect17, "fill", "red");
    			add_location(rect17, file, 145, 6, 3509);
    			attr_dev(rect18, "x", "127px");
    			attr_dev(rect18, "y", "258px");
    			attr_dev(rect18, "width", "11");
    			attr_dev(rect18, "height", "5");
    			attr_dev(rect18, "fill", "red");
    			add_location(rect18, file, 146, 6, 3586);
    			attr_dev(rect19, "x", "100px");
    			attr_dev(rect19, "y", "208");
    			attr_dev(rect19, "width", "15");
    			attr_dev(rect19, "height", "50");
    			add_location(rect19, file, 147, 6, 3663);
    			attr_dev(rect20, "x", "125px");
    			attr_dev(rect20, "y", "208");
    			attr_dev(rect20, "width", "15");
    			attr_dev(rect20, "height", "50");
    			add_location(rect20, file, 148, 6, 3728);
    			attr_dev(rect21, "x", "90px");
    			attr_dev(rect21, "y", "260px");
    			attr_dev(rect21, "width", "25");
    			attr_dev(rect21, "height", "10");
    			attr_dev(rect21, "fill", "#5A3825");
    			add_location(rect21, file, 149, 6, 3793);
    			attr_dev(rect22, "x", "125px");
    			attr_dev(rect22, "y", "260px");
    			attr_dev(rect22, "width", "25");
    			attr_dev(rect22, "height", "10");
    			attr_dev(rect22, "fill", "#5A3825");
    			add_location(rect22, file, 150, 6, 3874);
    			attr_dev(svg0, "x", /*moveX*/ ctx[0]);
    			attr_dev(svg0, "y", "140px");
    			attr_dev(svg0, "width", "100px");
    			attr_dev(svg0, "height", "150px");
    			attr_dev(svg0, "viewBox", "0 0 200 300");
    			add_location(svg0, file, 108, 4, 2147);
    			attr_dev(rect23, "x", "0px");
    			attr_dev(rect23, "y", "0px");
    			attr_dev(rect23, "width", "50px");
    			attr_dev(rect23, "height", "30px");
    			attr_dev(rect23, "fill", "darkblue");
    			add_location(rect23, file, 169, 6, 4270);
    			attr_dev(text0, "x", "3px");
    			attr_dev(text0, "y", "20px");
    			attr_dev(text0, "stroke", "white");
    			attr_dev(text0, "fill", "white");
    			add_location(text0, file, 176, 6, 4401);
    			attr_dev(g0, "transform", "translate(180, 280)");
    			attr_dev(g0, "disabled", /*disableLower*/ ctx[1]);
    			add_location(g0, file, 160, 4, 4015);
    			attr_dev(rect24, "x", "0px");
    			attr_dev(rect24, "y", "0px");
    			attr_dev(rect24, "width", "50px");
    			attr_dev(rect24, "height", "30px");
    			attr_dev(rect24, "fill", "darkblue");
    			add_location(rect24, file, 181, 6, 4540);
    			attr_dev(text1, "x", "3px");
    			attr_dev(text1, "y", "20px");
    			attr_dev(text1, "stroke", "white");
    			attr_dev(text1, "fill", "white");
    			add_location(text1, file, 188, 6, 4671);
    			attr_dev(g1, "transform", "translate(270, 280)");
    			add_location(g1, file, 179, 4, 4479);
    			attr_dev(rect25, "x", "0px");
    			attr_dev(rect25, "y", "0px");
    			attr_dev(rect25, "width", "50px");
    			attr_dev(rect25, "height", "30px");
    			attr_dev(rect25, "fill", "darkblue");
    			add_location(rect25, file, 199, 6, 4970);
    			attr_dev(text2, "x", "3px");
    			attr_dev(text2, "y", "20px");
    			attr_dev(text2, "stroke", "white");
    			attr_dev(text2, "fill", "white");
    			add_location(text2, file, 206, 6, 5101);
    			add_location(path, file, 207, 6, 5172);
    			attr_dev(g2, "transform", "translate(360, 280)");
    			add_location(g2, file, 191, 4, 4749);
    			attr_dev(svg1, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg1, "width", "600px");
    			attr_dev(svg1, "height", "350px");
    			attr_dev(svg1, "viewBox", "0 0 600 350");
    			add_location(svg1, file, 101, 2, 1883);
    			attr_dev(main, "class", "svelte-1e9puaw");
    			add_location(main, file, 91, 0, 1617);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, svg1);
    			append_dev(svg1, rect0);
    			append_dev(svg1, rect1);
    			append_dev(svg1, svg0);
    			append_dev(svg0, rect2);
    			append_dev(svg0, rect3);
    			append_dev(svg0, rect4);
    			append_dev(svg0, rect5);
    			append_dev(svg0, rect6);
    			append_dev(svg0, rect7);
    			append_dev(svg0, rect8);
    			append_dev(svg0, rect9);
    			append_dev(svg0, rect10);
    			append_dev(svg0, rect11);
    			append_dev(svg0, rect12);
    			append_dev(svg0, rect13);
    			append_dev(svg0, rect14);
    			append_dev(svg0, rect15);
    			append_dev(svg0, rect16);
    			append_dev(svg0, rect17);
    			append_dev(svg0, rect18);
    			append_dev(svg0, rect19);
    			append_dev(svg0, rect20);
    			append_dev(svg0, rect21);
    			append_dev(svg0, rect22);
    			append_dev(svg1, g0);
    			append_dev(g0, t0);
    			append_dev(g0, rect23);
    			append_dev(g0, text0);
    			append_dev(text0, t1);
    			append_dev(svg1, g1);
    			append_dev(g1, rect24);
    			append_dev(g1, text1);
    			append_dev(text1, t2);
    			append_dev(svg1, g2);
    			append_dev(g2, rect25);
    			append_dev(g2, text2);
    			append_dev(text2, t3);
    			append_dev(g2, path);

    			if (!mounted) {
    				dispose = [
    					listen_dev(g0, "click", /*moveLinks*/ ctx[2], false, false, false),
    					listen_dev(g0, "mousedown", /*startIntervalLower*/ ctx[5], false, false, false),
    					listen_dev(g0, "touchstart", /*startIntervalLower*/ ctx[5], { passive: true }, false, false),
    					listen_dev(g0, "mouseup", /*stopTimers*/ ctx[7], false, false, false),
    					listen_dev(g0, "touchend", /*stopTimers*/ ctx[7], { passive: true }, false, false),
    					listen_dev(g1, "click", /*action*/ ctx[4], false, false, false),
    					listen_dev(g2, "click", /*moveRechts*/ ctx[3], false, false, false),
    					listen_dev(g2, "mousedown", /*startIntervalHigher*/ ctx[6], false, false, false),
    					listen_dev(g2, "touchstart", /*startIntervalHigher*/ ctx[6], { passive: true }, false, false),
    					listen_dev(g2, "mouseup", /*stopTimers*/ ctx[7], false, false, false),
    					listen_dev(g2, "touchend", /*stopTimers*/ ctx[7], { passive: true }, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*moveX*/ 1) {
    				attr_dev(svg0, "x", /*moveX*/ ctx[0]);
    			}

    			if (dirty & /*disableLower*/ 2) {
    				attr_dev(g0, "disabled", /*disableLower*/ ctx[1]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			mounted = false;
    			run_all(dispose);
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
    	validate_slots("App", slots, []);
    	let { name } = $$props;
    	let moveX = 105;

    	let moveLinks = () => {
    		$$invalidate(0, moveX -= 10);
    	};

    	let moveRechts = () => {
    		$$invalidate(0, moveX += 10);
    	};

    	let action = () => {
    		console.log("action");
    	};

    	let intervalHighlight;
    	let timeoutHighlight;
    	let disableLower = false;
    	let disableHigher = false;

    	function oneLower() {
    		$$invalidate(0, moveX -= 1);

    		if (0 === moveX) {
    			stopTimers();
    		}
    	}

    	function startIntervalLower() {
    		timerBase = setTimeout(setLowerFunction, 500);
    	}

    	const setHigherFunction = () => {
    		$$invalidate(0, moveX += 5);

    		if (600 <= moveX) {
    			stopTimers();
    		} else {
    			timerNested = setTimeout(setHigherFunction, 80);
    		}
    	};

    	const setLowerFunction = () => {
    		$$invalidate(0, moveX -= 5);

    		if (0 >= moveX) {
    			$$invalidate(0, moveX = 0);
    			stopTimers();
    		} else {
    			timerNested = setTimeout(setLowerFunction, 80);
    		}
    	};

    	let timerBase;
    	let timerNested;

    	function startIntervalHigher() {
    		$$invalidate(1, disableLower = false);
    		timerBase = setTimeout(setHigherFunction, 300);
    	}

    	function stopTimers() {
    		clearTimeout(timerBase);
    		clearTimeout(timerNested);
    	}

    	function oneHigher() {
    		$$invalidate(1, disableLower = false);
    		nameIndex += 1;
    	} // if (chartData.length - 1 === nameIndex) {
    	//   stopTimers();

    	const writable_props = ["name"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("name" in $$props) $$invalidate(8, name = $$props.name);
    	};

    	$$self.$capture_state = () => ({
    		name,
    		moveX,
    		moveLinks,
    		moveRechts,
    		action,
    		intervalHighlight,
    		timeoutHighlight,
    		disableLower,
    		disableHigher,
    		oneLower,
    		startIntervalLower,
    		setHigherFunction,
    		setLowerFunction,
    		timerBase,
    		timerNested,
    		startIntervalHigher,
    		stopTimers,
    		oneHigher
    	});

    	$$self.$inject_state = $$props => {
    		if ("name" in $$props) $$invalidate(8, name = $$props.name);
    		if ("moveX" in $$props) $$invalidate(0, moveX = $$props.moveX);
    		if ("moveLinks" in $$props) $$invalidate(2, moveLinks = $$props.moveLinks);
    		if ("moveRechts" in $$props) $$invalidate(3, moveRechts = $$props.moveRechts);
    		if ("action" in $$props) $$invalidate(4, action = $$props.action);
    		if ("intervalHighlight" in $$props) intervalHighlight = $$props.intervalHighlight;
    		if ("timeoutHighlight" in $$props) timeoutHighlight = $$props.timeoutHighlight;
    		if ("disableLower" in $$props) $$invalidate(1, disableLower = $$props.disableLower);
    		if ("disableHigher" in $$props) disableHigher = $$props.disableHigher;
    		if ("timerBase" in $$props) timerBase = $$props.timerBase;
    		if ("timerNested" in $$props) timerNested = $$props.timerNested;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*moveX*/ 1) {
    			 console.log(moveX);
    		}
    	};

    	return [
    		moveX,
    		disableLower,
    		moveLinks,
    		moveRechts,
    		action,
    		startIntervalLower,
    		startIntervalHigher,
    		stopTimers,
    		name
    	];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, { name: 8 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*name*/ ctx[8] === undefined && !("name" in props)) {
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

    const app = new App({
    	target: document.body,
    	props: {
    		name: 'world'
    	}
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
