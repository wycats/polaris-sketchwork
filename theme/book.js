"use strict";
/// <reference path="./env.d.ts" />
// Fix back button cache problem
window.onunload = function () { };
// Global variable, shared between modules
globalThis["playground_text"] = (playground) => {
    const code_block = find(playground, "code", HTMLElement);
    if (window.ace && code_block.classList.contains("editable")) {
        const editor = window.ace.edit(code_block);
        return editor.getValue();
    }
    else {
        return code_block.textContent ?? "";
    }
};
class ActiveHandler {
}
(function codeSnippets() {
    function fetch_with_timeout(url, options, timeout = 6000) {
        return Promise.race([
            fetch(url, options),
            new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), timeout)),
        ]);
    }
    const playgrounds = findAll(document, ".playground", HTMLPreElement);
    if (playgrounds.length > 0) {
        fetch_with_timeout("https://play.rust-lang.org/meta/crates", {
            headers: {
                "Content-Type": "application/json",
            },
            method: "POST",
            mode: "cors",
        })
            .then((response) => response.json())
            .then((response) => {
            // get list of crates available in the rust playground
            const playground_crates = response.crates.map((item) => item["id"]);
            playgrounds.forEach((block) => handle_crate_list_update(block, playground_crates));
        });
    }
    function handle_crate_list_update(playground_block, playground_crates) {
        // update the play buttons after receiving the response
        update_play_button(playground_block, playground_crates);
        // and install on change listener to dynamically update ACE editors
        if (window.ace) {
            const code_block = playground_block.querySelector("code");
            if (code_block.classList.contains("editable")) {
                const editor = window.ace.edit(code_block);
                editor.addEventListener("change", () => {
                    update_play_button(playground_block, playground_crates);
                });
                // add Ctrl-Enter command to execute rust code
                editor.commands.addCommand({
                    name: "run",
                    bindKey: {
                        win: "Ctrl-Enter",
                        mac: "Ctrl-Enter",
                    },
                    exec: (_editor) => run_rust_code(playground_block),
                });
            }
        }
    }
    // updates the visibility of play button based on `no_run` class and
    // used crates vs ones available on http://play.rust-lang.org
    function update_play_button(pre_block, playground_crates) {
        const play_button = find(pre_block, ".play-button", HTMLElement);
        // skip if code is `no_run`
        if (find(pre_block, "code", HTMLElement).classList.contains("no_run")) {
            play_button.classList.add("hidden");
            return;
        }
        // get list of `extern crate`'s from snippet
        const txt = playground_text(pre_block);
        const re = /extern\s+crate\s+([a-zA-Z_0-9]+)\s*;/g;
        const snippet_crates = [];
        let item;
        while ((item = re.exec(txt))) {
            snippet_crates.push(item[1]);
        }
        // check if all used crates are available on play.rust-lang.org
        const all_available = snippet_crates.every(function (elem) {
            return playground_crates.indexOf(elem) > -1;
        });
        if (all_available) {
            play_button.classList.remove("hidden");
        }
        else {
            play_button.classList.add("hidden");
        }
    }
    function run_rust_code(code_block) {
        let result_block = code_block.querySelector(".result");
        if (!result_block) {
            result_block = document.createElement("code");
            result_block.className = "result hljs language-bash";
            code_block.append(result_block);
        }
        const text = playground_text(code_block);
        const classes = code_block.querySelector("code").classList;
        let edition = "2015";
        if (classes.contains("edition2018")) {
            edition = "2018";
        }
        else if (classes.contains("edition2021")) {
            edition = "2021";
        }
        const params = {
            version: "stable",
            optimize: "0",
            code: text,
            edition: edition,
        };
        if (text.indexOf("#![feature") !== -1) {
            params.version = "nightly";
        }
        result_block.innerText = "Running...";
        fetch_with_timeout("https://play.rust-lang.org/evaluate.json", {
            headers: {
                "Content-Type": "application/json",
            },
            method: "POST",
            mode: "cors",
            body: JSON.stringify(params),
        })
            .then((response) => response.json())
            .then((response) => {
            if (response.result.trim() === "") {
                result_block.innerText = "No output";
                result_block.classList.add("result-no-output");
            }
            else {
                result_block.innerText = response.result;
                result_block.classList.remove("result-no-output");
            }
        })
            .catch((error) => (result_block.innerText =
            "Playground Communication: " + error.message));
    }
    // Syntax highlighting Configuration
    hljs.configure({
        languages: [], // Languages used for auto-detection
    });
    const code_nodes = Array.from(document.querySelectorAll("code"))
        // Don't highlight `inline code` blocks in headers.
        .filter(function (node) {
        return !node.parentElement?.classList.contains("header");
    });
    if (window.ace) {
        // language-rust class needs to be removed for editable
        // blocks or highlightjs will capture events
        code_nodes
            .filter(function (node) {
            return node.classList.contains("editable");
        })
            .forEach(function (block) {
            block.classList.remove("language-rust");
        });
        code_nodes
            .filter(function (node) {
            return !node.classList.contains("editable");
        })
            .forEach(function (block) {
            hljs.highlightBlock(block);
        });
    }
    else {
        code_nodes.forEach(function (block) {
            hljs.highlightBlock(block);
        });
    }
    // Adding the hljs class gives code blocks the color css
    // even if highlighting doesn't apply
    code_nodes.forEach(function (block) {
        block.classList.add("hljs");
    });
    Array.from(document.querySelectorAll("code.language-rust")).forEach(function (block) {
        const lines = Array.from(block.querySelectorAll(".boring"));
        // If no lines were hidden, return
        if (!lines.length) {
            return;
        }
        block.classList.add("hide-boring");
        const buttonsContainer = document.createElement("div");
        buttonsContainer.className = "buttons";
        buttonsContainer.innerHTML =
            '<button class="fa fa-eye" title="Show hidden lines" aria-label="Show hidden lines"></button>';
        // add expand button
        const pre_block = block.parentNode;
        pre_block.insertBefore(buttonsContainer, pre_block.firstChild);
        const buttons = pre_block.querySelector(".buttons");
        buttons.addEventListener("click", function (e) {
            const target = e.target;
            console.log({
                target,
                buttonsContainer,
                eq: target === buttonsContainer,
            });
            if (target instanceof HTMLElement) {
                if (target.classList.contains("fa-eye")) {
                    target.classList.remove("fa-eye");
                    target.classList.add("fa-eye-slash");
                    target.title = "Hide lines";
                    target.setAttribute("aria-label", target.title);
                    block.classList.remove("hide-boring");
                }
                else if (target.classList.contains("fa-eye-slash")) {
                    target.classList.remove("fa-eye-slash");
                    target.classList.add("fa-eye");
                    target.title = "Show hidden lines";
                    target.setAttribute("aria-label", target.title);
                    block.classList.add("hide-boring");
                }
            }
        });
    });
    if (window.playground_copyable) {
        for (const block of findAll(document, "pre code", HTMLElement)) {
            const pre_block = parentElement(block, HTMLElement);
            if (!pre_block.classList.contains("playground")) {
                let buttons = pre_block.querySelector(".buttons");
                if (!buttons) {
                    buttons = document.createElement("div");
                    buttons.className = "buttons";
                    pre_block.insertBefore(buttons, pre_block.firstChild);
                }
                const clipButton = document.createElement("button");
                clipButton.className = "fa fa-copy clip-button";
                clipButton.title = "Copy to clipboard";
                clipButton.setAttribute("aria-label", clipButton.title);
                clipButton.innerHTML = '<i class="tooltiptext"></i>';
                buttons.insertBefore(clipButton, buttons.firstChild);
            }
        }
        Array.from(document.querySelectorAll("pre code")).forEach(function (block) { });
    }
    // Process playground code blocks
    for (const pre_block of findAll(document, ".playground", HTMLPreElement)) {
        // Add play button
        let buttons = pre_block.querySelector(".buttons");
        if (!buttons) {
            buttons = document.createElement("div");
            buttons.className = "buttons";
            pre_block.insertBefore(buttons, pre_block.firstChild);
        }
        const runCodeButton = document.createElement("button");
        runCodeButton.className = "fa fa-play play-button";
        runCodeButton.hidden = true;
        runCodeButton.title = "Run this code";
        runCodeButton.setAttribute("aria-label", runCodeButton.title);
        buttons.insertBefore(runCodeButton, buttons.firstChild);
        runCodeButton.addEventListener("click", function (e) {
            run_rust_code(pre_block);
        });
        if (window.playground_copyable) {
            const copyCodeClipboardButton = document.createElement("button");
            copyCodeClipboardButton.className = "fa fa-copy clip-button";
            copyCodeClipboardButton.innerHTML = '<i class="tooltiptext"></i>';
            copyCodeClipboardButton.title = "Copy to clipboard";
            copyCodeClipboardButton.setAttribute("aria-label", copyCodeClipboardButton.title);
            buttons.insertBefore(copyCodeClipboardButton, buttons.firstChild);
        }
        const code_block = find(pre_block, "code", HTMLElement);
        if (window.ace && code_block.classList.contains("editable")) {
            const undoChangesButton = document.createElement("button");
            undoChangesButton.className = "fa fa-history reset-button";
            undoChangesButton.title = "Undo changes";
            undoChangesButton.setAttribute("aria-label", undoChangesButton.title);
            buttons.insertBefore(undoChangesButton, buttons.firstChild);
            undoChangesButton.addEventListener("click", function () {
                const editor = window.ace.edit(code_block);
                editor.setValue(editor.originalCode);
                editor.clearSelection();
            });
        }
    }
})();
(function themes() {
    const html = document.querySelector("html");
    const themeToggleButton = document.getElementById("theme-toggle");
    const themePopup = document.getElementById("theme-list");
    const themeColorMetaTag = document.querySelector('meta[name="theme-color"]');
    const stylesheets = {
        ayuHighlight: document.querySelector("[href$='ayu-highlight.css']"),
        tomorrowNight: document.querySelector("[href$='tomorrow-night.css']"),
        highlight: document.querySelector("[href$='highlight.css']"),
    };
    function showThemes() {
        themePopup.style.display = "block";
        themeToggleButton.setAttribute("aria-expanded", "true");
        focus(`button#${get_theme()}`, themePopup);
    }
    /**
     * @param {string} selector
     * @param {ParentNode} [inside]
     * @returns {void}
     */
    function focus(selector, inside = document) {
        const element = inside.querySelector(selector);
        if (element && element instanceof HTMLElement) {
            element.focus();
        }
    }
    function hideThemes() {
        themePopup.setAttribute("hidden", "");
        themeToggleButton.setAttribute("aria-expanded", "false");
        themeToggleButton.focus();
    }
    function get_theme() {
        let theme;
        try {
            theme = localStorage.getItem("mdbook-theme");
        }
        catch (e) { }
        if (theme === null || theme === undefined) {
            return default_theme;
        }
        else {
            return theme;
        }
    }
    function set_theme(theme, store = true) {
        let ace_theme;
        if (theme == "coal" || theme == "navy") {
            stylesheets.ayuHighlight.disabled = true;
            stylesheets.tomorrowNight.disabled = false;
            stylesheets.highlight.disabled = true;
            ace_theme = "ace/theme/tomorrow_night";
        }
        else if (theme == "ayu") {
            stylesheets.ayuHighlight.disabled = false;
            stylesheets.tomorrowNight.disabled = true;
            stylesheets.highlight.disabled = true;
            ace_theme = "ace/theme/tomorrow_night";
        }
        else {
            stylesheets.ayuHighlight.disabled = true;
            stylesheets.tomorrowNight.disabled = true;
            stylesheets.highlight.disabled = false;
            ace_theme = "ace/theme/dawn";
        }
        setTimeout(function () {
            themeColorMetaTag.content = getComputedStyle(document.body).backgroundColor;
        }, 1);
        if (globalThis.ace && globalThis.editors) {
            for (const editor of globalThis.editors) {
                editor.setTheme(ace_theme);
            }
        }
        const previousTheme = get_theme();
        if (store) {
            try {
                localStorage.setItem("mdbook-theme", theme);
            }
            catch (e) { }
        }
        html.classList.remove(previousTheme);
        html.classList.add(theme);
    }
    // Set theme
    const theme = get_theme();
    set_theme(theme, false);
    themeToggleButton.addEventListener("click", () => {
        themePopup.toggleAttribute("hidden");
    });
    for (const button of themePopup.querySelectorAll("button")) {
        button.addEventListener("click", () => {
            set_theme(button.id);
        });
    }
    const buttons = themePopup.querySelectorAll("button");
    themePopup.addEventListener("focusout", (e) => {
        // because a number of bugs were reported with e.relatedTarget, use
        // document.activeElement instead. However, document.activeElement is not
        // yet changed in focusout, and focusin may not reliably occur, so queue a
        // microtask to check, which should reliably occur after the active element
        // is changed.
        queueMicrotask(() => {
            if (focusIsIn(e.relatedTarget, themePopup)) {
                return;
            }
            hideThemes();
        });
    });
    /**
     *
     * @param {EventTarget | null} target
     * @param {Element} container
     */
    function focusIsIn(target, container) {
        if (target === null) {
            return false;
        }
        if (target instanceof Element && container.contains(target)) {
            return true;
        }
        return false;
    }
    document.addEventListener("keydown", function (e) {
        if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) {
            return;
        }
        if (!contains(themePopup, e.target)) {
            return;
        }
        let li = null;
        switch (e.key) {
            case "Escape":
                e.preventDefault();
                hideThemes();
                break;
            case "ArrowUp":
                e.preventDefault();
                li = parentElement(activeElement(), {
                    type: HTMLLIElement,
                    null: "allow",
                });
                if (li && li.previousElementSibling) {
                    find(li.previousElementSibling, "button", HTMLButtonElement).focus();
                }
                break;
            case "ArrowDown":
                e.preventDefault();
                li = parentElement(activeElement(), {
                    type: HTMLLIElement,
                    null: "allow",
                });
                if (li && li.nextElementSibling) {
                    find(li.nextElementSibling, "button", HTMLButtonElement).focus();
                }
                break;
            case "Home":
                e.preventDefault();
                find(themePopup, "li:first-child button", HTMLButtonElement).focus();
                break;
            case "End":
                e.preventDefault();
                find(themePopup, "li:last-child button", HTMLButtonElement).focus();
                break;
        }
    });
})();
(function sidebar() {
    const html = document.querySelector("html");
    const sidebar = document.getElementById("sidebar");
    const sidebarLinks = document.querySelectorAll("#sidebar a");
    const sidebarToggleButton = document.getElementById("sidebar-toggle");
    const sidebarResizeHandle = document.getElementById("sidebar-resize-handle");
    let firstContact = null;
    function showSidebar() {
        html.classList.remove("sidebar-hidden");
        html.classList.add("sidebar-visible");
        Array.from(sidebarLinks).forEach(function (link) {
            link.setAttribute("tabIndex", "0");
        });
        sidebarToggleButton.setAttribute("aria-expanded", "true");
        sidebar.setAttribute("aria-hidden", "false");
        try {
            localStorage.setItem("mdbook-sidebar", "visible");
        }
        catch (e) { }
    }
    const sidebarAnchorToggles = document.querySelectorAll("#sidebar a.toggle");
    function toggleSection(e) {
        parentElement(e.currentTarget, HTMLElement).classList.toggle("open");
    }
    Array.from(sidebarAnchorToggles).forEach((el) => {
        el.addEventListener("click", toggleSection);
    });
    function hideSidebar() {
        html.classList.remove("sidebar-visible");
        html.classList.add("sidebar-hidden");
        Array.from(sidebarLinks).forEach(function (link) {
            link.setAttribute("tabIndex", "-1");
        });
        sidebarToggleButton.setAttribute("aria-expanded", "false");
        sidebar.setAttribute("aria-hidden", "true");
        try {
            localStorage.setItem("mdbook-sidebar", "hidden");
        }
        catch (e) { }
    }
    // Toggle sidebar
    sidebarToggleButton.addEventListener("click", function sidebarToggle() {
        if (html.classList.contains("sidebar-hidden")) {
            const current_width = parseInt(document.documentElement.style.getPropertyValue("--sidebar-width"), 10);
            if (current_width < 150) {
                document.documentElement.style.setProperty("--sidebar-width", "150px");
            }
            showSidebar();
        }
        else if (html.classList.contains("sidebar-visible")) {
            hideSidebar();
        }
        else {
            if (getComputedStyle(sidebar)["transform"] === "none") {
                hideSidebar();
            }
            else {
                showSidebar();
            }
        }
    });
    sidebarResizeHandle.addEventListener("mousedown", initResize, false);
    function initResize() {
        window.addEventListener("mousemove", resize, false);
        window.addEventListener("mouseup", stopResize, false);
        html.classList.add("sidebar-resizing");
    }
    function resize(e) {
        let pos = e.clientX - sidebar.offsetLeft;
        if (pos < 20) {
            hideSidebar();
        }
        else {
            if (html.classList.contains("sidebar-hidden")) {
                showSidebar();
            }
            pos = Math.min(pos, window.innerWidth - 100);
            document.documentElement.style.setProperty("--sidebar-width", pos + "px");
        }
    }
    //on mouseup remove windows functions mousemove & mouseup
    function stopResize(e) {
        html.classList.remove("sidebar-resizing");
        window.removeEventListener("mousemove", resize, false);
        window.removeEventListener("mouseup", stopResize, false);
    }
    document.addEventListener("touchstart", function (e) {
        firstContact = {
            x: e.touches[0].clientX,
            time: Date.now(),
        };
    }, { passive: true });
    document.addEventListener("touchmove", function (e) {
        if (!firstContact)
            return;
        const curX = e.touches[0].clientX;
        const xDiff = curX - firstContact.x, tDiff = Date.now() - firstContact.time;
        if (tDiff < 250 && Math.abs(xDiff) >= 150) {
            if (xDiff >= 0 &&
                firstContact.x < Math.min(document.body.clientWidth * 0.25, 300))
                showSidebar();
            else if (xDiff < 0 && curX < 300)
                hideSidebar();
            firstContact = null;
        }
    }, { passive: true });
    // Scroll sidebar to current active section
    const activeSection = sidebar.querySelector(".active");
    if (activeSection) {
        // https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollIntoView
        activeSection.scrollIntoView({ block: "center" });
    }
})();
(function chapterNavigation() {
    document.addEventListener("keydown", function (e) {
        if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) {
            return;
        }
        if (window.search && window.search.hasFocus()) {
            return;
        }
        switch (e.key) {
            case "ArrowRight":
                e.preventDefault();
                const nextButton = find(document, ".nav-chapaters.next", HTMLAnchorElement);
                if (nextButton) {
                    window.location.href = nextButton.href;
                }
                break;
            case "ArrowLeft":
                e.preventDefault();
                const previousButton = find(document, ".nav-chapters.previous", HTMLAnchorElement);
                if (previousButton) {
                    window.location.href = previousButton.href;
                }
                break;
        }
    });
})();
(function clipboard() {
    const clipButtons = document.querySelectorAll(".clip-button");
    function hideTooltip(target) {
        verified(target, (element) => {
            firstChild(element).textContent = "";
            element.className = "fa fa-copy clip-button";
        }, HTMLElement);
    }
    function showTooltip(target, msg) {
        verified(target, (element) => {
            firstChild(element).textContent = msg;
            element.className = "fa fa-copy tooltipped";
        });
    }
    const clipboardSnippets = new ClipboardJS(".clip-button", {
        text: function (trigger) {
            hideTooltip(trigger);
            const playground = closest(trigger, "pre", HTMLPreElement);
            return playground_text(playground);
        },
    });
    Array.from(clipButtons).forEach(function (clipButton) {
        clipButton.addEventListener("mouseout", function (e) {
            hideTooltip(e.currentTarget);
        });
    });
    clipboardSnippets.on("success", function (e) {
        e.clearSelection();
        showTooltip(e.trigger, "Copied!");
    });
    clipboardSnippets.on("error", function (e) {
        showTooltip(e.trigger, "Clipboard error!");
    });
})();
(function scrollToTop() {
    const menuTitle = find(document, ".menu-title", HTMLElement);
    menuTitle.addEventListener("click", () => {
        scrollingElement().scrollTo({ top: 0, behavior: "smooth" });
    });
})();
(function controllMenu() {
    const menu = find(document, "#menu-bar", HTMLElement);
    (function controllPosition() {
        let scrollTop = scrollingElement().scrollTop;
        let prevScrollTop = scrollTop;
        const minMenuY = -menu.clientHeight - 50;
        // When the script loads, the page can be at any scroll (e.g. if you reforesh it).
        menu.style.top = scrollTop + "px";
        // Same as parseInt(menu.style.top.slice(0, -2), but faster
        let topCache = Number(menu.style.top.slice(0, -2));
        menu.classList.remove("sticky");
        let stickyCache = false; // Same as menu.classList.contains('sticky'), but faster
        document.addEventListener("scroll", function () {
            scrollTop = Math.max(scrollingElement().scrollTop, 0);
            // `null` means that it doesn't need to be updated
            let nextSticky = null;
            let nextTop = null;
            const scrollDown = scrollTop > prevScrollTop;
            const menuPosAbsoluteY = topCache - scrollTop;
            if (scrollDown) {
                nextSticky = false;
                if (menuPosAbsoluteY > 0) {
                    nextTop = prevScrollTop;
                }
            }
            else {
                if (menuPosAbsoluteY > 0) {
                    nextSticky = true;
                }
                else if (menuPosAbsoluteY < minMenuY) {
                    nextTop = prevScrollTop + minMenuY;
                }
            }
            if (nextSticky === true && stickyCache === false) {
                menu.classList.add("sticky");
                stickyCache = true;
            }
            else if (nextSticky === false && stickyCache === true) {
                menu.classList.remove("sticky");
                stickyCache = false;
            }
            if (nextTop !== null) {
                menu.style.top = nextTop + "px";
                topCache = nextTop;
            }
            prevScrollTop = scrollTop;
        }, { passive: true });
    })();
    (function controllBorder() {
        menu.classList.remove("bordered");
        document.addEventListener("scroll", function () {
            if (menu.offsetTop === 0) {
                menu.classList.remove("bordered");
            }
            else {
                menu.classList.add("bordered");
            }
        }, { passive: true });
    })();
})();
function normalize(options) {
    if (typeof options === "function") {
        return { type: options, null: "reject" };
    }
    else {
        return options;
    }
}
function hasType(node, type) {
    return node instanceof type;
}
function verified(node, as, type) {
    validateNode(node, type ?? HTMLElement);
    return as(node);
}
function validateNode(node, options) {
    const normalized = normalize(options);
    if (node === null) {
        if (normalized.null === "reject") {
            throw new Error("Element not found");
        }
        else {
            return null;
        }
    }
    if (node instanceof normalized.type) {
        return node;
    }
    else {
        throw new Error("Element is not of the expected type");
    }
}
function validate(node, get, options) {
    if (!(node instanceof Node)) {
        throw new Error("event.target is not a node");
    }
    return validateNode(get(node), options);
}
function parentElement(node, rawOptions = HTMLElement) {
    return validate(node, (node) => node.parentNode, rawOptions);
}
function closest(node, selector, type) {
    if (!(node instanceof Element)) {
        throw new Error("event.target is not an element");
    }
    return validateNode(node.closest(selector), type ?? HTMLElement);
}
function firstChild(node, options) {
    return validate(node, (node) => node.firstChild, options ?? HTMLElement);
}
function find(element, selector, type) {
    const found = element.querySelector(selector);
    if (!found) {
        throw new Error(`Could not find element with selector "${selector}"`);
    }
    if (!(found instanceof type)) {
        throw new Error(`Found element with selector "${selector}" but it was not of type "${type.name}"`);
    }
    return found;
}
function findAll(element, selector, type) {
    const found = element.querySelectorAll(selector);
    return [...found].filter((elem) => elem instanceof type);
}
function contains(parent, child) {
    if (child === null) {
        throw Error("Unexpected: child parameter to contains was null");
    }
    if (!(child instanceof Element)) {
        throw new Error("Unexpected: child parameter to contains was not an element");
    }
    return parent.contains(child);
}
function scrollingElement() {
    return assertPresent(document.scrollingElement);
}
function activeElement() {
    return assertPresent(document.activeElement);
}
function assertPresent(value) {
    if (value === null) {
        throw new Error("Unexpected: value was null");
    }
    return value;
}
