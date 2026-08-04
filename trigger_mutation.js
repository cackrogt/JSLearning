"use strict";

window.MutationExperiment = (() => {

    let observer = null;

    let stats = {};

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

            interactiveElements: 0,

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

            const rect = element.getBoundingClientRect();

            if (
                rect.width >= minWidth ||
                rect.height >= minHeight
            ) {

                stats.largeElements++;
                if (interactive) {

                    stats.largeInteractiveElements =
                        (stats.largeInteractiveElements || 0) + 1;

                }

            } else {

                stats.smallElements++;

            }

        }

        return  {
        ...stats,

        uniqueElements: stats.mutatedElements.size
        };

    }

    return {

        start,

        stop

    };

})();