"use strict";

window.MutationExperiment = (() => {

    let observer = null;

    let stats = {};

    function isLocallyOverlapping(element) {

        const rect = element.getBoundingClientRect();

        const points = [

            [rect.left + rect.width / 2,
            rect.top + rect.height / 2],

            [rect.left + rect.width / 2,
            rect.top + 5],

            [rect.left + rect.width / 2,
            rect.bottom - 5],

            [rect.left + 5,
            rect.top + rect.height / 2],

            [rect.right - 5,
            rect.top + rect.height / 2]

        ];

        let hits = 0;

        for (const [x, y] of points) {

            const stack = document.elementsFromPoint(x, y);

            if (stack.length < 2)
                continue;

            if (stack[0] !== element)
                continue;

            if (
                stack[1] === element ||
                element.contains(stack[1]) ||
                stack[1].contains(element)
            ) {
                continue;
            }

            hits++;

        }

        return hits;
    }

    function reset() {

        stats = {

            callbacks: 0,

            totalMutations: 0,

            childList: 0,

            attributes: 0,

            characterData: 0,

            addedNodes: 0,

            removedNodes: 0,

            attributeNames: {},

            mutatedElements: new Set(),

            largeElements: 0,
            
            smallElements: 0,

            interactiveElements: new Set(),

            overlapCandidates: 0,

        };

    }

    function start() {

        reset();

        observer = new MutationObserver(records => {

            stats.callbacks++;

            stats.totalMutations += records.length;

            for (const record of records) {

                stats.mutatedElements.add(record.target);

                switch (record.type) {

                    case "childList":

                        stats.childList++;

                        stats.addedNodes +=
                            record.addedNodes.length;

                        stats.removedNodes +=
                            record.removedNodes.length;

                        break;

                    case "attributes":

                        stats.attributes++;

                        const name = record.attributeName;

                        if (!(name in stats.attributeNames)) {

                            stats.attributeNames[name] = 0;

                        }

                        stats.attributeNames[name]++;

                        break;

                    case "characterData":

                        stats.characterData++;

                        break;

                }

            }

        });

        observer.observe(document, {

            subtree: true,

            childList: true,

            attributes: true,

            characterData: true

        });

    }

    function stop() {

        observer.disconnect();
        const minWidth =
            window.innerWidth * 0.6;

        const minHeight =
            window.innerHeight * 0.6;

        for (const element of stats.mutatedElements) {
            const interactive =
                element.matches(
                    "button,a,input,select,textarea,[role='button']"
                ) ||

                element.querySelector(
                    "button,a,input,select,textarea,[role='button']"
                ) !== null;

            if (interactive) {
                stats.interactiveElements.add(element);
            }

            const rect = element.getBoundingClientRect();

            const overlapHits =
                isLocallyOverlapping(element);

            const isLarge =
                rect.width >= minWidth ||
                rect.height >= minHeight;

            if (isLarge) {

                stats.largeElements++;

                if (interactive) {

                    stats.largeInteractiveElements =
                        (stats.largeInteractiveElements || 0) + 1;

                    if (overlapHits >= 3) {

                        stats.overlapCandidates++;

                    }

                }

            } else {

                stats.smallElements++;

            }

        }

        return  {
            ...stats,

            uniqueElements: stats.mutatedElements.size,

            interactiveElements:
                stats.interactiveElements.size
        };

    }

    return {

        start,

        stop

    };

})();