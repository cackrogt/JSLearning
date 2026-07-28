"use strict";

/**********************************************************************
 *
 * Popup Detector
 *
 * Mobile-first overlay detection framework.
 *
 * Intended to be executed inside a browser page
 * (Chrome DevTools / Playwright page.evaluate()).
 *
 *********************************************************************/

const PopupDetector = (() => {

    ////////////////////////////////////////////////////////////////////
    // Configuration
    ////////////////////////////////////////////////////////////////////

    const DEFAULT_CONFIG = {

        ////////////////////////////////////////////////////////////////
        // Debug
        ////////////////////////////////////////////////////////////////

        debug: true,

        verbose: false,

        ////////////////////////////////////////////////////////////////
        // Traversal
        ////////////////////////////////////////////////////////////////

        includeShadowDOM: true,

        ////////////////////////////////////////////////////////////////
        // Mobile viewport
        ////////////////////////////////////////////////////////////////

        useVisualViewport: true,

        ////////////////////////////////////////////////////////////////
        // Candidate filtering
        ////////////////////////////////////////////////////////////////

        minimumAreaRatio: 0.10,

        minimumWidthRatio: 0.25,

        minimumHeightRatio: 0.25,

        minimumZIndex: 1,

        ////////////////////////////////////////////////////////////////
        // Overlap detection
        ////////////////////////////////////////////////////////////////

        sampleGrid: 3,

        ////////////////////////////////////////////////////////////////
        // Hiding
        ////////////////////////////////////////////////////////////////

        hideStrategy: "none",

        ////////////////////////////////////////////////////////////////
        // Statistics
        ////////////////////////////////////////////////////////////////

        collectMetadata: true,

        candidateRules:{

    requireLargeArea:true,

    requireLargeDimension:true,

    allowFixed:true,

    allowSticky:true,

    allowHighZIndex:true,

    allowDialog:true

},

    };

    ////////////////////////////////////////////////////////////////////
    // Mutable runtime state
    ////////////////////////////////////////////////////////////////////

    const State = {

        config: null,

        viewport: null,

        descriptors: [],

        visibleDescriptors: [],

        candidateDescriptors: [],

        overlapGraph: new Map(),
        elementLookup: new WeakMap(),

        hideCandidates: [],

        hiddenElements: [],

        stats: {}

    };
    
    ////////////////////////////////////////////////////////////////////
    // Logging
    ////////////////////////////////////////////////////////////////////

    function log(...args) {

        if (!State.config.debug)
            return;

        console.log("[PopupDetector]", ...args);

    }

    function verbose(...args) {

        if (!State.config.verbose)
            return;

        console.log("[PopupDetector]", ...args);

    }

    ////////////////////////////////////////////////////////////////////
    // Viewport
    ////////////////////////////////////////////////////////////////////

    function getViewport() {

        if (
            State.config.useVisualViewport &&
            window.visualViewport
        ) {

            return {

                width: window.visualViewport.width,

                height: window.visualViewport.height

            };

        }

        return {

            width: window.innerWidth,

            height: window.innerHeight

        };

    }

    
    ////////////////////////////////////////////////////////////////////

    function dumpDescriptorSummary(limit = 10) {

        console.table(

            State.descriptors
                .slice(0, limit)
                .map(d => ({

                    tag: d.tagName,

                    id: d.id,

                    class: d.className,

                    position: d.position,

                    z: d.zIndex,

                    width: Math.round(d.rect.width),

                    height: Math.round(d.rect.height)

                }))

        );

    }


    ////////////////////////////////////////////////////////////////////
    // Statistics
    ////////////////////////////////////////////////////////////////////

    function resetStatistics() {

        State.stats = {

            totalElements: 0,

            largestCoverage:0,

            visibleElements: 0,

            candidateElements: 0,

            overlapEdges: 0,

            hiddenElements: 0,

            startTime: performance.now(),

            endTime: 0,

            duration: 0

        };

    }

    ////////////////////////////////////////////////////////////////////
    // Public Runner
    ////////////////////////////////////////////////////////////////////

    function run(userConfig = {}) {

        State.config = {

            ...DEFAULT_CONFIG,

            ...userConfig

        };

        resetStatistics();

        State.viewport = getViewport();

        log("Viewport:", State.viewport);

        //
        // These will be implemented one by one.
        //

        collectDescriptors();
        if (State.config.verbose)
            dumpDescriptorSummary();

        determineVisibleElements();

        determineCandidates();

        if (State.config.verbose)
    dumpCandidates();

        buildOverlapGraph();
        if (State.config.verbose)
    dumpOverlapGraph();

        reduceOverlapGraph();

        if (State.config.collectMetadata)
            collectMetadata();

        hideElements();

        State.stats.endTime = performance.now();

        State.stats.duration =
            State.stats.endTime -
            State.stats.startTime;

        log("Finished.");

        return {

    stats: State.stats,

    hidden: State.hiddenElements,

    candidateCount:
        State.candidateDescriptors.length,

    overlapGraphSize:
        State.overlapGraph.size

};

    }

    ////////////////////////////////////////////////////////////////////
    // Stage Stubs
    ////////////////////////////////////////////////////////////////////

        ////////////////////////////////////////////////////////////////////
    // Traversal
    ////////////////////////////////////////////////////////////////////

    function collectDescriptors() {

        State.descriptors = [];
        State.elementLookup = new WeakMap();

        traverseRoot(document);

        State.stats.totalElements = State.descriptors.length;

        log(
            "Collected",
            State.descriptors.length,
            "elements"
        );
    }

    ////////////////////////////////////////////////////////////////////

    function traverseRoot(root) {

        const walker = document.createTreeWalker(
            root,
            NodeFilter.SHOW_ELEMENT
        );

        let node;

        while ((node = walker.nextNode())) {

            const descriptor = createDescriptor(node);

            State.descriptors.push(descriptor);

            if (
                State.config.includeShadowDOM &&
                node.shadowRoot
            ) {
                verbose(
                    "Entering shadow root:",
                    descriptor.tagName
                );

                traverseRoot(node.shadowRoot);
            }

        }

    }
        ////////////////////////////////////////////////////////////////////

    function getDomDepth(element) {

        let depth = 0;

        let current = element.parentElement;

        while (current) {

            depth++;

            current = current.parentElement;

        }

        return depth;

    }

    ////////////////////////////////////////////////////////////////////

    function createDescriptor(element) {

        const style = getComputedStyle(element);

        const rect = element.getBoundingClientRect();

        

        const descriptor = {

            ////////////////////////////////////////////////////////////
            // DOM
            ////////////////////////////////////////////////////////////

            element,
                        
            ////////////////////////////////////////////////////////////
            // DOM relationships
            ////////////////////////////////////////////////////////////

            parentElement: element.parentElement,

            hasShadowRoot: !!element.shadowRoot,

            domDepth: getDomDepth(element),

            ////////////////////////////////////////////////////////////
            // Identification
            ////////////////////////////////////////////////////////////

            tagName: element.tagName,

            id: element.id || "",

            className:
                typeof element.className === "string"
                    ? element.className
                    : "",

            ////////////////////////////////////////////////////////////
            // Geometry
            ////////////////////////////////////////////////////////////

            rect: {

                left: rect.left,

                top: rect.top,

                right: rect.right,

                bottom: rect.bottom,

                width: rect.width,

                height: rect.height

            },

            ////////////////////////////////////////////////////////////
            // Cached style
            ////////////////////////////////////////////////////////////

            position: style.position,

            display: style.display,

            visibility: style.visibility,

            opacity: Number(style.opacity),

            zIndex:
                style.zIndex === "auto"
                    ? 0
                    : Number(style.zIndex),

            pointerEvents: style.pointerEvents,

            ////////////////////////////////////////////////////////////
            // Filled later
            ////////////////////////////////////////////////////////////

            isVisible: false,

            isCandidate: false,

            coverageArea: 0,

            coverageRatio: 0,

            coverageWidthRatio: 0,

            coverageHeightRatio: 0,

            metadata: null

        };
        State.elementLookup.set(
            element,
            descriptor
        );

        return descriptor;

    }

    
    ////////////////////////////////////////////////////////////////////
    // Utilities
    ////////////////////////////////////////////////////////////////////

    function refreshDescriptorGeometry(descriptor) {

        const rect =
            descriptor.element.getBoundingClientRect();

        descriptor.rect.left = rect.left;
        descriptor.rect.top = rect.top;
        descriptor.rect.right = rect.right;
        descriptor.rect.bottom = rect.bottom;
        descriptor.rect.width = rect.width;
        descriptor.rect.height = rect.height;

    }

    ////////////////////////////////////////////////////////////////////

    function refreshDescriptorStyle(descriptor) {

        const style =
            getComputedStyle(descriptor.element);

        descriptor.position = style.position;

        descriptor.display = style.display;

        descriptor.visibility = style.visibility;

        descriptor.opacity = Number(style.opacity);

        descriptor.pointerEvents =
            style.pointerEvents;

        descriptor.zIndex =
            style.zIndex === "auto"
                ? 0
                : Number(style.zIndex);

    }


        ////////////////////////////////////////////////////////////////////
    // Visibility
    ////////////////////////////////////////////////////////////////////

    function determineVisibleElements() {

        State.visibleDescriptors = [];


        for (const descriptor of State.descriptors) {

            refreshDescriptorGeometry(descriptor);
            refreshDescriptorStyle(descriptor);

            descriptor.isVisible =
                isDescriptorVisible(descriptor);

            descriptor.coverageArea =
                computeVisibleArea(
                    descriptor.rect
                );

            descriptor.coverageRatio =
                descriptor.coverageArea /
                (
                    State.viewport.width *
                    State.viewport.height
                );

            descriptor.coverageWidthRatio =
                Math.min(
                    descriptor.rect.width,
                    State.viewport.width
                ) / State.viewport.width;

            descriptor.coverageHeightRatio =
                Math.min(
                    descriptor.rect.height,
                    State.viewport.height
                ) / State.viewport.height;
            State.stats.largestCoverage =
                Math.max(
                    State.stats.largestCoverage,
                    descriptor.coverageRatio
                );
            if (!descriptor.isVisible)
                continue;

            State.visibleDescriptors.push(descriptor);

        }

        State.stats.visibleElements =
            State.visibleDescriptors.length;

        log(
            "Visible:",
            State.visibleDescriptors.length
        );

    }

        ////////////////////////////////////////////////////////////////////

    function intersectsViewport(rect) {

        return !(
            rect.right <= 0 ||
            rect.bottom <= 0 ||
            rect.left >= State.viewport.width ||
            rect.top >= State.viewport.height
        );

    }

        ////////////////////////////////////////////////////////////////////

    function isDescriptorVisible(descriptor) {

        if (descriptor.display === "none")
            return false;

        if (descriptor.visibility === "hidden")
            return false;

        if (descriptor.opacity <= 0)
            return false;

        if (descriptor.rect.width <= 1)
            return false;

        if (descriptor.rect.height <= 1)
            return false;

        if (!intersectsViewport(descriptor.rect))
            return false;

        //
        // Optional future:
        // check clip-path
        // check transform scale
        //

        return true;

    }

        ////////////////////////////////////////////////////////////////////

    function computeVisibleArea(rect) {

        const left =
            Math.max(0, rect.left);

        const top =
            Math.max(0, rect.top);

        const right =
            Math.min(
                State.viewport.width,
                rect.right
            );

        const bottom =
            Math.min(
                State.viewport.height,
                rect.bottom
            );

        const width =
            Math.max(
                0,
                right - left
            );

        const height =
            Math.max(
                0,
                bottom - top
            );

        return width * height;

    }

    ////////////////////////////////////////////////////////////////////
//// Candidate Detection
////////////////////////////////////////////////////////////////////

function determineCandidates() {

    State.candidateDescriptors = [];

    for (const descriptor of State.visibleDescriptors) {

        descriptor.isCandidate =
            isCandidate(descriptor);

        if (!descriptor.isCandidate)
            continue;

        State.candidateDescriptors.push(descriptor);

    }

    State.stats.candidateElements =
        State.candidateDescriptors.length;

    log(
        "Candidates:",
        State.candidateDescriptors.length
    );

}

////////////////////////////////////////////////////////////////////
//// Candidate Rules
////////////////////////////////////////////////////////////////////

function isCandidate(descriptor) {

    //
    // Rule 1
    // Must occupy a meaningful amount
    // of viewport.
    //

    if (
        descriptor.coverageRatio <
        State.config.minimumAreaRatio
    ) {
        return false;
    }

    //
    // Rule 2
    //

    const widthRatio =
        descriptor.rect.width /
        State.viewport.width;

    const heightRatio =
        descriptor.rect.height /
        State.viewport.height;

    if (
        widthRatio <
            State.config.minimumWidthRatio
        &&
        heightRatio <
            State.config.minimumHeightRatio
    ) {
        return false;
    }

    //
    // Rule 3
    //

    if (
        descriptor.position === "fixed"
    )
        return true;

    //
    // Rule 4
    //

    if (
        descriptor.position === "sticky"
    )
        return true;

    //
    // Rule 5
    //

    if (
        descriptor.zIndex >=
        State.config.minimumZIndex
    )
        return true;

    //
    // Rule 6
    //

    const e = descriptor.element;

    if (
        e.tagName === "DIALOG"
    )
        return true;

    if (
        e.hasAttribute("popover")
    )
        return true;

    if (
        e.getAttribute("role") === "dialog"
    )
        return true;

    if (
        e.getAttribute("aria-modal") === "true"
    )
        return true;

    return false;

}
////////////////////////////////////////////////////////////////////
//// Debug
////////////////////////////////////////////////////////////////////

function dumpCandidates() {

    console.table(

        State.candidateDescriptors.map(d => ({

            tag: d.tagName,

            id: d.id,

            class: d.className,

            position: d.position,

            z: d.zIndex,

            coverage:
                Number(
                    (
                        d.coverageRatio * 100
                    ).toFixed(1)
                ) + "%"

        }))

    );

}

    function buildOverlapGraph() {

    State.overlapGraph.clear();

    for (const candidate of State.candidateDescriptors) {

        const covered =
            findCoveredElements(candidate);

        if (covered.length === 0)
            continue;

        State.overlapGraph.set(
            candidate,
            covered
        );

        State.stats.overlapEdges +=
            covered.length;

    }

    log(
        "Overlap graph:",
        State.overlapGraph.size,
        "nodes"
    );

}

function getSamplingPoints(rect) {

    const rows = State.config.sampleGrid;
    const cols = State.config.sampleGrid;

    const points = [];

    for (let r = 1; r <= rows; r++) {

        for (let c = 1; c <= cols; c++) {

            const x =
                rect.left +
                rect.width *
                c /
                (cols + 1);

            const y =
                rect.top +
                rect.height *
                r /
                (rows + 1);

            if (
                x < 0 ||
                y < 0 ||
                x >= State.viewport.width ||
                y >= State.viewport.height
            )
                continue;

            points.push({x, y});

        }

    }

    return points;

}

function findCoveredElements(candidate) {

    const covered = [];

    const visited = new Set();

    const points =
        getSamplingPoints(
            candidate.rect
        );

    for (const point of points) {

        const stack =
            document.elementsFromPoint(
                point.x,
                point.y
            );

        const candidateIndex =
            stack.indexOf(candidate.element);

        if (candidateIndex === -1)
            continue;

        //
        // Everything below candidate
        // is potentially covered.
        //

        for (
            let i = candidateIndex + 1;
            i < stack.length;
            i++
        ) {

            const target =
                stack[i];

            //
            // Ignore self
            //

            if (
                target === candidate.element
            )
                continue;

            //
            // Ignore ancestors
            //

            if (
                candidate.element.contains(
                    target
                )
            )
                continue;

            //
            // Ignore descendants
            //

            if (
                target.contains(
                    candidate.element
                )
            )
                continue;

            //
            // Don't add twice.
            //

            if (
                visited.has(target)
            )
                continue;

            visited.add(target);

            const targetDescriptor =
                State.elementLookup.get(target);

            if (!targetDescriptor)
                continue;

            covered.push(targetDescriptor);

            //
            // We only want the
            // FIRST visible element
            // underneath this sample point.
            //

            break;

        }

    }

    return covered;

}

    function reduceOverlapGraph() {

    State.hideCandidates = [];

    for (const candidate of State.overlapGraph.keys()) {

        if (
            isTopLevelCandidate(candidate)
        ) {

            State.hideCandidates.push(
                candidate
            );

        }

    }

    log(
        "Hide candidates:",
        State.hideCandidates.length
    );

}

function descriptorOf(element) {

    return State.elementLookup.get(element);

}

function isTopLevelCandidate(candidate) {

    //
    // If another candidate covers THIS
    // candidate, don't hide it yet.
    //

    for (const [other, covered] of State.overlapGraph) {

        if (other === candidate)
            continue;

        if (
            covered.has(candidate)
        ) {

            return false;

        }

    }

    return true;

}

function dumpOverlapGraph() {

    for (const [parent, children]
            of State.overlapGraph) {

        console.group(

            parent.tagName,

            parent.className

        );

        console.table(

            [...children.entries()].map(

                ([descriptor, hits]) => ({

                    tag: descriptor.tagName,

                    id: descriptor.id,

                    class: descriptor.className,

                    hits

                })

            )

        );

        console.groupEnd();

    }

}

    function collectMetadata() {

    const currentHost = location.hostname;

    for (const descriptor of State.hideCandidates) {

        const e = descriptor.element;

        const links =
            [...e.querySelectorAll("a[href]")];

        const clickable =
            e.querySelectorAll(`
                a,
                button,
                input,
                textarea,
                select,
                [role='button'],
                [onclick]
            `).length;

        const iframes =
            e.querySelectorAll("iframe").length;

        const images =
            e.querySelectorAll("img").length;

        const forms =
            e.querySelectorAll("form").length;

        let sameDomain = 0;

        for (const a of links) {

            try {

                if (
                    new URL(a.href).hostname ===
                    currentHost
                )
                    sameDomain++;

            }
            catch {}

        }

        //------------------------------------------------------
        // Simple confidence score
        //------------------------------------------------------

        let score = 0;

        if (descriptor.position === "fixed")
            score += 5;

        if (descriptor.position === "sticky")
            score += 2;

        score += Math.min(
            descriptor.coverageRatio * 20,
            10
        );

        score += Math.min(
            descriptor.zIndex / 100,
            5
        );

        if (
            descriptor.element.tagName === "DIALOG"
        )
            score += 4;

        if (
            descriptor.element.getAttribute("role")
            === "dialog"
        )
            score += 4;

        descriptor.metadata = {

            score,

            clickable,

            forms,

            iframes,

            images,

            linkCount: links.length,

            sameDomainLinks: sameDomain,

            links:
                links.map(
                    l => l.href
                )

        };

    }

}

    function hideElements() {

    State.hiddenElements = [];

    for (const descriptor of State.hideCandidates) {

        const e = descriptor.element;

        switch (
            State.config.hideStrategy
        ) {

            case "display":

                e.style.setProperty(
                    "display",
                    "none",
                    "important"
                );

                break;

            case "visibility":

                e.style.setProperty(
                    "visibility",
                    "hidden",
                    "important"
                );

                e.style.setProperty(
                    "pointer-events",
                    "none",
                    "important"
                );

                break;

            case "opacity":

                e.style.setProperty(
                    "opacity",
                    "0",
                    "important"
                );

                e.style.setProperty(
                    "pointer-events",
                    "none",
                    "important"
                );

                break;

            case "none":

            default:

                break;

        }

        State.hiddenElements.push({

            tag: descriptor.tagName,

            id: descriptor.id,

            className: descriptor.className,

            score:
                descriptor.metadata?.score ?? 0,

            coverage:
                descriptor.coverageRatio,

            zIndex:
                descriptor.zIndex,

            metadata:
                descriptor.metadata

        });

    }

    State.stats.hiddenElements =
        State.hiddenElements.length;

    log(
        "Hidden:",
        State.hiddenElements.length
    );

}

    ////////////////////////////////////////////////////////////////////
    // Public API
    ////////////////////////////////////////////////////////////////////

    return {

        run

    };

})();

